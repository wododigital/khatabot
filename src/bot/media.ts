/**
 * Media Handler
 * Download and decrypt media from WhatsApp messages
 * Returns buffer with MIME type for AI processing
 */

import type { proto, WASocket } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: false },
  },
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

/**
 * Download media from a WhatsApp message
 * Handles image, video, and document messages with size validation
 *
 * @param message - Baileys message object
 * @param socket - WASocket instance for download
 * @returns Object with buffer, mimeType, and filename, or null if download fails
 */
export async function downloadMedia(
  message: proto.IWebMessageInfo,
  socket: WASocket
): Promise<DownloadedMedia | null> {
  try {
    if (!message.message) {
      logger.debug('Message has no media content');
      return null;
    }

    // Determine message type and extract media info
    const imageMessage = message.message.imageMessage;
    const documentMessage = message.message.documentMessage;
    const videoMessage = message.message.videoMessage;

    if (!imageMessage && !documentMessage && !videoMessage) {
      logger.debug('Message is not image, video, or document');
      return null;
    }

    // Extract MIME type and filename
    let mimeType = imageMessage?.mimetype ||
      documentMessage?.mimetype ||
      videoMessage?.mimetype || 'application/octet-stream';

    let filename = `media-${message.key?.id}`;
    if (documentMessage?.fileName) {
      filename = documentMessage.fileName;
    } else if (imageMessage) {
      filename = `image-${message.key?.id}.jpg`;
    } else if (videoMessage) {
      filename = `video-${message.key?.id}.mp4`;
    }

    logger.debug(
      { messageId: message.key?.id, mimeType, filename },
      'Downloading media'
    );

    // Download media using Baileys
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger,
        reuploadRequest: socket.updateMediaMessage,
      } as any
    );

    if (!buffer) {
      logger.warn(
        { messageId: message.key?.id },
        'Download returned empty buffer'
      );
      return null;
    }

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      logger.error(
        { messageId: message.key?.id, size: buffer.length, max: MAX_FILE_SIZE },
        'File too large'
      );
      return null;
    }

    logger.debug(
      { messageId: message.key?.id, mimeType, size: buffer.length },
      'Media downloaded successfully'
    );
    return { buffer, mimeType, filename };
  } catch (error) {
    const message_err = error instanceof Error ? error.message : String(error);
    logger.error(
      { messageId: message.key?.id, error: message_err },
      'Failed to download media'
    );
    return null;
  }
}
