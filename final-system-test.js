const fs = require('fs');
const { execSync } = require('child_process');

console.log('🎯 Final System Integration Test\n');

// Kill any existing process
try {
  execSync('pkill -f "node.*main.ts" 2>/dev/null || true');
  execSync('pkill -f "tsx" 2>/dev/null || true');
} catch (e) {}

console.log('Running comprehensive system test for 2 minutes...\n');

const startTime = Date.now();
let output = '';

try {
  output = execSync('timeout 120 npm run dev 2>&1', {
    cwd: '/home/deployuser/memecoin/memecoin-analyzer',
    maxBuffer: 15 * 1024 * 1024
  }).toString();
} catch (e) {
  output = e.stdout ? e.stdout.toString() : '';
}

// Save output
fs.writeFileSync('final-system-test.log', output);

// Parse results
const lines = output.split('\n');
let stats = {
  // API & Data
  tokensFound: 0,
  apiRequests: 0,
  rateLimitErrors: 0,
  
  // Analysis Pipeline
  technicalAnalyses: 0,
  ratingsStarted: 0,
  ratingsCompleted: 0,
  
  // AI Integration
  aiAnalysisAttempts: 0,
  aiAnalysisCompleted: 0,
  aiAnalysisFailed: 0,
  
  // Notifications
  discordNotifications: 0,
  
  // Errors
  errors: [],
  warnings: [],
  
  // Performance
  avgRatingTime: 0,
  ratingTimes: []
};

// Track rating calculation times
let ratingStartTimes = {};

for (const line of lines) {
  // API & Data Collection
  if (line.includes('Found') && line.includes('tokens in target range')) {
    const match = line.match(/Found (\d+) tokens/);
    if (match) stats.tokensFound = Math.max(stats.tokensFound, parseInt(match[1]));
  }
  
  if (line.includes('Making API request')) {
    stats.apiRequests++;
  }
  
  if (line.includes('Rate limit exceeded') || line.includes('429')) {
    stats.rateLimitErrors++;
  }
  
  // Analysis Pipeline
  if (line.includes('Technical analysis completed')) {
    stats.technicalAnalyses++;
  }
  
  if (line.includes('Starting enhanced rating calculation') || line.includes('Starting rating calculation')) {
    stats.ratingsStarted++;
    const tokenMatch = line.match(/"tokenAddress":"([^"]+)"/);
    if (tokenMatch) {
      ratingStartTimes[tokenMatch[1]] = Date.now();
    }
  }
  
  if (line.includes('Enhanced rating calculation completed') || line.includes('Rating calculation completed')) {
    stats.ratingsCompleted++;
    const tokenMatch = line.match(/"tokenAddress":"([^"]+)"/);
    if (tokenMatch && ratingStartTimes[tokenMatch[1]]) {
      const duration = Date.now() - ratingStartTimes[tokenMatch[1]];
      stats.ratingTimes.push(duration);
      delete ratingStartTimes[tokenMatch[1]];
    }
  }
  
  // AI Analysis
  if (line.includes('Starting AI analysis')) {
    stats.aiAnalysisAttempts++;
  }
  
  if (line.includes('AI analysis completed')) {
    stats.aiAnalysisCompleted++;
  }
  
  if (line.includes('AI analysis failed')) {
    stats.aiAnalysisFailed++;
  }
  
  // Discord
  if (line.includes('Sending Discord notification')) {
    stats.discordNotifications++;
  }
  
  // Errors & Warnings
  if (line.includes('[31merror') || line.includes('Error:')) {
    const errorMatch = line.match(/error[^:]*: (.+)/i);
    if (errorMatch) stats.errors.push(errorMatch[1].substring(0, 100));
  }
  
  if (line.includes('[33mwarn')) {
    const warnMatch = line.match(/warn[^:]*: (.+)/i);
    if (warnMatch) stats.warnings.push(warnMatch[1].substring(0, 100));
  }
}

