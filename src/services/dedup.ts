/**
 * Deduplication Service
 * Prevents duplicate transactions through multiple checks:
 * 1. wa_message_id uniqueness (primary key)
 * 2. UPI transaction ID (txn_id) if present
 * 3. Time + amount + person window (5 minutes)
 */

import { createServerClient } from '@/lib/supabase/server.js';
import pino from 'pino';
import type { ClassifiedMessage } from '@/types/index.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: false },
  },
});

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  candidateIds?: string[];
}

/**
 * Check if a message is a duplicate transaction
 * Runs three checks in order of cost:
 * 1. wa_message_id - cheapest, direct lookup
 * 2. txn_id - for UPI transactions
 * 3. Time window - for cash/other modes (5 minute window)
 */
export async function checkDuplicate(
  classifiedMessage: ClassifiedMessage,
  amount?: number,
  personName?: string
): Promise<DuplicateCheckResult> {
  try {
    const db = createServerClient() as any;

    // Check 1: wa_message_id uniqueness (fastest)
    if (classifiedMessage.wa_message_id) {
      const { data: existing, error } = await db
        .from('transactions')
        .select('id')
        .eq('wa_message_id', classifiedMessage.wa_message_id)
        .limit(1);

      if (!error && existing && existing.length > 0) {
        logger.warn(
          { wa_message_id: classifiedMessage.wa_message_id },
          'Duplicate: wa_message_id exists'
        );
        return {
          isDuplicate: true,
          reason: 'wa_message_id already exists',
          candidateIds: existing.map((r: any) => r.id),
        };
      }
    }

    // Check 2: UPI transaction ID (txn_id)
    // Future: extract txn_id from AI result and check here

    // Check 3: Time + amount + person window (5 minutes)
    // Uses timestamp in ms; compare against created_at as closest proxy
    if (amount && personName) {
      const windowStart = new Date(classifiedMessage.timestamp - 5 * 60 * 1000);
      const windowEnd = new Date(classifiedMessage.timestamp + 5 * 60 * 1000);

      const { data: similar, error: timeError } = await db
        .from('transactions')
        .select('id')
        .eq('person_name', personName)
        .eq('amount', amount)
        .gte('created_at', windowStart.toISOString())
        .lte('created_at', windowEnd.toISOString())
        .eq('is_deleted', false);

      if (!timeError && similar && similar.length > 0) {
        logger.warn(
          {
            personName,
            amount,
            candidates: similar.length,
          },
          'Potential duplicate: same amount + person within 5 min window'
        );
        return {
          isDuplicate: true,
          reason: `Potential duplicate: same person (${personName}) + amount (${amount}) within 5-minute window`,
          candidateIds: similar.map((r: any) => r.id),
        };
      }
    }

    logger.debug(
      { wa_message_id: classifiedMessage.wa_message_id },
      'Not a duplicate'
    );
    return { isDuplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: message, wa_message_id: classifiedMessage.wa_message_id },
      'Dedup check error'
    );
    // On error, return false (fail-open) to avoid blocking valid messages
    return { isDuplicate: false };
  }
}
