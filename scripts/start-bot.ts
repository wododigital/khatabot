/**
 * Bot entry point - called by Railway process manager
 * Starts Baileys WhatsApp bot and handles graceful shutdown
 * Handles SIGTERM/SIGINT for Railway deployment
 */

import process from 'process';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: false },
  },
});

let shutdownInProgress = false;

async function main(): Promise<void> {
  try {
    // Dynamic import to avoid loading bot code in Next.js builds
    const { startBot, shutdownBot } = await import('../src/bot/index.js');

    // Start the bot
    await startBot();

    // Periodically check health (placeholder for connection monitoring)
    const healthInterval = setInterval(() => {
      logger.debug('Bot health check: running');
    }, 60000); // Every minute

    // Setup graceful shutdown handlers
    const handleShutdown = async (signal: string) => {
      if (shutdownInProgress) {
        logger.info('Shutdown already in progress, ignoring signal');
        return;
      }

      shutdownInProgress = true;
      logger.info({ signal }, 'Received shutdown signal');

      clearInterval(healthInterval);

      try {
        await shutdownBot();
        logger.info('Bot shutdown successfully');
        process.exit(0);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled promise rejection');
      process.exit(1);
    });

    logger.info('Bot process started successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Failed to start bot');
    process.exit(1);
  }
}

void main();
