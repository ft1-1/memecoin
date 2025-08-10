#!/usr/bin/env node

/**
 * Simple Discord webhook test without full TypeScript compilation
 */

const axios = require('axios');

async function testDiscordWebhook() {
  console.log('🔍 Testing Discord webhook connectivity...\n');

  // Check environment variable
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error('❌ DISCORD_WEBHOOK_URL environment variable not set');
    console.log('💡 Please set the DISCORD_WEBHOOK_URL environment variable');
    process.exit(1);
  }

  // Validate webhook URL format
  console.log('🔗 1. Validating webhook URL format...');
  try {
    const url = new URL(webhookUrl);
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

  // Test webhook connectivity
  console.log('\n🚀 2. Testing webhook connectivity...');
  
  const testMessage = {
    content: '🤖 **Memecoin Analyzer - Discord Test**',
    embeds: [{
      color: 0x00ff00,
      title: '✅ System Health Check',
      description: 'Discord webhook connection verified successfully',
      fields: [
        {
          name: '🔧 Test Status',
          value: 'All systems operational',
          inline: true
        },
        {
          name: '⏰ Timestamp',
          value: new Date().toLocaleString(),
          inline: true
        },
        {
          name: '📊 Next Steps',
          value: 'Ready to receive high-rated token alerts (7+)',
          inline: false
        }
      ],
      footer: {
        text: 'Memecoin Analyzer • Health Check',
        icon_url: 'https://cdn.discordapp.com/assets/logo.png'
      },
      timestamp: new Date().toISOString()
    }]
  };

  try {
    const response = await axios.post(webhookUrl, testMessage, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Memecoin Analyzer Bot/1.0'
      },
      timeout: 10000
    });

    console.log('✅ Test message sent successfully');
    console.log(`   - Status Code: ${response.status}`);
    console.log(`   - Rate Limit Remaining: ${response.headers['x-ratelimit-remaining'] || 'N/A'}`);
    console.log(`   - Rate Limit Reset: ${response.headers['x-ratelimit-reset'] || 'N/A'}`);

    // Test a high-rated token alert format
    console.log('\n📨 3. Testing token alert format...');
    
    const tokenAlert = {
      content: '🚀 **High-Potential Memecoin Alert**',
      embeds: [{
        color: 0x00ff00,
        title: '🚀 Test Token (TEST)',
        url: 'https://dexscreener.com/solana/test-address',
        description: '**High-Potential Memecoin Alert** 🟢📈\nStrong momentum detected with excellent entry opportunity',
        thumbnail: {
          url: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
        },
        fields: [
          {
            name: '⭐ Rating',
            value: '**8.5/10** ⭐⭐⭐⭐\nConfidence: 87%',
            inline: true
          },
          {
            name: '💰 Price',
            value: '$0.001234\n+15.67% 📈',
            inline: true
          },
          {
            name: '📊 Market Data',
            value: 'Cap: $12.5M\nVol: $850.0K',
            inline: true
          },
          {
            name: '🟢🚀 Entry Signal',
            value: '**STRONG BUY** (85.2/100)\n**Confidence:** 82.1%\n**Position Size:** 5.0%\n**Max Slippage:** 2.0%\n**Time Horizon:** short\n**Top Reasons:**\n• Volume breakout\n• Technical momentum',
            inline: false
          },
          {
            name: '⚡ Momentum Analysis',
            value: '**Sustainability:** 75.5/100\n**Entry Strength:** 82.1/100\n**Fatigue:** 🟡 mild\n**Consecutive:** 5 🟢 candles',
            inline: false
          },
          {
            name: '📈 Technical Analysis',
            value: '**Trend:** Bullish Breakout\n**RSI:** 65.4 (Neutral)\n**Volume Spike**\n**Patterns:** Bull Flag, Volume Confirmation',
            inline: false
          },
          {
            name: '🟡 Risk Assessment',
            value: '**MEDIUM** (35/100)\nNew token - limited history\nHigh volatility expected',
            inline: false
          },
          {
            name: '🔥 Key Highlights',
            value: 'High volume surge detected\nTechnical indicators showing bullish divergence\nSocial sentiment strongly positive',
            inline: false
          }
        ],
        footer: {
          text: 'Memecoin Analyzer • Data freshness: Live',
          icon_url: 'https://cdn.discordapp.com/assets/logo.png'
        },
        timestamp: new Date().toISOString()
      }]
    };

    const alertResponse = await axios.post(webhookUrl, tokenAlert, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Memecoin Analyzer Bot/1.0'
      },
      timeout: 10000
    });

    console.log('✅ Token alert test sent successfully');
    console.log(`   - Status Code: ${alertResponse.status}`);
    console.log(`   - Rate Limit Remaining: ${alertResponse.headers['x-ratelimit-remaining'] || 'N/A'}`);

  } catch (error) {
    console.error('❌ Discord webhook test failed:');
    
    if (error.response) {
      console.error(`   - Status Code: ${error.response.status}`);
      console.error(`   - Status Text: ${error.response.statusText}`);
      console.error(`   - Response Data:`, error.response.data);
      
      if (error.response.status === 404) {
        console.log('💡 Webhook not found - check the webhook URL');
      } else if (error.response.status === 400) {
        console.log('💡 Bad request - check message format');
      } else if (error.response.status === 429) {
        console.log('💡 Rate limited - wait before retrying');
      }
      
    } else if (error.request) {
      console.error('   - Network error:', error.message);
      console.log('💡 Check internet connection and firewall settings');
    } else {
      console.error('   - Error:', error.message);
    }
    
    process.exit(1);
  }

  // Final status
  console.log('\n🎯 Discord Test Summary:');
  console.log('========================');
  console.log('✅ Discord notification system is HEALTHY');
  console.log('💡 Ready to send high-rated token alerts (7+)');
  console.log('🔗 Webhook URL format is valid');
  console.log('📡 Connectivity test passed');
  console.log('📨 Message format test passed');
  
  console.log('\n📋 Health Check Endpoints Available:');
  console.log('   - GET /health - Overall system health');
  console.log('   - GET /health/discord - Discord-specific health');
  console.log('   - GET /health/components - All component health');
  console.log('   - GET /ready - Readiness probe');
  console.log('   - GET /live - Liveness probe');
}

if (require.main === module) {
  testDiscordWebhook();
}