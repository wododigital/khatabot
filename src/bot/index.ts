/**
 * Baileys Bot Initialization
 * WhatsApp multi-device client setup, QR code generation
 * Connection lifecycle management
 */

import { makeWASocket, DisconnectReason } from '@whiskeysockets/baileys';
import { useSupabaseAuthState } from './session-store.js';
import { setupMessageListener } from './listener.js';
import { createServerClient } from '@/lib/supabase/server.js';
import pino from 'pino';
import qrcode from 'qrcode';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: false } } }
    : {}),
});

let socket: ReturnType<typeof makeWASocket> | null = null;
let isShuttingDown = false;
// Session start time tracked via DB created_at

/**
 * Initialize Baileys WhatsApp socket
 * Setup QR code generation and connection lifecycle
 */
export async function startBot(): Promise<void> {
  try {
    // Clean up previous socket listeners on reconnect
    if (socket) {
      socket.ev.removeAllListeners('connection.update');
      socket.ev.removeAllListeners('creds.update');
      socket.ev.removeAllListeners('messages.upsert');
      try { socket.ws?.close(); } catch {}
    }

    const sessionId = process.env.BOT_SESSION_ID || 'khatabot-primary';

    logger.info({ sessionId }, 'Starting WhatsApp bot...');

    // Get auth state from Supabase
    const { state, saveCreds, clearState } = await useSupabaseAuthState(
      sessionId
    );

    // Create Baileys socket
    socket = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: false, // Handle QR manually
      syncFullHistory: false, // Don't sync full history on reconnect
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      browser: ['KhataBot', 'Chrome', '120.0.0.0'],
    });

    // Handle QR code
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('QR code generated, scan with WhatsApp:');
        try {
          // Generate ASCII QR code for terminal
          const ascii = await qrcode.toString(qr, { type: 'terminal' });
          console.log(ascii);

          // Generate PNG buffer and save to database
          try {
            const pngBuffer = await qrcode.toBuffer(qr, {
              errorCorrectionLevel: 'H',
              type: 'png',
              width: 300,
              margin: 1,
              color: {
                dark: '#000000',
                light: '#FFFFFF',
              },
            });

            // Save to bot_sessions
            const db = createServerClient() as any;

            await db
              .from('bot_sessions')
              .update({
                qr_code_png: pngBuffer,
                qr_pending: true,
                updated_at: new Date().toISOString(),
              })
              .eq('session_id', sessionId);

            logger.info({ sessionId }, 'QR code PNG saved to database');
          } catch (qrDbError) {
            const err =
              qrDbError instanceof Error ? qrDbError.message : String(qrDbError);
            logger.error(
              { error: err },
              'Failed to save QR code to database'
            );
          }
        } catch (err) {
          logger.warn('Failed to generate ASCII QR, logging raw data');
          console.log('QR:', qr);
        }
      }

      if (connection === 'connecting') {
        logger.info('Connecting to WhatsApp...');
      } else if (connection === 'open') {
        logger.info('Connected to WhatsApp successfully!');

        // Clear QR code and mark as connected
        try {
          const db = createServerClient() as any;
          const sid = process.env.BOT_SESSION_ID || 'khatabot-primary';

          await db
            .from('bot_sessions')
            .update({
              qr_code_png: null,
              qr_pending: false,
              updated_at: new Date().toISOString(),
            })
            .eq('session_id', sid);

          logger.info({ sessionId: sid }, 'QR cleared, bot marked as connected');
        } catch (clearError) {
          const err =
            clearError instanceof Error ? clearError.message : String(clearError);
          logger.warn({ error: err }, 'Failed to clear QR code');
        }

        // Auto-discover WhatsApp groups and upsert into DB
        try {
          if (socket) {
            const groups = await socket.groupFetchAllParticipating();
            const { upsertGroupServer } = await import('@/lib/supabase/queries.js');
            let discovered = 0;
            for (const [jid, meta] of Object.entries(groups)) {
              try {
                await upsertGroupServer({
                  wa_group_jid: jid,
                  name: meta.subject || jid,
                });
                discovered++;
              } catch (e) {
                logger.debug({ jid, error: String(e) }, 'Failed to upsert group');
              }
            }
            logger.info({ discovered, total: Object.keys(groups).length }, 'WhatsApp groups discovered and saved to DB');
          }
        } catch (discoverError) {
          const err = discoverError instanceof Error ? discoverError.message : String(discoverError);
          logger.warn({ error: err }, 'Failed to discover WhatsApp groups');
        }
      } else if (connection === 'close') {
        // Check if disconnect was expected or due to auth error
        const reason = lastDisconnect?.error as any;
        const shouldReconnect = reason?.output?.statusCode !==
          DisconnectReason.loggedOut && reason?.output?.statusCode !==
          DisconnectReason.forbidden;

        logger.error(
          {
            statusCode: reason?.output?.statusCode,
            shouldReconnect,
          },
          `Connection closed: ${DisconnectReason[reason?.output?.statusCode]}`
        );

        // Clear session if logged out explicitly
        if (reason?.output?.statusCode === DisconnectReason.loggedOut) {
          logger.info('User logged out, clearing session');
          await clearState();
        }

        // Attempt reconnection
        if (shouldReconnect && !isShuttingDown) {
          logger.info('Reconnecting in 5 seconds...');
          setTimeout(() => {
            startBot().catch((err) => {
              logger.error(err, 'Failed to restart bot');
              process.exit(1);
            });
          }, 5000);
        }
      }
    });

    // Save credentials whenever they update
    socket.ev.on('creds.update', saveCreds);

    // Setup message listener
    setupMessageListener(socket);

    logger.info({ sessionId }, 'Bot initialization complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Failed to start bot');
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
export async function shutdownBot(): Promise<void> {
  if (isShuttingDown) {
    logger.info('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info('Shutting down bot...');

  try {
    if (socket) {
      socket.ws?.close();
      socket.end(undefined);
      logger.info('Socket closed');
    }

    logger.info('Bot shutdown complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Error during shutdown');
  }
}
