const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚀 Final 3-Minute System Test\n');
console.log('Starting memecoin analyzer with momentum optimizations...\n');

// Kill any existing processes
try {
  execSync('pkill -f "tsx" 2>/dev/null || true');
  execSync('pkill -f "node.*main.ts" 2>/dev/null || true');
} catch (e) {}

// Run for 3 minutes
const startTime = Date.now();
let output = '';

try {
  output = execSync('timeout 180 npm run dev 2>&1', {
    cwd: '/home/deployuser/memecoin/memecoin-analyzer',
    maxBuffer: 30 * 1024 * 1024
  }).toString();
} catch (e) {
  output = e.stdout ? e.stdout.toString() : '';
}

// Save full output
fs.writeFileSync('final-3min-test.log', output);
const runTime = ((Date.now() - startTime) / 1000).toFixed(1);

// Parse results
const lines = output.split('\n');
let stats = {
  errors: [],
  warnings: [],
  tokensFound: 0,
  ratingsGenerated: 0,
  entrySignals: [],
  volumeSurges: 0,
  momentumAnalyses: 0,
  apiErrors: 0,
  criticalErrors: 0
};

// Track specific momentum features
let momentumFeatures = {
  volumePersistenceChecks: 0,
  accelerationCalculations: 0,
  consecutiveMomentumTriggers: 0,
  fatigueDetections: 0,
  entrySignalTypes: {
    strong_buy: 0,
    buy: 0,
    watch: 0,
    no_signal: 0
  }
};

for (const line of lines) {
  // Errors
  if (line.includes('[31merror') || line.includes('Error:')) {
    const error = line.substring(0, 200);
    stats.errors.push(error);
    if (line.includes('CRITICAL') || line.includes('FATAL')) {
      stats.criticalErrors++;
    }
  }
  
  // Warnings
  if (line.includes('[33mwarn')) {
    stats.warnings.push(line.substring(0, 150));
  }
  
  // API errors
  if (line.includes('429') || line.includes('Rate limit')) {
    stats.apiErrors++;
  }
  
  // Token discovery
  if (line.includes('Found') && line.includes('tokens in target range')) {
    const match = line.match(/Found (\d+) tokens/);
    if (match) stats.tokensFound = Math.max(stats.tokensFound, parseInt(match[1]));
  }
  
  // Ratings
  if (line.includes('Rating calculation completed')) {
    stats.ratingsGenerated++;
  }
  
  // Volume surges
  if (line.includes('Volume surge detected') || line.includes('surge: true')) {
    stats.volumeSurges++;
  }
  
  // Momentum acceleration
  if (line.includes('Momentum acceleration analyzed') || line.includes('acceleration:')) {
    momentumFeatures.accelerationCalculations++;
  }
  
  // Volume persistence
  if (line.includes('Volume persistence') || line.includes('persistence tracking')) {
    momentumFeatures.volumePersistenceChecks++;
  }
  
  // Consecutive momentum
  if (line.includes('Consecutive momentum bonus') || line.includes('consecutiveCount')) {
    momentumFeatures.consecutiveMomentumTriggers++;
  }
  
  // Fatigue detection
  if (line.includes('fatigueLevel') && !line.includes('none')) {
    momentumFeatures.fatigueDetections++;
  }
  
  // Entry signals
  if (line.includes('Entry signal generated')) {
    const typeMatch = line.match(/type: "?(\w+)"?/);
    if (typeMatch) {
      const signalType = typeMatch[1];
      momentumFeatures.entrySignalTypes[signalType] = 
        (momentumFeatures.entrySignalTypes[signalType] || 0) + 1;
      
      const confMatch = line.match(/confidence: (\d+)/);
      if (confMatch) {
        stats.entrySignals.push({
          type: signalType,
          confidence: parseInt(confMatch[1])
        });
      }
    }
  }
}

// Display results
console.log(`=== FINAL TEST RESULTS (${runTime}s) ===\n`);

console.log('📊 System Activity:');
console.log(`  • Tokens Found: ${stats.tokensFound}`);
console.log(`  • Ratings Generated: ${stats.ratingsGenerated}`);
console.log(`  • Volume Surges Detected: ${stats.volumeSurges}`);
console.log(`  • API Errors: ${stats.apiErrors}`);

console.log('\n🚀 Momentum Features:');
console.log(`  • Volume Persistence Checks: ${momentumFeatures.volumePersistenceChecks}`);
console.log(`  • Acceleration Calculations: ${momentumFeatures.accelerationCalculations}`);
console.log(`  • Consecutive Momentum Triggers: ${momentumFeatures.consecutiveMomentumTriggers}`);
console.log(`  • Fatigue Detections: ${momentumFeatures.fatigueDetections}`);

console.log('\n🎯 Entry Signals Generated:');
Object.entries(momentumFeatures.entrySignalTypes).forEach(([type, count]) => {
  if (count > 0) {
    console.log(`  • ${type}: ${count}`);
  }
});

console.log('\n❌ Errors & Warnings:');
console.log(`  • Total Errors: ${stats.errors.length}`);
console.log(`  • Critical Errors: ${stats.criticalErrors}`);
console.log(`  • Warnings: ${stats.warnings.length}`);

if (stats.errors.length > 0) {
  console.log('\n  Recent Errors:');
  [...new Set(stats.errors)].slice(0, 5).forEach(err => {
    console.log(`    - ${err.substring(0, 100)}...`);
  });
}

// Health assessment
console.log('\n🏥 System Health:');
const health = {
  'Core Functionality': stats.tokensFound > 0 && stats.ratingsGenerated > 0,
  'Momentum Features': momentumFeatures.accelerationCalculations > 0 || momentumFeatures.volumePersistenceChecks > 0,
  'Entry Signals': Object.values(momentumFeatures.entrySignalTypes).some(v => v > 0),
  'Error Rate': stats.criticalErrors === 0 && stats.errors.length < 10,
  'API Stability': stats.apiErrors < stats.ratingsGenerated * 0.5
};

let overallHealth = true;
for (const [component, healthy] of Object.entries(health)) {
  console.log(`  ${healthy ? '✅' : '❌'} ${component}`);
  if (!healthy) overallHealth = false;
}

console.log(`\n🎯 OVERALL STATUS: ${overallHealth ? '✅ HEALTHY' : '❌ ISSUES DETECTED'}`);

if (!overallHealth) {
  console.log('\n⚠️  Action Required: Review errors in final-3min-test.log');
} else {
  console.log('\n✨ System is running smoothly with momentum optimizations active!');
}

console.log('\nFull log saved to: final-3min-test.log');