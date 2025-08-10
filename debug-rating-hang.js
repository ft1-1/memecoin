#!/usr/bin/env node

/**
 * Debug script to identify hanging issues in rating calculation
 * 
 * This script will:
 * 1. Mock the rating calculation with detailed logging
 * 2. Test individual components for hanging
 * 3. Add process monitoring to detect stalls
 */

const { performance } = require('perf_hooks');

// Mock data for testing
const mockTechnicalIndicators = {
  rsi: 65.5,
  macd: {
    macd: 0.002,
    signal: 0.001,
    histogram: 0.001
  },
  bollinger: {
    upper: 1.1,
    middle: 1.0,
    lower: 0.9,
    position: 0.6
  },
  ema: {
    '12': 1.05,
    '26': 1.02,
    '50': 0.98
  },
  sma: {
    '20': 1.03,
    '50': 0.99
  }
};

const mockMomentum = {
  trend: 'bullish',
  strength: 75,
  momentum: 1.2,
  volatility: 25,
  priceAction: {
    breakoutPotential: 0.7,
    consolidation: true,
    reversalSignal: false
  },
  support: [0.95, 0.90],
  resistance: [1.15, 1.20]
};

const mockVolume = {
  currentVolume: 1500000,
  averageVolume: 1000000,
  volumeSpike: true,
  volumeSpikeFactor: 1.5,
  liquidityScore: 75,
  volumeProfile: {
    buyPressure: 0.65,
    sellPressure: 0.35,
    netFlow: 0.3
  }
};

const mockRisk = {
  overall: 35,
  riskLevel: 'medium',
  factors: {
    liquidity: 25,
    volatility: 40,
    holderConcentration: 30,
    marketCap: 20,
    age: 45,
    rugPullRisk: 15
  },
  warnings: []
};

const mockContext = {
  tokenData: {
    address: 'CHILLHOUSE_TEST_TOKEN',
    price: 1.05,
    marketCap: 25000000
  },
  marketContext: {
    overallTrend: 'bull',
    volatilityIndex: 45,
    marketSentiment: 65
  }
};

// Monitoring functions
let lastLogTime = Date.now();
let stepCounter = 0;

function logStep(stepName, data = {}) {
  stepCounter++;
  const now = Date.now();
  const timeSinceLastLog = now - lastLogTime;
  
  console.log(`[${new Date().toISOString()}] Step ${stepCounter}: ${stepName}`);
  console.log(`  Time since last step: ${timeSinceLastLog}ms`);
  if (Object.keys(data).length > 0) {
    console.log(`  Data:`, JSON.stringify(data, null, 2));
  }
  console.log('');
  
  lastLogTime = now;
}

function setupHangDetection() {
  const HANG_THRESHOLD = 10000; // 10 seconds
  let lastActivityTime = Date.now();
  
  // Update activity timestamp
  const originalLog = console.log;
  console.log = (...args) => {
    lastActivityTime = Date.now();
    originalLog.apply(console, args);
  };
  
  // Check for hangs every 2 seconds
  const hangCheckInterval = setInterval(() => {
    const timeSinceActivity = Date.now() - lastActivityTime;
    if (timeSinceActivity > HANG_THRESHOLD) {
      console.error(`🚨 POTENTIAL HANG DETECTED! No activity for ${timeSinceActivity}ms`);
      console.error(`Last step: ${stepCounter}`);
      console.error('Process may be hanging. Consider killing and investigating.');
      
      // Log current call stack
      console.error('Current stack trace:');
      console.trace();
      
      clearInterval(hangCheckInterval);
      process.exit(1);
    }
  }, 2000);
  
  return () => clearInterval(hangCheckInterval);
}

