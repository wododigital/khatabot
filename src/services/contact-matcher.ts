/**
 * Contact Fuzzy Matcher
 * Matches extracted person names to known contacts using Levenshtein distance
 * Maintains in-memory cache of contacts, refreshed every 5 minutes
 */

import { createServerClient } from '@/lib/supabase/server.js';
import pino from 'pino';
import type { Contact } from '@/types/index.js';
import { search } from 'fast-fuzzy';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: false },
  },
});

let contactCache: Contact[] = [];
let lastCacheRefresh = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

export interface ContactMatch {
  contactId: string;
  confidence: number;
  contact: Contact;
}

/**
 * Load all contacts from database
 * Updates cache if stale (> 5 minutes old)
 */
async function loadContacts(): Promise<Contact[]> {
  const now = Date.now();

  // Return cached if fresh
  if (contactCache.length > 0 && now - lastCacheRefresh < CACHE_TTL) {
    logger.debug('Using cached contacts');
    return contactCache;
  }

  try {
    const db = createServerClient() as any;
    const { data: contacts, error } = await db
      .from('contacts')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      logger.warn({ error }, 'Failed to load contacts');
      return contactCache; // Return stale cache on error
    }

    if (contacts && contacts.length > 0) {
      contactCache = contacts as Contact[];
      lastCacheRefresh = now;
      logger.info(
        { count: contactCache.length },
        'Loaded contacts into cache'
      );
    }

    return contactCache;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Error loading contacts');
    return contactCache;
  }
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses fast-fuzzy for weighted string matching
 */
function calculateSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  // Exact match
  if (aLower === bLower) {
    return 1.0;
  }

  // Use fast-fuzzy search with returnMatchData to get scores (0-1 range)
  const results = search(aLower, [bLower], { returnMatchData: true });
  if (results.length > 0) {
    const score = results[0].score ?? 0;
    return Math.max(0, Math.min(1, score));
  }

  return 0;
}

/**
 * Match extracted person name against known contacts
 * Checks contact name and aliases with fuzzy matching
 *
 * @param personName - Extracted name from message
 * @param threshold - Confidence threshold (default 0.8)
 * @returns Matched contact or null
 */
export async function matchContact(
  personName: string,
  threshold: number = 0.8
): Promise<ContactMatch | null> {
  if (!personName || personName.trim().length === 0) {
    logger.debug('Empty person name, skipping match');
    return null;
  }

  try {
    const contacts = await loadContacts();

    if (contacts.length === 0) {
      logger.debug('No contacts in database');
      return null;
    }

    let bestMatch: ContactMatch | null = null;

    for (const contact of contacts) {
      // Check primary name
      const nameSimilarity = calculateSimilarity(personName, contact.name);

      if (nameSimilarity >= threshold) {
        if (!bestMatch || nameSimilarity > bestMatch.confidence) {
          bestMatch = {
            contactId: contact.id,
            confidence: nameSimilarity,
            contact,
          };
        }
        // If exact match, stop searching
        if (nameSimilarity === 1.0) {
          break;
        }
      }

      // Check aliases
      if (contact.aliases && Array.isArray(contact.aliases)) {
        for (const alias of contact.aliases) {
          const aliasSimilarity = calculateSimilarity(personName, alias);

          if (aliasSimilarity >= threshold) {
            if (!bestMatch || aliasSimilarity > bestMatch.confidence) {
              bestMatch = {
                contactId: contact.id,
                confidence: aliasSimilarity,
                contact,
              };
            }
            // If exact match on alias, stop searching
            if (aliasSimilarity === 1.0) {
              break;
            }
          }
        }
      }

      if (bestMatch?.confidence === 1.0) {
        break;
      }
    }

    if (bestMatch && bestMatch.confidence >= threshold) {
      logger.info(
        {
          extractedName: personName,
          matchedName: bestMatch.contact.name,
          confidence: Number(bestMatch.confidence.toFixed(2)),
        },
        'Contact matched'
      );
      return bestMatch;
    }

    logger.debug(
      { personName, threshold },
      'No contact match above threshold'
    );
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: message, personName },
      'Error in contact matching'
    );
    return null;
  }
}

/**
 * Clear cache (useful for testing or manual refresh)
 */
export function clearContactCache(): void {
  contactCache = [];
  lastCacheRefresh = 0;
  logger.info('Contact cache cleared');
}
