const { execSync } = require('child_process');

console.log('🔍 Verifying timeframe configuration...\n');

// Check running processes
const processes = execSync('ps aux | grep -E "(tsx|node.*main)" | grep -v grep || true').toString();
console.log('Running processes:');
console.log(processes);

// Check recent logs for timeframe usage
console.log('\n📊 Checking recent logs for timeframe usage...\n');

try {
  // Get last 100 lines of logs
  const logs = execSync('tail -100 /tmp/memecoin-analyzer.log 2>/dev/null || echo "No log file found"').toString();
  
  // Count timeframe occurrences
  const timeframeCounts = {
    '5m': (logs.match(/5m/g) || []).length,
    '15m': (logs.match(/15m/g) || []).length,
    '1h': (logs.match(/1h/g) || []).length,
    '4h': (logs.match(/4h/g) || []).length
  };
  
  console.log('Timeframe mentions in recent logs:');
  Object.entries(timeframeCounts).forEach(([tf, count]) => {
    console.log(`  ${tf}: ${count} occurrences`);
  });
  
  // Check for aggregation logs
  const aggregationLogs = logs.split('\n').filter(line => 
    line.includes('Multi-timeframe') || 
    line.includes('timeframes":') ||
    line.includes('aggregation completed')
  );
  
  if (aggregationLogs.length > 0) {
    console.log('\n📋 Recent aggregation logs:');
    aggregationLogs.slice(-5).forEach(log => console.log('  ' + log.substring(0, 150)));
  }
  
} catch (e) {
  console.log('Could not analyze logs:', e.message);
}

console.log('\n✅ Configuration Summary:');
console.log('  - Target timeframes: 1h, 4h');
console.log('  - Analysis interval: 15 minutes');
console.log('  - Expected behavior: Only fetch/aggregate 1h and 4h data');

console.log('\n💡 If still seeing 5m/15m data:');
console.log('  1. The app may need a manual restart');
console.log('  2. Check if tsx watch detected the changes');
console.log('  3. Kill and restart: pkill -f tsx && npm run dev');