// Simulate the rating calculation steps with detailed monitoring
async function simulateRatingCalculation() {
  const startTime = performance.now();
  logStep('Starting simulated rating calculation', { tokenAddress: mockContext.tokenData.address });
  
  try {
    // Step 1: Context preparation
    logStep('Preparing safe context');
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
    
    // Step 2: Component calculations (this is where hangs likely occur)
    logStep('Starting component calculations');
    
    // Simulate each component calculation with potential for hanging
    logStep('Calculating technical score');
    await simulateComponentCalculation('technical', 2000);
    
    logStep('Calculating momentum score');
    await simulateComponentCalculation('momentum', 1500);
    
    logStep('Calculating volume score');
    await simulateComponentCalculation('volume', 1800);
    
    logStep('Calculating risk score');
    await simulateComponentCalculation('risk', 1200);
    
    logStep('Component calculations completed');
    
    // Step 3: Enhanced calculations (database-heavy operations)
    logStep('Starting enhanced calculations');
    
    logStep('Multi-timeframe calculation');
    await simulateEnhancedCalculation('multiTimeframe', 3000);
    
    logStep('Consecutive momentum calculation (DATABASE OPERATIONS)');
    await simulateEnhancedCalculation('consecutiveMomentum', 4000, true); // This one uses DB
    
    logStep('Exhaustion penalty calculation');
    await simulateEnhancedCalculation('exhaustionPenalty', 2000);
    
    // Step 4: Final calculations
    logStep('Final score calculations');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    logStep('Confidence and smoothing');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    logStep('Generating reasoning and alerts');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    logStep('Storing results (DATABASE OPERATIONS)');
    await simulateEnhancedCalculation('storage', 2000, true); // This one uses DB
    
    const totalTime = performance.now() - startTime;
    logStep('Rating calculation completed', { 
      totalTimeMs: Math.round(totalTime),
      rating: 7.2,
      confidence: 78
    });
    
  } catch (error) {
    console.error('❌ Rating calculation failed:', error);
    throw error;
  }
}

async function simulateComponentCalculation(componentName, baseTime) {
  const start = performance.now();
  
  // Simulate some CPU-intensive work
  await new Promise(resolve => {
    const iterations = Math.floor(Math.random() * 1000000) + 500000;
    let counter = 0;
    
    const work = () => {
      for (let i = 0; i < 10000; i++) {
        counter += Math.sin(i) * Math.cos(i);
      }
      
      if (counter < iterations) {
        // Use setImmediate to allow other operations to run
        setImmediate(work);
      } else {
        resolve();
      }
    };
    
    work();
  });
  
  // Add some random delay to simulate real processing
  await new Promise(resolve => setTimeout(resolve, baseTime + Math.random() * 500));
  
  const duration = performance.now() - start;
  logStep(`${componentName} component completed`, { durationMs: Math.round(duration) });
}

async function simulateEnhancedCalculation(calculationName, baseTime, isDatabaseOperation = false) {
  const start = performance.now();
  
  if (isDatabaseOperation) {
    logStep(`${calculationName} - Starting database operations`);
    
    // Simulate database connection delays
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Simulate multiple database queries
    for (let i = 0; i < 3; i++) {
      logStep(`${calculationName} - Database query ${i + 1}/3`);
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
    }
    
    logStep(`${calculationName} - Database operations completed`);
  }
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, baseTime + Math.random() * 1000));
  
  const duration = performance.now() - start;
  logStep(`${calculationName} calculation completed`, { 
    durationMs: Math.round(duration),
    isDatabaseOperation 
  });
}

// Main execution
async function main() {
  console.log('🔍 Starting Rating Calculation Debug Session');
  console.log('This will simulate the rating calculation with detailed step logging');
  console.log('Watch for any steps that take unusually long or cause hangs\n');
  
  const stopHangDetection = setupHangDetection();
  
  try {
    await simulateRatingCalculation();
    console.log('✅ Simulation completed successfully');
  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  } finally {
    stopHangDetection();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Process interrupted by user');
  console.log(`Last completed step: ${stepCounter}`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Process terminated');
  console.log(`Last completed step: ${stepCounter}`);
  process.exit(0);
});

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}