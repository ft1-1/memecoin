const fs = require('fs');
const { execSync } = require('child_process');

console.log('🧪 Verifying rating calculation fix...\n');

// Kill any existing process
try {
  execSync('pkill -f "node.*main.ts" 2>/dev/null || true');
  execSync('pkill -f "tsx" 2>/dev/null || true');
} catch (e) {}

console.log('Running app for 2 minutes to check rating completion...\n');

const startTime = Date.now();
let output = '';

try {
  output = execSync('timeout 120 npm run dev 2>&1', {
    cwd: '/home/deployuser/memecoin/memecoin-analyzer',
    maxBuffer: 10 * 1024 * 1024
  }).toString();
} catch (e) {
  output = e.stdout ? e.stdout.toString() : '';
}

// Count key events
const lines = output.split('\n');
let stats = {
  ratingsStarted: 0,
  ratingsCompleted: 0,
  ratingsTimedOut: 0,
  ratingSteps: {},
  lastRatingToken: null
};

for (const line of lines) {
  // Track rating starts
  if (line.includes('Starting enhanced rating calculation') || line.includes('Starting rating calculation for')) {
    stats.ratingsStarted++;
    const match = line.match(/"tokenAddress":"([^"]+)"/);
    if (match) stats.lastRatingToken = match[1];
  }
  
  // Track rating completions
  if (line.includes('Rating calculation completed') || line.includes('Enhanced rating calculation completed')) {
    stats.ratingsCompleted++;
  }
  
  // Track timeouts
  if (line.includes('timeout') && line.includes('rating')) {
    stats.ratingsTimedOut++;
  }
  
  // Track rating steps
  const stepMatch = line.match(/Rating calculation step: ([^"]+)/);
  if (stepMatch) {
    const step = stepMatch[1];
    stats.ratingSteps[step] = (stats.ratingSteps[step] || 0) + 1;
  }
}

// Display results
console.log('=== RATING FIX VERIFICATION ===\n');
console.log(`📊 Ratings Started: ${stats.ratingsStarted}`);
console.log(`✅ Ratings Completed: ${stats.ratingsCompleted}`);
console.log(`⏱️  Ratings Timed Out: ${stats.ratingsTimedOut}`);
console.log(`🏁 Completion Rate: ${stats.ratingsStarted > 0 ? ((stats.ratingsCompleted / stats.ratingsStarted) * 100).toFixed(1) : 0}%`);

if (Object.keys(stats.ratingSteps).length > 0) {
  console.log('\n📍 Rating Steps Tracked:');
  for (const [step, count] of Object.entries(stats.ratingSteps)) {
    console.log(`  - ${step}: ${count}`);
  }
}

console.log('\n🎯 VERDICT:');
if (stats.ratingsCompleted > 0) {
  console.log('✅ SUCCESS: Rating calculations are completing!');
  console.log(`   ${stats.ratingsCompleted} ratings finished successfully`);
} else if (stats.ratingsTimedOut > 0) {
  console.log('⚠️  PARTIAL: Ratings are timing out instead of hanging');
  console.log('   This is better than infinite hangs!');
} else if (stats.ratingsStarted > 0) {
  console.log('❌ ISSUE: Ratings start but do not complete');
  console.log(`   Last token attempted: ${stats.lastRatingToken}`);
} else {
  console.log('❓ UNCLEAR: No rating attempts detected');
}

// Save detailed output
fs.writeFileSync('rating-fix-verification.log', output);
console.log('\nDetailed log saved to rating-fix-verification.log');