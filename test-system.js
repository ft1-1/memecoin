const fs = require('fs');
const { execSync } = require('child_process');

console.log('🧪 Testing Memecoin Analyzer System...\n');

// Kill any existing process
try {
  execSync('pkill -f "node.*main.ts" 2>/dev/null || true');
  execSync('pkill -f "tsx" 2>/dev/null || true');
} catch (e) {}

console.log('Starting app and monitoring for 3 minutes...\n');

// Run app for 3 minutes
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
fs.writeFileSync('test-output.log', output);

// Parse results
const lines = output.split('\n');
let stats = {
  tokensFound: 0,
  technicalAnalyses: 0,
  ratingsGenerated: 0,
  highRatedTokens: 0,
  aiAnalyses: 0,
  discordNotifications: 0,
  errors: 0,
  ratings: []
};

for (const line of lines) {
  if (line.includes('Found') && line.includes('tokens in target range')) {
    const match = line.match(/Found (\d+) tokens/);
    if (match) stats.tokensFound = parseInt(match[1]);
  }
  
  if (line.includes('Technical analysis completed for')) {
    stats.technicalAnalyses++;
  }
  
  if (line.includes('Rating calculation completed for')) {
    stats.ratingsGenerated++;
    const ratingMatch = line.match(/"rating":\s*([\d.]+)/);
    if (ratingMatch) {
      const rating = parseFloat(ratingMatch[1]);
      stats.ratings.push(rating);
      if (rating >= 7) stats.highRatedTokens++;
    }
  }
  
  if (line.includes('AI analysis completed for')) {
    stats.aiAnalyses++;
  }
  
  if (line.includes('Sending Discord notification')) {
    stats.discordNotifications++;
  }
  
  if (line.includes('error') || line.includes('failed')) {
    stats.errors++;
  }
}

// Calculate rating distribution
const ratingDist = {};
stats.ratings.forEach(r => {
  const bucket = Math.floor(r);
  ratingDist[bucket] = (ratingDist[bucket] || 0) + 1;
});

// Display results
console.log('=== SYSTEM TEST RESULTS ===\n');
console.log(`✅ Tokens Found: ${stats.tokensFound}`);
console.log(`✅ Technical Analyses: ${stats.technicalAnalyses}`);
console.log(`✅ Ratings Generated: ${stats.ratingsGenerated}`);
console.log(`✅ High-Rated Tokens (≥7): ${stats.highRatedTokens}`);
console.log(`✅ AI Analyses: ${stats.aiAnalyses}`);
console.log(`✅ Discord Notifications: ${stats.discordNotifications}`);
console.log(`❌ Errors: ${stats.errors}`);

console.log('\n📊 Rating Distribution:');
for (let i = 1; i <= 10; i++) {
  const count = ratingDist[i] || 0;
  const bar = '█'.repeat(count);
  console.log(`  ${i}: ${bar} (${count})`);
}

if (stats.ratings.length > 0) {
  const avgRating = stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length;
  console.log(`\n📈 Average Rating: ${avgRating.toFixed(2)}`);
}

// System health check
console.log('\n🏥 System Health:');
const healthChecks = {
  'API Integration': stats.tokensFound > 0,
  'Technical Analysis': stats.technicalAnalyses > 0,
  'Rating Engine': stats.ratingsGenerated > 0,
  'AI Analysis': stats.highRatedTokens === 0 || stats.aiAnalyses > 0,
  'Discord Notifications': stats.highRatedTokens === 0 || stats.discordNotifications > 0
};

let allHealthy = true;
for (const [component, healthy] of Object.entries(healthChecks)) {
  console.log(`  ${healthy ? '✅' : '❌'} ${component}`);
  if (!healthy) allHealthy = false;
}

console.log(`\n${allHealthy ? '✅ SYSTEM OPERATIONAL' : '❌ SYSTEM ISSUES DETECTED'}`);
console.log('\nFull log saved to test-output.log');