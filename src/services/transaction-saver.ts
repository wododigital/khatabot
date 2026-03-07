/**
 * Transaction Saver
 * Saves extracted and enriched transaction data to database
 * Includes validation, contact matching, and error handling
 */

import { createServerClient } from '@/lib/supabase/server.js';
import pino from 'pino';
import type { Transaction, EnrichedExtraction } from '@/types/index.js';
import { matchContact } from './contact-matcher.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: false },
  },
});

/**
 * Validate transaction data before saving
 * Ensures required fields are present and valid
 */
function validateTransaction(extraction: EnrichedExtraction): {
  valid: boolean;
  error?: string;
} {
  const { transaction } = extraction;

  // Required fields
  if (!transaction.amount || transaction.amount <= 0) {
    return { valid: false, error: 'Invalid or missing amount' };
  }

  if (!transaction.person_name || transaction.person_name.trim().length === 0) {
    return { valid: false, error: 'Missing person name' };
  }

  if (!transaction.category || transaction.category.trim().length === 0) {
    return { valid: false, error: 'Missing category' };
  }

  // Validate payment mode if provided
  if (
    transaction.payment_mode &&
    !['cash', 'upi', 'bank_transfer', 'cheque', 'other'].includes(
      transaction.payment_mode
    )
  ) {
    return { valid: false, error: 'Invalid payment mode' };
  }

  return { valid: true };
}

/**
 * Save transaction to database
 * Integrates contact matching, validation, and error handling
 *
 * @param enrichedExtraction - Extraction result with all metadata
 * @param waMessageId - WhatsApp message ID for dedup tracking
 * @param groupId - Database group ID
 * @returns Saved transaction or null if failed
 */
export async function saveTransaction(
  enrichedExtraction: EnrichedExtraction,
  waMessageId: string,
  groupId: string
): Promise<Transaction | null> {
  try {
    // Validate extraction
    const validation = validateTransaction(enrichedExtraction);
    if (!validation.valid) {
      logger.warn(
        { error: validation.error, waMessageId },
        'Validation failed'
      );
      return null;
    }

    const { transaction: txn, confidence } = enrichedExtraction;

    // Attempt contact matching
    let contactId: string | undefined;
    let matchConfidence = 0;

    try {
      const match = await matchContact(txn.person_name, 0.8);
      if (match) {
        contactId = match.contactId;
        matchConfidence = match.confidence;
        logger.debug(
          { personName: txn.person_name, contactId },
          'Contact matched'
        );
      }
    } catch (matchError) {
      // Log but don't fail - transaction can be saved without contact
      const err =
        matchError instanceof Error ? matchError.message : String(matchError);
      logger.warn({ error: err }, 'Contact matching failed, continuing');
    }

    // Parse txn_date if provided
    let txnDate: string | null = null;
    if (txn.txn_date) {
      try {
        txnDate = new Date(txn.txn_date).toISOString().split('T')[0];
      } catch (dateError) {
        logger.warn(
          { txn_date: txn.txn_date },
          'Failed to parse txn_date'
        );
        txnDate = new Date().toISOString().split('T')[0];
      }
    } else {
      txnDate = new Date().toISOString().split('T')[0];
    }

    // Prepare insert payload
    const insertData = {
      group_id: groupId,
      contact_id: contactId || null,
      amount: txn.amount,
      person_name: txn.person_name.trim(),
      purpose: txn.purpose || null,
      category: txn.category,
      payment_mode: txn.payment_mode || null,
      txn_id: txn.txn_id || null,
      txn_date: txnDate,
      notes: enrichedExtraction.validation_notes?.join('; ') || null,
      confidence: confidence,
      raw_message: enrichedExtraction.extracted_text || null,
      wa_message_id: waMessageId,
      is_edited: false,
      is_deleted: false,
    };

    // Insert transaction
    const db = createServerClient() as any;
    const { data: saved, error } = await db
      .from('transactions')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      logger.error(
        { error: error.message, waMessageId },
        'Failed to insert transaction'
      );
      return null;
    }

    if (!saved) {
      logger.error({ waMessageId }, 'No transaction returned from insert');
      return null;
    }

    logger.info(
      {
        transactionId: saved.id,
        amount: saved.amount,
        person: saved.person_name,
        confidence: Number(confidence.toFixed(2)),
        contactMatched: !!contactId,
      },
      'Transaction saved'
    );

    return saved as Transaction;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: message, waMessageId },
      'Error in transaction saver'
    );
    return null;
  }
}
