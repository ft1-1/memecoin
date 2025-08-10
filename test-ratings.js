const { spawn } = require('child_process');

console.log('Starting Memecoin Analyzer Test...\n');

const child = spawn('npm', ['run', 'dev'], {
  cwd: '/home/deployuser/memecoin/memecoin-analyzer',
  env: { ...process.env, NODE_ENV: 'development' }
});

let capturedOutput = '';
let analysisStarted = false;
let ratingsFound = [];
let tokensAnalyzed = [];

child.stdout.on('data', (data) => {
  const output = data.toString();
  capturedOutput += output;
  
  // Check for analysis start
  if (output.includes('Starting analysis cycle')) {
    analysisStarted = true;
    console.log('✓ Analysis cycle started');
  }
  
  // Check for token analysis
  if (output.includes('Starting technical analysis')) {
    const match = output.match(/tokenAddress": "([^"]+)"/);
    if (match) {
      tokensAnalyzed.push(match[1]);
      console.log(`✓ Analyzing token: ${match[1]}`);
    }
  }
  
  // Check for ratings
  if (output.includes('Rating calculated successfully')) {
    const ratingMatch = output.match(/"rating": ([\d.]+)/);
    const confidenceMatch = output.match(/"confidence": ([\d.]+)/);
    if (ratingMatch && confidenceMatch) {
      const rating = parseFloat(ratingMatch[1]);
      const confidence = parseFloat(confidenceMatch[1]);
      ratingsFound.push({ rating, confidence });
      console.log(`✓ Rating generated: ${rating}/10 (confidence: ${confidence}%)`);
    }
  }
  
  // Check for high-rated tokens
  if (output.includes('highRatedTokens')) {
    const match = output.match(/"highRatedTokens": (\d+)/);
    if (match) {
      console.log(`✓ High-rated tokens found: ${match[1]}`);
    }
  }
  
  // Check for errors
  if (output.includes('Failed to analyze token')) {
    const match = output.match(/Failed to analyze token ([^ ]+)/);
    if (match) {
      console.log(`✗ Failed to analyze: ${match[1]}`);
    }
  }
});

child.stderr.on('data', (data) => {
  const error = data.toString();
  if (!error.includes('EPIPE') && !error.includes('duplicate-class-member')) {
    console.error('Error:', error);
  }
});

// Run for 60 seconds then summarize
setTimeout(() => {
  console.log('\n=== ANALYSIS SUMMARY ===');
  console.log(`Analysis Started: ${analysisStarted ? 'YES' : 'NO'}`);
  console.log(`Tokens Analyzed: ${tokensAnalyzed.length}`);
  console.log(`Ratings Generated: ${ratingsFound.length}`);
  
  if (ratingsFound.length > 0) {
    console.log('\nRatings Distribution:');
    const highRated = ratingsFound.filter(r => r.rating >= 7);
    const mediumRated = ratingsFound.filter(r => r.rating >= 4 && r.rating < 7);
    const lowRated = ratingsFound.filter(r => r.rating < 4);
    
    console.log(`  High (7-10): ${highRated.length} tokens`);
    console.log(`  Medium (4-6): ${mediumRated.length} tokens`);
    console.log(`  Low (1-3): ${lowRated.length} tokens`);
    
    if (highRated.length > 0) {
      console.log('\nHigh-Rated Tokens:');
      highRated.forEach(r => {
        console.log(`  - Rating: ${r.rating}/10, Confidence: ${r.confidence}%`);
      });
    }
  }
  
  console.log('\n✓ Test completed');
  child.kill();
  process.exit(0);
}, 60000);

console.log('Test will run for 60 seconds...\n');