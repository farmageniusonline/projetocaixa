/**
 * Utility functions for generating stable IDs to prevent duplicates
 */

// Simple hash function for generating stable IDs
function simpleHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

// More robust hash using crypto.subtle if available, fallback to simple hash
async function cryptoHash(data: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }
  } catch (error) {
    console.warn('Crypto API not available, using simple hash:', error);
  }

  return simpleHash(data);
}

/**
 * Generate stable hash for banking entries based on key fields
 * Format: Data|CPF|Valor|Histórico
 */
export async function generateOriginHash(
  date: string,
  cpf: string,
  value: number,
  history: string
): Promise<string> {
  // Normalize inputs to ensure consistency
  const normalizedDate = date?.trim() || '';
  const normalizedCpf = cpf?.replace(/\D/g, '') || ''; // Remove non-digits
  const normalizedValue = Math.round(value * 100); // Use cents for precision
  const normalizedHistory = history?.trim().toLowerCase() || '';

  // Create deterministic string
  const dataString = `${normalizedDate}|${normalizedCpf}|${normalizedValue}|${normalizedHistory}`;

  // Generate hash
  const hash = await cryptoHash(dataString);

  return `origin_${hash}`;
}

/**
 * Generate stable hash synchronously (for Worker environments)
 */
export function generateOriginHashSync(
  date: string,
  cpf: string,
  value: number,
  history: string
): string {
  // Normalize inputs to ensure consistency
  const normalizedDate = date?.trim() || '';
  const normalizedCpf = cpf?.replace(/\D/g, '') || ''; // Remove non-digits
  const normalizedValue = Math.round(value * 100); // Use cents for precision
  const normalizedHistory = history?.trim().toLowerCase() || '';

  // Create deterministic string
  const dataString = `${normalizedDate}|${normalizedCpf}|${normalizedValue}|${normalizedHistory}`;

  // Generate hash
  const hash = simpleHash(dataString);

  return `origin_${hash}`;
}

/**
 * Generate UUID v4 for manual entries
 */
export function generateManualId(): string {
  // Use crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `manual_${crypto.randomUUID()}`;
  }

  // Fallback UUID v4 implementation
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  const uuid = template.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  return `manual_${uuid}`;
}

/**
 * Generate unique conference ID for cash entries
 */
export function generateConferenceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `conf_${timestamp}_${random}`;
}

/**
 * Extract source type from source_id
 */
export function getSourceType(sourceId: string): 'origin' | 'manual' | 'conference' | 'unknown' {
  if (sourceId.startsWith('origin_')) return 'origin';
  if (sourceId.startsWith('manual_')) return 'manual';
  if (sourceId.startsWith('conf_')) return 'conference';
  return 'unknown';
}

/**
 * Validate source_id format
 */
export function isValidSourceId(sourceId: string): boolean {
  if (!sourceId || typeof sourceId !== 'string') return false;

  const patterns = [
    /^origin_[a-z0-9]+$/,     // origin_abc123
    /^manual_[a-f0-9-]{36}$/, // manual_uuid
    /^conf_[a-z0-9_]+$/       // conf_timestamp_random
  ];

  return patterns.some(pattern => pattern.test(sourceId));
}

/**
 * Create duplicate detection key for quick lookup
 */
export function createDuplicateKey(
  date: string,
  value: number,
  cpf?: string,
  history?: string
): string {
  const normalizedCpf = cpf?.replace(/\D/g, '') || '';
  const normalizedValue = Math.round(value * 100);
  const normalizedHistory = history?.trim().toLowerCase().substring(0, 50) || '';

  return `${date}:${normalizedValue}:${normalizedCpf}:${normalizedHistory}`;
}

/**
 * Batch generate origin hashes for multiple entries
 */
export async function batchGenerateOriginHashes(
  entries: Array<{
    date: string;
    cpf: string;
    value: number;
    history: string;
  }>
): Promise<string[]> {
  return Promise.all(
    entries.map(entry => generateOriginHash(
      entry.date,
      entry.cpf,
      entry.value,
      entry.history
    ))
  );
}

/**
 * Sync version for Web Workers
 */
export function batchGenerateOriginHashesSync(
  entries: Array<{
    date: string;
    cpf: string;
    value: number;
    history: string;
  }>
): string[] {
  return entries.map(entry => generateOriginHashSync(
    entry.date,
    entry.cpf,
    entry.value,
    entry.history
  ));
}