import * as winston from 'winston';
import * as chalk from 'chalk';

/**
 * Simple, human-readable console formatter for production use
 */
export class ConsoleFormatter {
  /**
   * Create a simplified console format for Winston
   */
  static createSimpleFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf((info: winston.Logform.TransformableInfo): string => {
        const { timestamp, level, message, ...meta } = info;
        const msg = String(message);
        
        // Skip verbose debug and silly logs
        if (level === 'debug' || level === 'silly' || level === 'verbose') {
          return '';
        }

        // Format based on the type of activity
        const activity = meta.activity || meta.action || '';
        
        // High-level activity messages
        if (activity === 'CYCLE_START') {
          return chalk.cyan('\n' + '='.repeat(60) + '\n' + 
            `🚀 Starting Analysis Cycle #${meta.cycleNumber || 'N/A'} at ${timestamp}\n` +
            '='.repeat(60));
        }
        
        if (activity === 'CYCLE_COMPLETE') {
          let summary = chalk.green('\n✅ Analysis Cycle Complete\n' +
            `   • Tokens analyzed: ${meta.tokensAnalyzed || 0}\n` +
            `   • High-rated tokens (≥7): ${meta.highRatedTokens || 0}\n` +
            `   • Notifications sent: ${meta.notificationsSent || 0}\n` +
            `   • Duration: ${meta.duration || 'N/A'}\n`);
          
          // Add rating distribution if available
          if (meta.ratingDistribution) {
            const totalTokens = meta.totalTokensRated || Object.values(meta.ratingDistribution).reduce((sum: number, count: any) => sum + count, 0);
            summary += chalk.gray(`\n   📊 Cumulative Rating Distribution (${totalTokens} total tokens across ${meta.cycleNumber || '?'} cycles):\n`);
            for (let i = 10; i >= 1; i--) {
              const count = meta.ratingDistribution[i] || 0;
              if (count > 0) {
                const bar = '█'.repeat(Math.min(count, 20));
                const color = i >= 7 ? chalk.green : i >= 5 ? chalk.yellow : chalk.gray;
                summary += color(`   ${String(i).padStart(2)}/10: ${String(count).padStart(3)} ${bar}`);
                if (i === 7) {
                  summary += chalk.green(' ← Notification threshold');
                }
                summary += '\n';
              }
            }
          }
          
          return summary;
        }

        if (activity === 'FETCHING_TOKENS') {
          return chalk.blue(`⬇️  Fetching trending tokens from Solana...`);
        }

        if (activity === 'TOKENS_FETCHED') {
          return chalk.blue(`   ✓ Found ${meta.count || 0} trending tokens`);
        }

        if (activity === 'ANALYZING_TOKENS') {
          return chalk.yellow(`🔍 Analyzing ${meta.count || 0} tokens (this may take a moment)...\n` +
            chalk.gray(`   Notification threshold: ≥7.0/10`));
        }

        if (activity === 'TOKEN_ANALYZED') {
          const rating = Number(meta.rating) || 0;
          const symbol = meta.symbol || 'UNKNOWN';
          const ratingColor = rating >= 7 ? chalk.green : rating >= 5 ? chalk.yellow : chalk.gray;
          
          // Basic rating display
          let output = ratingColor(`   • ${symbol}: ${rating}/10`);
          
          // Add breakdown if available
          if (meta.breakdown) {
            const tech = meta.breakdown.technical || 0;
            const mom = meta.breakdown.momentum || 0;
            const vol = meta.breakdown.volume || 0;
            const risk = meta.breakdown.risk || 0;
            const ai = meta.breakdown.ai || 0;
            
            output += chalk.gray(` (Tech:${tech} Mom:${mom} Vol:${vol} Risk:${risk}`);
            if (ai > 0) {
              output += chalk.cyan(` AI:${ai}`);
            }
            output += chalk.gray(')');
          }
          
          // Add notification indicator
          if (rating >= 7) {
            output += chalk.green(' ✓ Will notify');
          } else if (rating >= 6.5) {
            output += chalk.yellow(' ⚡ Close to threshold');
          }
          
          return output;
        }

        if (activity === 'HIGH_RATED_TOKEN') {
          return chalk.green.bold(`🌟 HIGH RATING: ${meta.symbol} scored ${meta.rating}/10!`);
        }

        if (activity === 'SENDING_NOTIFICATION') {
          return chalk.magenta(`📤 Sending Discord alert for ${meta.symbol} (${meta.rating}/10)`);
        }

        if (activity === 'NOTIFICATION_SENT') {
          return chalk.magenta(`   ✓ Alert sent successfully`);
        }

        if (activity === 'AI_ANALYSIS') {
          return chalk.cyan(`🤖 Getting AI analysis for ${meta.symbol}...`);
        }

        if (activity === 'WAITING') {
          return chalk.gray(`⏳ Waiting for next cycle... (${meta.nextRun || 'N/A'})`);
        }

        if (activity === 'HEALTH_CHECK') {
          const status = meta.status || 'unknown';
          const statusIcon = status === 'healthy' ? '💚' : status === 'degraded' ? '💛' : '❤️';
          return chalk.gray(`${statusIcon} System health: ${status}`);
        }
        
        if (activity === 'RATING_DISTRIBUTION' && meta.ratingDistribution) {
          const isCumulative = meta.isCumulative || false;
          const totalTokens = meta.totalTokensRated || Object.values(meta.ratingDistribution).reduce((sum: number, count: any) => sum + count, 0);
          
          let output = isCumulative 
            ? chalk.cyan(`\n📊 Cumulative Rating Distribution (${totalTokens} total tokens):\n`)
            : chalk.cyan(`\n📊 Current Cycle Rating Distribution:\n`);
          
          for (let i = 10; i >= 1; i--) {
            const count = meta.ratingDistribution[i] || 0;
            if (count > 0) {
              const bar = '█'.repeat(Math.min(count, 20));
              const color = i >= 7 ? chalk.green : i >= 5 ? chalk.yellow : chalk.gray;
              output += color(`   ${String(i).padStart(2)}/10: ${String(count).padStart(3)} ${bar}`);
              if (i === 7) {
                output += chalk.green(' ← Notification threshold');
              }
              output += '\n';
            }
          }
          
          return output;
        }

        // Error handling
        if (level === 'error') {
          // Only show user-friendly errors
          if (meta.userFriendly) {
            return chalk.red(`❌ ${msg}`);
          }
          // Skip technical errors in simple mode
          return '';
        }

        // Warning handling
        if (level === 'warn') {
          // Only show important warnings
          if (meta.important || msg.includes('Discord') || msg.includes('API')) {
            return chalk.yellow(`⚠️  ${msg}`);
          }
          return '';
        }

        // Info messages - filter for important ones
        if (level === 'info') {
          // Skip technical info unless marked as important
          if (meta.technical && !meta.important) {
            return '';
          }

          // Show simplified versions of common messages
          if (msg.includes('Parallel token processing completed')) {
            return chalk.blue(`   ✓ Analysis complete (${meta.successfulAnalyses}/${meta.totalTokens} successful)`);
          }

          if (msg.includes('System started successfully')) {
            return chalk.green.bold('\n🎉 Memecoin Analyzer Started Successfully!\n');
          }

          if (msg.includes('Shutting down')) {
            return chalk.yellow('\n👋 Shutting down gracefully...\n');
          }

          // Default info - only if not technical
          if (!meta.technical) {
            return chalk.white(`ℹ️  ${msg}`);
          }
        }

        return '';
      })
    );
  }

  /**
   * Create a detailed format for development/debugging
   */
  static createDetailedFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    );
  }
}

/**
 * Helper to determine if we should use simple or detailed logging
 */
export function shouldUseSimpleLogging(): boolean {
  const logFormat = process.env.LOG_FORMAT || 'simple';
  const nodeEnv = process.env.NODE_ENV || 'production';
  
  // Use simple logging in production or when explicitly set
  return logFormat === 'simple' || (logFormat !== 'detailed' && nodeEnv === 'production');
}