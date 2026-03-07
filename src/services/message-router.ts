/**
 * Message Router
 * Routes classified messages to appropriate service handlers
 * Entry point for entire message processing pipeline
 */

import pino from 'pino';
import type { ClassifiedMessage } from '@/types/index.js';
import { processMessage } from './message-flow.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: false } } }
    : {}),
});

/**
 * Route message to appropriate service based on type
 * Text and images go through the complete pipeline (dedup -> extract -> match -> save)
 * Documents and other types are skipped
 *
 * @param message - Classified message with text/image content
 * @param groupId - Database group ID for context
 */
export async function routeMessage(
  message: ClassifiedMessage,
  groupId: string
): Promise<void> {
  try {
    logger.debug(
      { messageType: message.message_type, groupId },
      'Routing message'
    );

    switch (message.message_type) {
      case 'text':
      case 'image': {
        // Route to complete message processing pipeline
        // (dedup -> extract -> match -> save)
        const result = await processMessage(message, groupId);

        if (!result.success) {
          logger.debug(
            {
              messageId: message.wa_message_id,
              error: result.error,
              stage: result.stage,
              isDuplicate: result.isDuplicate,
            },
            'Message processing failed'
          );
        } else {
          logger.info(
            { messageId: message.wa_message_id, transactionId: result.transactionId },
            'Message processed and saved'
          );
        }
        break;
      }

      case 'document': {
        logger.debug({ groupId }, 'Skipping document message');
        break;
      }

      case 'irrelevant': {
        logger.debug({ groupId }, 'Skipping irrelevant message');
        break;
      }

      default: {
        const exhaustiveCheck: never = message.message_type;
        logger.warn(
          { type: exhaustiveCheck, groupId },
          'Unknown message type'
        );
      }
    }
  } catch (error) {
    const message_err = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: message_err, messageId: message.wa_message_id, groupId },
      'Failed to route message'
    );
  }
}
