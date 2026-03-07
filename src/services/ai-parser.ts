/**
 * AI Parser Service - Route and parse classified messages via Claude
 */

import PQueue from 'p-queue';
import pino from 'pino';
import {
  extractTransactionFromText,
  extractTransactionFromImage,
  type ClaudeExtractionResult,
} from '@/lib/ai/claude.js';
import type { ClassifiedMessage, EnrichedExtraction } from '@/types/index.js';

const logger = pino();

const queue = new PQueue({
  concurrency: 3,
  interval: 1000,
  intervalCap: 10,
});

export async function parseMessage(
  classifiedMessage: ClassifiedMessage
): Promise<EnrichedExtraction | null> {
  try {
    let result: ClaudeExtractionResult;

    if (classifiedMessage.message_type === 'text' && classifiedMessage.text_content) {
      logger.debug({ type: 'text' }, 'Parsing text');
      result = await queue.add(() =>
        extractTransactionFromText(classifiedMessage.text_content!)
      );
    } else if (
      classifiedMessage.message_type === 'image' &&
      classifiedMessage.image_buffer
    ) {
      logger.debug({ type: 'image' }, 'Parsing image');
      result = await queue.add(() =>
        extractTransactionFromImage(
          classifiedMessage.image_buffer!,
          classifiedMessage.image_mime || 'image/jpeg',
          classifiedMessage.text_content
        )
      );
    } else {
      logger.warn({ type: classifiedMessage.message_type }, 'Cannot parse');
      return null;
    }

    if (!result.is_transaction) {
      logger.debug('Not a transaction');
      return null;
    }

    if (result.confidence < 0.5) {
      logger.debug({ confidence: result.confidence }, 'Low confidence');
      return null;
    }

    if (!result.amount || !result.person) {
      logger.warn('Missing amount or person');
      return null;
    }

    const enriched: EnrichedExtraction = {
      transaction: {
        amount: result.amount,
        person_name: result.person,
        purpose: result.purpose || undefined,
        category: inferCategory(result.purpose),
        payment_mode: result.payment_mode || undefined,
        txn_date: result.date || undefined,
        txn_id: result.txn_id || undefined,
      },
      confidence: result.confidence,
      has_image_evidence: classifiedMessage.message_type === 'image',
      extracted_text: result.extracted_text,
      validation_notes: result.validation_notes,
    };

    logger.info(
      { amount: enriched.transaction.amount, category: enriched.transaction.category },
      'Parsed'
    );
    return enriched;
  } catch (error) {
    logger.error({ error: String(error) }, 'Parse error');
    return null;
  }
}

function inferCategory(purpose?: string): string {
  if (!purpose) return 'other';
  const p = purpose.toLowerCase();
  if (p.includes('salary') || p.includes('wage') || p.includes('labor')) return 'expense';
  if (p.includes('material') || p.includes('cement')) return 'expense';
  if (p.includes('transport') || p.includes('fuel')) return 'expense';
  if (p.includes('income') || p.includes('client') || p.includes('advance')) return 'income';
  if (p.includes('loan') || p.includes('borrow')) return 'debt';
  return 'other';
}

export function getQueueStatus() {
  return { pending: queue.pending, concurrency: queue.concurrency };
}