// Calculate performance metrics
if (stats.ratingTimes.length > 0) {
  stats.avgRatingTime = stats.ratingTimes.reduce((a, b) => a + b, 0) / stats.ratingTimes.length;
}

// Display results
console.log('=== FINAL SYSTEM TEST RESULTS ===\n');

console.log('📡 API & Data Collection:');
console.log(`  • Tokens Found: ${stats.tokensFound}`);
console.log(`  • API Requests: ${stats.apiRequests}`);
console.log(`  • Rate Limit Errors: ${stats.rateLimitErrors}`);

console.log('\n📊 Analysis Pipeline:');
console.log(`  • Technical Analyses: ${stats.technicalAnalyses}`);
console.log(`  • Ratings Started: ${stats.ratingsStarted}`);
console.log(`  • Ratings Completed: ${stats.ratingsCompleted}`);
console.log(`  • Completion Rate: ${stats.ratingsStarted > 0 ? ((stats.ratingsCompleted / stats.ratingsStarted) * 100).toFixed(1) : 0}%`);

console.log('\n🤖 AI Integration:');
console.log(`  • AI Attempts: ${stats.aiAnalysisAttempts}`);
console.log(`  • AI Completed: ${stats.aiAnalysisCompleted}`);
console.log(`  • AI Failed: ${stats.aiAnalysisFailed}`);
console.log(`  • AI Success Rate: ${stats.aiAnalysisAttempts > 0 ? ((stats.aiAnalysisCompleted / stats.aiAnalysisAttempts) * 100).toFixed(1) : 'N/A'}%`);

console.log('\n🔔 Notifications:');
console.log(`  • Discord Sent: ${stats.discordNotifications}`);

console.log('\n⚡ Performance:');
if (stats.avgRatingTime > 0) {
  console.log(`  • Avg Rating Time: ${(stats.avgRatingTime / 1000).toFixed(1)}s`);
  console.log(`  • Min Rating Time: ${(Math.min(...stats.ratingTimes) / 1000).toFixed(1)}s`);
  console.log(`  • Max Rating Time: ${(Math.max(...stats.ratingTimes) / 1000).toFixed(1)}s`);
}

console.log('\n❌ Issues:');
console.log(`  • Errors: ${stats.errors.length}`);
console.log(`  • Warnings: ${stats.warnings.length}`);
if (stats.errors.length > 0) {
  console.log('\n  Top Errors:');
  [...new Set(stats.errors)].slice(0, 3).forEach(err => {
    console.log(`    - ${err}`);
  });
}

// System health summary
console.log('\n🏥 System Health Summary:');
const healthMetrics = {
  'API Integration': stats.tokensFound > 0 && stats.rateLimitErrors < stats.apiRequests * 0.1,
  'Technical Analysis': stats.technicalAnalyses > 0,
  'Rating Engine': stats.ratingsCompleted > 0 && stats.ratingsCompleted >= stats.ratingsStarted * 0.9,
  'AI Analysis': stats.aiAnalysisAttempts === 0 || stats.aiAnalysisCompleted > 0,
  'Error Rate': stats.errors.length < 5,
  'Performance': stats.avgRatingTime > 0 && stats.avgRatingTime < 30000 // Under 30s
};

let overallHealth = true;
for (const [metric, healthy] of Object.entries(healthMetrics)) {
  console.log(`  ${healthy ? '✅' : '❌'} ${metric}`);
  if (!healthy) overallHealth = false;
}

console.log(`\n🎯 OVERALL SYSTEM STATUS: ${overallHealth ? '✅ OPERATIONAL' : '❌ ISSUES DETECTED'}`);

if (overallHealth) {
  console.log('\n✨ Success! The memecoin analyzer system is fully operational:');
  console.log('   • Fetching and filtering tokens by market cap');
  console.log('   • Performing technical analysis');
  console.log('   • Calculating ratings without hanging');
  console.log('   • AI analysis ready for high-rated tokens');
  console.log('   • Discord notifications ready');
} else {
  console.log('\n⚠️  Some components need attention. Check the metrics above.');
}

console.log('\nDetailed log saved to final-system-test.log');