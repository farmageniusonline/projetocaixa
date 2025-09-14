/**
 * Comprehensive CPF and CNPJ validation utility
 * Includes digit verification, formatting, and validation
 */

export interface ValidationResult {
  isValid: boolean;
  document: string;
  type: 'CPF' | 'CNPJ' | 'UNKNOWN';
  formatted: string;
  error?: string;
}

/**
 * Clean document string removing all non-numeric characters
 */
export function cleanDocument(document: string): string {
  return document.replace(/\D/g, '');
}

/**
 * Format CPF with standard mask: 000.000.000-00
 */
export function formatCPF(cpf: string): string {
  const cleaned = cleanDocument(cpf);
  if (cleaned.length !== 11) return cpf;

  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Format CNPJ with standard mask: 00.000.000/0000-00
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cleanDocument(cnpj);
  if (cleaned.length !== 14) return cnpj;

  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Validate CPF using official algorithm
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cleanDocument(cpf);

  // Basic length check
  if (cleaned.length !== 11) return false;

  // Check for known invalid patterns (all same digits)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }

  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) firstDigit = 0;

  if (firstDigit !== parseInt(cleaned[9])) return false;

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }

  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) secondDigit = 0;

  return secondDigit === parseInt(cleaned[10]);
}

/**
 * Validate CNPJ using official algorithm
 */
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cleanDocument(cnpj);

  // Basic length check
  if (cleaned.length !== 14) return false;

  // Check for known invalid patterns
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Calculate first check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }

  let firstDigit = sum % 11;
  firstDigit = firstDigit < 2 ? 0 : 11 - firstDigit;

  if (firstDigit !== parseInt(cleaned[12])) return false;

  // Calculate second check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;

  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }

  let secondDigit = sum % 11;
  secondDigit = secondDigit < 2 ? 0 : 11 - secondDigit;

  return secondDigit === parseInt(cleaned[13]);
}

/**
 * Detect document type based on length
 */
export function detectDocumentType(document: string): 'CPF' | 'CNPJ' | 'UNKNOWN' {
  const cleaned = cleanDocument(document);

  if (cleaned.length === 11) return 'CPF';
  if (cleaned.length === 14) return 'CNPJ';
  return 'UNKNOWN';
}

/**
 * Comprehensive document validation
 */
export function validateDocument(document: string): ValidationResult {
  if (!document || document.trim() === '') {
    return {
      isValid: false,
      document: '',
      type: 'UNKNOWN',
      formatted: '',
      error: 'Documento não fornecido'
    };
  }

  const cleaned = cleanDocument(document);
  const type = detectDocumentType(cleaned);

  if (type === 'UNKNOWN') {
    return {
      isValid: false,
      document: cleaned,
      type: 'UNKNOWN',
      formatted: document,
      error: 'Formato de documento não reconhecido'
    };
  }

  const isValid = type === 'CPF' ? validateCPF(cleaned) : validateCNPJ(cleaned);
  const formatted = type === 'CPF' ? formatCPF(cleaned) : formatCNPJ(cleaned);

  return {
    isValid,
    document: cleaned,
    type,
    formatted,
    error: isValid ? undefined : `${type} inválido - falha na verificação dos dígitos`
  };
}

/**
 * Generate valid CPF for testing (development only)
 */
export function generateValidCPF(): string {
  // Generate first 9 digits
  const base = Array.from({length: 9}, () => Math.floor(Math.random() * 10));

  // Calculate first digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += base[i] * (10 - i);
  }
  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) firstDigit = 0;
  base.push(firstDigit);

  // Calculate second digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += base[i] * (11 - i);
  }
  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) secondDigit = 0;
  base.push(secondDigit);

  return base.join('');
}

/**
 * Generate valid CNPJ for testing (development only)
 */
export function generateValidCNPJ(): string {
  // Generate first 12 digits
  const base = Array.from({length: 8}, () => Math.floor(Math.random() * 10));
  base.push(0, 0, 0, 1); // Add branch and sequence

  // Calculate first digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += base[i] * weights1[i];
  }
  let firstDigit = sum % 11;
  firstDigit = firstDigit < 2 ? 0 : 11 - firstDigit;
  base.push(firstDigit);

  // Calculate second digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += base[i] * weights2[i];
  }
  let secondDigit = sum % 11;
  secondDigit = secondDigit < 2 ? 0 : 11 - secondDigit;
  base.push(secondDigit);

  return base.join('');
}

/**
 * Mask document input as user types
 */
export function maskDocumentInput(value: string, previousValue: string = ''): string {
  const cleaned = cleanDocument(value);
  const isDeleting = value.length < previousValue.length;

  if (cleaned.length <= 11) {
    // CPF formatting
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return cleaned.replace(/(\d{3})(\d+)/, '$1.$2');
    if (cleaned.length <= 9) return cleaned.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
  } else {
    // CNPJ formatting
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 5) return cleaned.replace(/(\d{2})(\d+)/, '$1.$2');
    if (cleaned.length <= 8) return cleaned.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    if (cleaned.length <= 12) return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
  }
}

/**
 * Extract all possible documents from a text
 */
export function extractDocumentsFromText(text: string): ValidationResult[] {
  const documents: ValidationResult[] = [];

  // Regex patterns for CPF and CNPJ
  const cpfPattern = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
  const cnpjPattern = /\d{2}\.?\d{3}\.?\d{3}\/?d{4}-?\d{2}/g;

  // Extract CPFs
  const cpfMatches = text.match(cpfPattern) || [];
  cpfMatches.forEach(match => {
    const validation = validateDocument(match);
    if (validation.isValid) {
      documents.push(validation);
    }
  });

  // Extract CNPJs
  const cnpjMatches = text.match(cnpjPattern) || [];
  cnpjMatches.forEach(match => {
    const validation = validateDocument(match);
    if (validation.isValid) {
      documents.push(validation);
    }
  });

  // Remove duplicates
  const uniqueDocuments = documents.filter((doc, index, self) =>
    index === self.findIndex(d => d.document === doc.document)
  );

  return uniqueDocuments;
}