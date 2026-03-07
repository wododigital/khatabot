/**
 * Claude Haiku 4.5 Vision API Wrapper
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { TRANSACTION_EXTRACTION_SYSTEM } from './prompts.js';
import pino from 'pino';

const logger = pino();

const ResponseSchema = z.object({
  is_transaction: z.boolean(),
  amount: z.number().nullable(),
  person: z.string().nullable(),
  purpose: z.string().nullable(),
  payment_mode: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']).nullable(),
  txn_id: z.string().nullable(),
  date: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type ClaudeRawResponse = z.infer<typeof ResponseSchema>;
export interface ClaudeExtractionResult extends ClaudeRawResponse {
  extracted_text?: string;
  validation_notes?: string[];
}

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30000,
});

function parseJsonResponse(responseText: string): unknown {
  let json = responseText.trim();
  if (json.startsWith('```json')) {
    json = json.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (json.startsWith('```')) {
    json = json.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(json);
}

export async function extractTransactionFromText(
  messageText: string
): Promise<ClaudeExtractionResult> {
  const sanitized = messageText.trim().substring(0, 2000);
  logger.debug({ length: sanitized.length }, 'Text extraction starting');

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: TRANSACTION_EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content: sanitized }],
    });

    const textContent = response.content.find((b) => b.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const parsed = parseJsonResponse(textContent.text);
    const validated = ResponseSchema.parse(parsed);
    logger.debug({ confidence: validated.confidence }, 'Text extraction success');
    return { ...validated, extracted_text: sanitized };
  } catch (error) {
    logger.error({ error: String(error) }, 'Text extraction failed');
    return {
      is_transaction: false,
      amount: null,
      person: null,
      purpose: null,
      payment_mode: null,
      txn_id: null,
      date: null,
      confidence: 0,
      extracted_text: sanitized,
      validation_notes: [String(error)],
    };
  }
}

export async function extractTransactionFromImage(
  imageBuffer: Buffer,
  imageMimeType: string,
  captionText?: string
): Promise<ClaudeExtractionResult> {
  const validMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validMimes.includes(imageMimeType)) {
    return {
      is_transaction: false,
      amount: null,
      person: null,
      purpose: null,
      payment_mode: null,
      txn_id: null,
      date: null,
      confidence: 0,
      validation_notes: [`Invalid MIME: ${imageMimeType}`],
    };
  }

  const base64 = imageBuffer.toString('base64');
  logger.debug({ mime: imageMimeType, size: imageBuffer.length }, 'Image extraction starting');

  try {
    const content: Anthropic.MessageParam['content'] = captionText
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Context: "${captionText.trim().substring(0, 500)}"\n\nExtract transaction.`,
          },
        ]
      : [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          { type: 'text', text: 'Extract transaction details.' },
        ];

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: TRANSACTION_EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content }],
    });

    const textContent = response.content.find((b) => b.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const parsed = parseJsonResponse(textContent.text);
    const validated = ResponseSchema.parse(parsed);
    logger.debug({ confidence: validated.confidence }, 'Image extraction success');
    return { ...validated, extracted_text: captionText };
  } catch (error) {
    logger.error({ error: String(error) }, 'Image extraction failed');
    return {
      is_transaction: false,
      amount: null,
      person: null,
      purpose: null,
      payment_mode: null,
      txn_id: null,
      date: null,
      confidence: 0,
      validation_notes: [String(error)],
    };
  }
}

export { client };
