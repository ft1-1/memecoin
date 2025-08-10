#!/usr/bin/env node

/**
 * Discord Health Check Test Script
 * Tests Discord webhook connectivity and notification system health
 */

const { ConfigManager } = require('./src/config/ConfigManager');
const { Logger } = require('./src/utils/Logger');
const { createMemecoinNotificationSystemComponent } = require('./src/notifications/discord/DiscordNotificationSystemComponent');

async function testDiscordHealth() {
  const logger = Logger.getInstance();
  console.log('🔍 Testing Discord notification system health...\n');

  try {
    // Initialize configuration
    console.log('📋 1. Loading configuration...');
    const configManager = new ConfigManager(logger);
    const config = await configManager.initialize();
    
    if (!config.notifications?.discord?.webhookUrl) {
      console.error('❌ DISCORD_WEBHOOK_URL not configured');
      console.log('💡 Please set the DISCORD_WEBHOOK_URL environment variable');
      process.exit(1);
    }

    console.log('✅ Configuration loaded successfully');
    console.log(`   - Webhook URL: ${config.notifications.discord.webhookUrl.replace(/\/[^/]+\/[^/]+$/, '/***masked***/***masked***')}`);
    
    // Test webhook URL validation
    console.log('\n🔗 2. Testing webhook URL validation...');
    try {
      const url = new URL(config.notifications.discord.webhookUrl);
      console.log(`   - Protocol: ${url.protocol}`);
      console.log(`   - Hostname: ${url.hostname}`);
      console.log(`   - Path: ${url.pathname.replace(/\/\d+\/[^/]+$/, '/***masked***/***masked***')}`);
      
      const isValidFormat = 
        url.protocol === 'https:' && 
        ['discord.com', 'discordapp.com'].includes(url.hostname) &&
        url.pathname.startsWith('/api/webhooks/');
        
      if (isValidFormat) {
        console.log('✅ Webhook URL format is valid');
      } else {
        console.log('❌ Webhook URL format is invalid');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Webhook URL parsing failed:', error.message);
      process.exit(1);
    }

    // Create Discord notification component
    console.log('\n🤖 3. Creating Discord notification component...');
    const discordComponent = createMemecoinNotificationSystemComponent(
      config.notifications.discord.webhookUrl,
      logger,
      {
        testMode: true,
        enableHealthChecks: true,
        minRating: 7
      }
    );

    console.log('✅ Discord component created');

    // Initialize component
    console.log('\n🚀 4. Initializing Discord component...');
    await discordComponent.initialize();
    console.log('✅ Discord component initialized');

    // Start component
    console.log('\n▶️  5. Starting Discord component...');
    await discordComponent.start();
    console.log('✅ Discord component started');

    // Test webhook connectivity
    console.log('\n🔌 6. Testing webhook connectivity...');
    const service = discordComponent.getService();
    const isWebhookValid = await service.validateConfig();
    
    if (isWebhookValid) {
      console.log('✅ Webhook connectivity test passed');
    } else {
      console.log('❌ Webhook connectivity test failed');
      console.log('💡 Check webhook URL and Discord server permissions');
    }

    // Get component health status
    console.log('\n🏥 7. Checking component health...');
    const health = await discordComponent.getHealth();
    console.log(`   - Status: ${health.status}`);
    console.log(`   - Message: ${health.message}`);
    console.log(`   - Response Time: ${health.responseTime}ms`);
    
    if (health.metadata) {
      console.log('   - Metadata:');
      if (health.metadata.rateLimitRemaining) {
        console.log(`     • Rate Limit Remaining: ${health.metadata.rateLimitRemaining}`);
      }
      if (health.metadata.lastError) {
        console.log(`     • Last Error: ${health.metadata.lastError.message}`);
      }
    }

    // Get service statistics
    console.log('\n📊 8. Getting service statistics...');
    const stats = await discordComponent.getServiceStats();
    if (stats) {
      console.log('   - Service Stats:');
      console.log(`     • Webhook Status: ${stats.webhook.healthy ? 'Healthy' : 'Unhealthy'}`);
      console.log(`     • Queue Pending: ${stats.queue.pending}`);
      console.log(`     • Queue Processing: ${stats.queue.processing}`);
      console.log(`     • Total Messages Sent: ${stats.performance.totalMessagesSent}`);
      console.log(`     • Success Rate: ${(stats.performance.successRate * 100).toFixed(1)}%`);
      console.log(`     • Average Latency: ${stats.performance.averageLatency.toFixed(1)}ms`);
    }

    // Test sending a notification
    console.log('\n📨 9. Testing notification sending...');
    const testTokenData = {
      token: {
        address: 'test-address-12345',
        name: 'Test Memecoin',
        symbol: 'TEST',
        price: 0.001234,
        priceChange24h: 15.67,
        marketCap: 12500000,
        volume24h: 850000,
        image: null
      },
      rating: {
        score: 8.5,
        confidence: 87,
        recommendation: 'Strong momentum detected with excellent entry opportunity',
        alerts: [
          'High volume surge detected',
          'Technical indicators showing bullish divergence',
          'Social sentiment strongly positive'
        ]
      },
      technicalAnalysis: {
        trend: 'Bullish Breakout',
        rsi: 65.4,
        volumeSpike: true,
        patterns: ['Bull Flag', 'Volume Confirmation']
      },
      risk: {
        level: 'medium',
        score: 35,
        warnings: ['New token - limited history', 'High volatility expected']
      },
      entrySignal: {
        type: 'strong_buy',
        score: 85.2,
        confidence: 82.1,
        reasons: ['Volume breakout', 'Technical momentum'],
        entry: {
          positionSize: 0.05,
          maxSlippage: 0.02,
          timeHorizon: 'short'
        }
      },
      momentumAcceleration: {
        sustainabilityScore: 75.5,
        entrySignalStrength: 82.1,
        fatigueLevel: 'mild',
        consecutiveCandles: {
          count: 5,
          direction: 'bullish'
        }
      }
    };

    const result = await discordComponent.sendTokenAlert(testTokenData);
    
    if (result.success) {
      console.log('✅ Test notification sent successfully');
      console.log(`   - Message ID: ${result.messageId}`);
      if (result.metadata) {
        console.log(`   - Response Status: ${result.metadata.responseStatus}`);
        console.log(`   - Rate Limit Remaining: ${result.metadata.rateLimitRemaining}`);
      }
    } else {
      console.log('❌ Test notification failed');
      if (result.error) {
        console.log(`   - Error: ${result.error.message}`);
        console.log(`   - Code: ${result.error.code}`);
        console.log(`   - Retryable: ${result.error.retryable}`);
      }
    }

    // Cleanup
    console.log('\n🧹 10. Cleaning up...');
    await discordComponent.stop();
    await discordComponent.destroy();
    console.log('✅ Cleanup completed');

    // Final assessment
    console.log('\n🎯 Health Check Summary:');
    console.log('========================');
    
    const overallHealthy = health.status === 'healthy' && isWebhookValid && result.success;
    
    if (overallHealthy) {
      console.log('✅ Discord notification system is HEALTHY');
      console.log('💡 System ready to send high-rated token alerts (7+)');
    } else {
      console.log('❌ Discord notification system has ISSUES');
      console.log('💡 Review the errors above and fix configuration');
      
      if (!isWebhookValid) {
        console.log('   - Fix webhook URL and permissions');
      }
      if (health.status !== 'healthy') {
        console.log('   - Address component health issues');
      }
      if (!result.success) {
        console.log('   - Fix notification sending problems');
      }
    }

    process.exit(overallHealthy ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Health check failed with exception:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the health check
if (require.main === module) {
  testDiscordHealth();
}

module.exports = { testDiscordHealth };