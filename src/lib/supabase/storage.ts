/**
 * Supabase Storage Helpers
 * Handle file uploads, signed URLs, and deletions
 * Bot uses server client to upload (service role key)
 * Dashboard uses browser client to download (signed URLs with RLS)
 */

import { createBrowserClient } from './client';
import { createServerClient } from './server';

// ============================================================
// STORAGE BUCKET NAMES
// ============================================================

export const STORAGE_BUCKETS = {
  RECEIPTS: 'receipts',
  ATTACHMENTS: 'attachments',
} as const;

// ============================================================
// FILE UPLOAD
// ============================================================

/**
 * Upload attachment file to Supabase Storage
 * Called by bot media downloader after fetching WhatsApp media
 * Uses server client (service role) to bypass RLS
 *
 * @param bucket Storage bucket name
 * @param path File path in format: receipts/YYYYMMDD/filename or attachments/txnId/filename
 * @param file File buffer content
 * @param mimetype MIME type (e.g., image/jpeg, application/pdf)
 * @returns Signed URL for accessing the file
 */
export async function uploadAttachment(
  bucket: string,
  path: string,
  file: Buffer,
  mimetype: string
): Promise<string> {
  const supabase = createServerClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload attachment to ${bucket}/${path}: ${error.message}`);
  }

  // Return signed URL for later access
  const signedUrl = await getSignedUrl(bucket, path, 7 * 24 * 60 * 60, true); // 7 days, server client
  return signedUrl;
}

// ============================================================
// SIGNED URLS
// ============================================================

/**
 * Generate signed URL for accessing a storage file
 * Used by dashboard to display receipt images and documents
 * Signed URL prevents direct bucket access - respects RLS
 *
 * @param bucket Storage bucket name
 * @param path File path in bucket
 * @param expiresIn Expiration time in seconds (default 7 days)
 * @returns Signed URL that can be used in <img>, <a>, etc.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 7 * 24 * 60 * 60,
  useServerClient: boolean = false
): Promise<string> {
  const supabase = useServerClient ? createServerClient() : createBrowserClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to generate signed URL for ${bucket}/${path}: ${error.message}`);
  }

  return data.signedUrl;
}

// ============================================================
// FILE DELETION
// ============================================================

/**
 * Delete a file from Supabase Storage
 * Called when user deletes a transaction with attachments
 * Uses server client to ensure deletion regardless of RLS
 *
 * @param bucket Storage bucket name
 * @param path File path in bucket
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(`Failed to delete file from ${bucket}/${path}: ${error.message}`);
  }
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Delete multiple files in batch
 * Used when deleting a transaction with multiple attachments
 *
 * @param bucket Storage bucket name
 * @param paths Array of file paths to delete
 */
export async function deleteFiles(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const supabase = createServerClient();

  const { error } = await supabase.storage.from(bucket).remove(paths);

  if (error) {
    throw new Error(`Failed to delete files from ${bucket}: ${error.message}`);
  }
}

// ============================================================
// PATH BUILDERS
// ============================================================

/**
 * Build storage path for receipt images
 * Pattern: receipts/YYYYMMDD/filename
 * Groups receipts by date for organization
 *
 * @param date Date object or ISO string
 * @param filename Original or generated filename
 * @returns Storage path
 */
export function buildReceiptPath(date: Date | string, filename: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
  return `receipts/${dateStr}/${filename}`;
}

/**
 * Build storage path for transaction attachments
 * Pattern: attachments/txnId/filename
 * Groups attachments by transaction for easy cleanup
 *
 * @param transactionId Transaction UUID
 * @param filename Original or generated filename
 * @returns Storage path
 */
export function buildAttachmentPath(transactionId: string, filename: string): string {
  return `attachments/${transactionId}/${filename}`;
}

/**
 * Generate safe filename from original
 * Removes special characters and whitespace
 * Preserves extension
 *
 * @param original Original filename from WhatsApp
 * @returns Safe filename
 */
export function sanitizeFilename(original: string): string {
  const ext = original.split('.').pop() || 'bin';
  const name = original
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace non-alphanumeric with underscore
    .substring(0, 50); // Limit length
  return `${name}.${ext}`;
}
