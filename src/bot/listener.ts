/**
 * Message Listener
 * Handles incoming WhatsApp messages from Baileys
 * Routes to appropriate service based on message type and content
 */

import { createServerClient } from '@/lib/supabase/server.js';
import pino from 'pino';
import type { proto, WASocket } from '@whiskeysockets/baileys';
import { downloadMedia } from './media.js';
import type { ClassifiedMessage, MessageType } from '@/types/index.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: false },
  },
});

/**
 * Classify incoming message as text, image, document, or irrelevant
 */
function classifyMessage(
  message: proto.IWebMessageInfo
): MessageType | null {
  if (!message.message) {
    return null;
  }

  if (message.message.conversation || message.message.extendedTextMessage?.text) {
    return 'text';
  }

  if (message.message.imageMessage) {
    return 'image';
  }

  if (message.message.documentMessage) {
    return 'document';
  }

  // Skip other message types (stickers, audio, reactions, etc.)
  return null;
}

/**
 * Extract text content from message
 */
function extractTextContent(message: proto.IWebMessageInfo): string {
  if (message.message?.conversation) {
    return message.message.conversation;
  }

  if (message.message?.extendedTextMessage?.text) {
    return message.message.extendedTextMessage.text;
  }

  if (message.message?.imageMessage?.caption) {
    return message.message.imageMessage.caption;
  }

  return '';
}

/**
 * Update bot session status (message count and last message time)
 */
async function updateBotSessionStatus(): Promise<void> {
  try {
    const db = createServerClient() as any;
    const sessionId = process.env.BOT_SESSION_ID || 'khatabot-primary';

    // Increment message counter and update last_message_at
    const { data: current } = await db
      .from('bot_sessions')
      .select('messages_processed')
      .eq('session_id', sessionId)
      .single();

    const newCount = (current?.messages_processed || 0) + 1;

    await db
      .from('bot_sessions')
      .update({
        messages_processed: newCount,
        last_message_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug({ error: message }, 'Failed to update bot session status');
  }
}

/**
 * Handle incoming WhatsApp message
 * Check registration, classify, extract, and route to services
 */
export async function handleMessageEvent(
  event: proto.IWebMessageInfo,
  socket: WASocket
): Promise<void> {
  try {
    // Skip messages from bot itself
    if (event.key?.fromMe) {
      logger.debug({ messageId: event.key?.id }, 'Skipping message from self');
      return;
    }

    // Extract group JID and ensure it's a group message
    const jid = event.key?.remoteJid;
    if (!jid || !jid.includes('@g.us')) {
      logger.debug({ jid }, 'Skipping non-group message');
      return;
    }

    // Classify message type
    const messageType = classifyMessage(event);
    if (!messageType) {
      logger.debug(
        { messageId: event.key?.id, jid },
        'Message type not actionable, skipping'
      );
      return;
    }

    // Check if group is registered and active
    const db = createServerClient() as any;
    const { data: group, error } = await db
      .from('groups')
      .select('id')
      .eq('wa_group_jid', jid)
      .eq('is_active', true)
      .single();

    if (error || !group) {
      logger.debug(
        { jid, messageId: event.key?.id },
        'Group not registered or inactive, skipping'
      );
      return;
    }

    logger.info(
      {
        messageId: event.key?.id,
        groupId: group.id,
        messageType,
        sender: event.pushName,
      },
      'Processing message'
    );

    // Build classified message
    // Baileys messageTimestamp is in seconds; normalize to milliseconds
    const rawTs = event.messageTimestamp
      ? typeof event.messageTimestamp === 'number'
        ? event.messageTimestamp
        : Number(event.messageTimestamp)
      : 0;
    const timestamp = rawTs > 0
      ? (rawTs < 1e12 ? rawTs * 1000 : rawTs) // seconds -> ms if needed
      : Date.now();

    const classifiedMessage: ClassifiedMessage = {
      original_jid: jid,
      message_type: messageType,
      text_content: extractTextContent(event),
      wa_message_id: event.key?.id || '',
      timestamp,
      sender_name: event.pushName || 'Unknown',
    };

    // Download media if image
    if (messageType === 'image' && event.message?.imageMessage) {
      const media = await downloadMedia(event, socket);
      if (media) {
        classifiedMessage.image_buffer = media.buffer;
        classifiedMessage.image_mime = media.mimeType;
      }
    }

    // Import message router service
    const { routeMessage } = await import('@/services/message-router.js');

    // Route to message processing pipeline
    await routeMessage(classifiedMessage, group.id);

    // Update bot session status
    await updateBotSessionStatus();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { messageId: event.key?.id, error: message },
      'Failed to handle message event'
    );
  }
}

/**
 * Setup WhatsApp message listener on Baileys socket
 */
export function setupMessageListener(socket: WASocket): void {
  socket.ev.on('messages.upsert', async (args) => {
    // Only process new messages, not history sync (type: 'notify')
    if (args.type === 'notify') {
      for (const msg of args.messages) {
        // Process each message sequentially to avoid race conditions
        await handleMessageEvent(msg, socket);
      }
    } else {
      logger.debug({ type: args.type }, 'Skipping history sync messages');
    }
  });

  logger.info('Message listener registered');
}
