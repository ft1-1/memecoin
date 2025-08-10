const { execSync } = require('child_process');
const fs = require('fs');

// Kill any existing processes
try {
  execSync('pkill -f "node.*main.ts" 2>/dev/null || true');
  execSync('pkill -f "tsx" 2>/dev/null || true');
  execSync('lsof -ti:3001 | xargs kill -9 2>/dev/null || true');
} catch (e) {
  // Ignore errors
}

console.log('Starting app and checking for ratings...\n');

// Run the app for 45 seconds and capture output
const startTime = Date.now();
let output = '';

try {
  output = execSync('timeout 45 npm run dev 2>&1', {
    cwd: '/home/deployuser/memecoin/memecoin-analyzer',
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  }).toString();
} catch (e) {
  output = e.stdout ? e.stdout.toString() : '';
}

// Save output to file for analysis
fs.writeFileSync('app-output.log', output);

// Parse the output
const lines = output.split('\n');
let analysisStarted = false;
let tokensAnalyzed = 0;
let ratingsGenerated = 0;
let highRatedTokens = 0;

for (const line of lines) {
  if (line.includes('Starting analysis cycle')) {
    analysisStarted = true;
  }
  
  if (line.includes('Starting technical analysis')) {
    tokensAnalyzed++;
  }
  
  if (line.includes('Rating calculated successfully')) {
    ratingsGenerated++;
    // Extract rating value
    const ratingMatch = line.match(/"rating":\s*([\d.]+)/);
    if (ratingMatch && parseFloat(ratingMatch[1]) >= 7) {
      highRatedTokens++;
    }
  }
  
  if (line.includes('highRatedTokens')) {
    const match = line.match(/"highRatedTokens":\s*(\d+)/);
    if (match) {
      console.log(`High-rated tokens reported: ${match[1]}`);
    }
  }
}

console.log('\n=== VERIFICATION RESULTS ===');
console.log(`Analysis Started: ${analysisStarted ? 'YES ✓' : 'NO ✗'}`);
console.log(`Tokens Analyzed: ${tokensAnalyzed}`);
console.log(`Ratings Generated: ${ratingsGenerated}`);
console.log(`High-Rated Tokens (≥7): ${highRatedTokens}`);

// Check for specific errors
const errorCount = (output.match(/Failed to analyze token/g) || []).length;
if (errorCount > 0) {
  console.log(`\nErrors encountered: ${errorCount} tokens failed`);
}

// Look for Discord notifications
const discordNotifications = (output.match(/Sending Discord notification/g) || []).length;
if (discordNotifications > 0) {
  console.log(`Discord notifications sent: ${discordNotifications}`);
}

console.log('\n✓ Verification complete');
console.log('Full output saved to app-output.log');

// Summary
if (ratingsGenerated > 0) {
  console.log('\n✅ SUCCESS: The app is generating ratings!');
  console.log(`   Generated ${ratingsGenerated} ratings from ${tokensAnalyzed} analyzed tokens`);
} else {
  console.log('\n❌ ISSUE: No ratings were generated');
  console.log('   Check app-output.log for detailed logs');
}