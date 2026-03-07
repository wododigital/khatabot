/**
 * Message Flow Service
 * Orchestrates the complete message processing pipeline:
 * 1. Deduplication check (Gate A)
 * 2. Classification
 * 3. AI extraction via Claude
 * 4. Contact fuzzy matching
 * 5. Transaction saving to database
 * All errors are caught and logged - no crashes
 */

import pino from 'pino';
import type { ClassifiedMessage, EnrichedExtraction, Transaction } from '@/types/index.js';
import { checkDuplicate } from './dedup.js';
import { parseMessage } from './ai-parser.js';
import { matchContact } from './contact-matcher.js';
import { saveTransaction } from './transaction-saver.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: false },
  },
});

export interface ProcessingResult {
  success: boolean;
  transactionId?: string;
  isDuplicate?: boolean;
  error?: string;
  stage?: string;
}

/**
 * Process a classified message through the complete pipeline
 * Gate A: Deduplication check - drop if duplicate
 * Stages: Parse -> Match Contact -> Save Transaction
 *
 * @param classifiedMessage - Message from WhatsApp listener
 * @param groupId - Database group ID
 * @returns Result with transaction ID or error details
 */
export async function processMessage(
  classifiedMessage: ClassifiedMessage,
  groupId: string
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    logger.info(
      {
        messageId: classifiedMessage.wa_message_id,
        groupId,
        type: classifiedMessage.message_type,
      },
      'Starting message processing pipeline'
    );

    // === GATE A: DEDUPLICATION CHECK ===
    // Checked first because it's the cheapest operation
    const dupCheck = await checkDuplicate(classifiedMessage);

    if (dupCheck.isDuplicate) {
      logger.info(
        {
          messageId: classifiedMessage.wa_message_id,
          reason: dupCheck.reason,
          candidates: dupCheck.candidateIds?.length,
        },
        'Message rejected: duplicate'
      );
      return {
        success: false,
        isDuplicate: true,
        error: dupCheck.reason,
        stage: 'deduplication',
      };
    }

    // === STAGE 1: CLAUDE EXTRACTION ===
    const extraction = await parseMessage(classifiedMessage);

    if (!extraction) {
      logger.debug(
        { messageId: classifiedMessage.wa_message_id },
        'No extraction result, skipping transaction'
      );
      return {
        success: false,
        error: 'Failed to extract transaction data',
        stage: 'extraction',
      };
    }

    // === STAGE 2: CONTACT MATCHING ===
    // Attempt fuzzy match but don't fail if no match found
    let contactMatch = null;
    try {
      contactMatch = await matchContact(extraction.transaction.person_name, 0.8);
      if (contactMatch) {
        extraction.matched_contact = contactMatch.contact;
        extraction.matched_contact_confidence = contactMatch.confidence;
        logger.debug(
          {
            extractedName: extraction.transaction.person_name,
            matchedContactId: contactMatch.contactId,
            confidence: Number(contactMatch.confidence.toFixed(2)),
          },
          'Contact matched'
        );
      }
    } catch (matchError) {
      // Log but continue - transaction can proceed without contact match
      const err =
        matchError instanceof Error ? matchError.message : String(matchError);
      logger.warn({ error: err }, 'Contact matching failed, continuing');
    }

    // === STAGE 3: TRANSACTION SAVE ===
    const transaction = await saveTransaction(
      extraction,
      classifiedMessage.wa_message_id,
      groupId
    );

    if (!transaction) {
      logger.warn(
        { messageId: classifiedMessage.wa_message_id },
        'Transaction save failed'
      );
      return {
        success: false,
        error: 'Failed to save transaction',
        stage: 'save',
      };
    }

    const duration = Date.now() - startTime;
    logger.info(
      {
        transactionId: transaction.id,
        amount: transaction.amount,
        person: transaction.person_name,
        contacted: !!contactMatch,
        durationMs: duration,
      },
      'Message processed successfully'
    );

    return {
      success: true,
      transactionId: transaction.id,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      {
        messageId: classifiedMessage.wa_message_id,
        error: message,
        durationMs: duration,
      },
      'Message processing pipeline error'
    );

    return {
      success: false,
      error: message,
      stage: 'unknown',
    };
  }
}
