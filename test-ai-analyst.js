const fs = require('fs');
const { execSync } = require('child_process');

console.log('🤖 Testing AI Analyst Integration...\n');

// Kill any existing process
try {
  execSync('pkill -f "node.*main.ts" 2>/dev/null || true');
  execSync('pkill -f "tsx" 2>/dev/null || true');
} catch (e) {}

console.log('Starting app and monitoring for 3 minutes...\n');

const startTime = Date.now();
let output = '';

try {
  output = execSync('timeout 180 npm run dev 2>&1', {
    cwd: '/home/deployuser/memecoin/memecoin-analyzer',
    maxBuffer: 20 * 1024 * 1024
  }).toString();
} catch (e) {
  output = e.stdout ? e.stdout.toString() : '';
}

// Save output
fs.writeFileSync('ai-analyst-test.log', output);

// Parse results
const lines = output.split('\n');
let stats = {
  tokensFound: 0,
  technicalAnalyses: 0,
  ratingsGenerated: 0,
  ratings: [],
  aiAnalysisAttempts: 0,
  aiAnalysisCompleted: 0,
  aiAnalysisFailed: 0,
  discordNotifications: 0,
  highRatedTokens: [],
  aiInsights: []
};

for (const line of lines) {
  if (line.includes('Found') && line.includes('tokens in target range')) {
    const match = line.match(/Found (\d+) tokens/);
    if (match) stats.tokensFound = parseInt(match[1]);
  }
  
  if (line.includes('Technical analysis completed for')) {
    stats.technicalAnalyses++;
  }
  
  if (line.includes('Rating calculation completed') || line.includes('Enhanced rating calculation completed')) {
    stats.ratingsGenerated++;
    const ratingMatch = line.match(/"rating":\s*([\\d.]+)/);
    if (ratingMatch) {
      const rating = parseFloat(ratingMatch[1]);
      stats.ratings.push(rating);
      
      // Track high-rated tokens
      const tokenMatch = line.match(/for\s+(\w+)\s+{/) || line.match(/"tokenAddress":"([^"]+)"/);
      if (tokenMatch && rating >= 6) {
        stats.highRatedTokens.push({
          token: tokenMatch[1],
          rating: rating
        });
      }
    }
  }
  
  // AI Analysis tracking
  if (line.includes('Starting AI analysis') || line.includes('Performing AI analysis')) {
    stats.aiAnalysisAttempts++;
  }
  
  if (line.includes('AI analysis completed') || line.includes('Claude analysis completed')) {
    stats.aiAnalysisCompleted++;
    
    // Try to extract AI insights
    const insightMatch = line.match(/"aiInsight":"([^"]+)"/);
    if (insightMatch) {
      stats.aiInsights.push(insightMatch[1]);
    }
  }
  
  if (line.includes('AI analysis failed') || line.includes('Claude analysis error')) {
    stats.aiAnalysisFailed++;
  }
  
  if (line.includes('Sending Discord notification')) {
    stats.discordNotifications++;
  }
}

// Calculate rating distribution
const ratingDist = {};
stats.ratings.forEach(r => {
  const bucket = Math.floor(r);
  ratingDist[bucket] = (ratingDist[bucket] || 0) + 1;
});

// Display results
console.log('=== AI ANALYST TEST RESULTS ===\n');
console.log(`📊 System Activity:`);
console.log(`  • Tokens Found: ${stats.tokensFound}`);
console.log(`  • Technical Analyses: ${stats.technicalAnalyses}`);
console.log(`  • Ratings Generated: ${stats.ratingsGenerated}`);

console.log('\n📈 Rating Distribution:');
for (let i = 1; i <= 10; i++) {
  const count = ratingDist[i] || 0;
  const bar = '█'.repeat(count);
  console.log(`  ${i}: ${bar} (${count})`);
}

if (stats.ratings.length > 0) {
  const avgRating = stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length;
  const maxRating = Math.max(...stats.ratings);
  console.log(`\n  Average: ${avgRating.toFixed(2)}`);
  console.log(`  Maximum: ${maxRating.toFixed(2)}`);
}

console.log('\n🤖 AI Analysis Status:');
console.log(`  • High-Rated Tokens (≥6): ${stats.highRatedTokens.length}`);
console.log(`  • AI Analysis Attempts: ${stats.aiAnalysisAttempts}`);
console.log(`  • AI Analysis Completed: ${stats.aiAnalysisCompleted}`);
console.log(`  • AI Analysis Failed: ${stats.aiAnalysisFailed}`);

if (stats.highRatedTokens.length > 0) {
  console.log('\n🌟 High-Rated Tokens:');
  stats.highRatedTokens.forEach(t => {
    console.log(`  • ${t.token}: ${t.rating.toFixed(1)}`);
  });
}

if (stats.aiInsights.length > 0) {
  console.log('\n💡 AI Insights Generated:');
  stats.aiInsights.forEach((insight, i) => {
    console.log(`  ${i + 1}. ${insight.substring(0, 100)}...`);
  });
}

console.log('\n🔔 Discord Notifications: ' + stats.discordNotifications);

// System health check
console.log('\n🏥 Component Health:');
const healthChecks = {
  'API Integration': stats.tokensFound > 0,
  'Technical Analysis': stats.technicalAnalyses > 0,
  'Rating Engine': stats.ratingsGenerated > 0,
  'AI Analysis Trigger': stats.highRatedTokens.length === 0 || stats.aiAnalysisAttempts > 0,
  'AI Analysis Success': stats.aiAnalysisAttempts === 0 || stats.aiAnalysisCompleted > 0,
  'Discord Integration': stats.highRatedTokens.filter(t => t.rating >= 7).length === 0 || stats.discordNotifications > 0
};

let allHealthy = true;
for (const [component, healthy] of Object.entries(healthChecks)) {
  console.log(`  ${healthy ? '✅' : '❌'} ${component}`);
  if (!healthy) allHealthy = false;
}

// Final verdict
console.log('\n🎯 VERDICT:');
if (stats.highRatedTokens.length === 0) {
  console.log('⚠️  No tokens rated ≥6 to trigger AI analysis');
  console.log('   Current ratings are too low for AI activation');
  console.log('   AI threshold: ≥6, Discord threshold: ≥7');
} else if (stats.aiAnalysisCompleted > 0) {
  console.log('✅ SUCCESS: AI Analyst is working!');
  console.log(`   ${stats.aiAnalysisCompleted} analyses completed successfully`);
} else if (stats.aiAnalysisAttempts > 0) {
  console.log('❌ ISSUE: AI analysis attempted but failed');
  console.log(`   Check Claude API key and configuration`);
} else {
  console.log('❌ ISSUE: AI analysis not triggered despite high ratings');
}

console.log('\nFull log saved to ai-analyst-test.log');