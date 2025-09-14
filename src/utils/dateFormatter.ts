/**
 * Utility functions for consistent date formatting throughout the application
 * Standard format: DD-MM-YYYY (dia-mês-ano)
 */

export type DateInput = string | Date | number;

/**
 * Formats a date to DD-MM-YYYY format
 */
export function formatToDDMMYYYY(dateInput: DateInput): string {
  if (!dateInput) return '';

  try {
    let date: Date;

    if (typeof dateInput === 'string') {
      // Handle different input formats
      if (dateInput.includes('/')) {
        // DD/MM/YYYY or MM/DD/YYYY format
        const [part1, part2, part3] = dateInput.split('/');
        if (part1.length === 4) {
          // YYYY/MM/DD
          date = new Date(parseInt(part1), parseInt(part2) - 1, parseInt(part3));
        } else if (part3.length === 4) {
          // DD/MM/YYYY or MM/DD/YYYY - assume DD/MM/YYYY for Brazilian format
          date = new Date(parseInt(part3), parseInt(part2) - 1, parseInt(part1));
        } else {
          date = new Date(dateInput);
        }
      } else if (dateInput.includes('-')) {
        // YYYY-MM-DD or DD-MM-YYYY format
        const [part1, part2, part3] = dateInput.split('-');
        if (part1.length === 4) {
          // YYYY-MM-DD (ISO format)
          date = new Date(dateInput);
        } else {
          // DD-MM-YYYY format
          date = new Date(parseInt(part3), parseInt(part2) - 1, parseInt(part1));
        }
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      // Excel serial date or timestamp
      if (dateInput < 100000) {
        // Excel serial date
        date = new Date((dateInput - 25569) * 86400 * 1000);
      } else {
        // Timestamp
        date = new Date(dateInput);
      }
    } else {
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  } catch {
    return '';
  }
}

/**
 * Parses a DD-MM-YYYY string to a Date object
 */
export function parseFromDDMMYYYY(dateString: string): Date | null {
  if (!dateString) return null;

  try {
    const [day, month, year] = dateString.split('-').map(part => parseInt(part, 10));

    if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12) {
      return null;
    }

    const date = new Date(year, month - 1, day);

    // Verify the date is valid (handles cases like 31/02)
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
}

/**
 * Formats date for HTML input[type="date"] (YYYY-MM-DD)
 */
export function formatForDateInput(dateInput: DateInput): string {
  if (!dateInput) return '';

  try {
    let date: Date;

    if (typeof dateInput === 'string') {
      if (dateInput.includes('-') && dateInput.split('-')[0].length === 2) {
        // DD-MM-YYYY format
        date = parseFromDDMMYYYY(dateInput);
        if (!date) return '';
      } else {
        date = new Date(dateInput);
      }
    } else {
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Formats date for display with Brazilian locale (DD/MM/YYYY)
 */
export function formatForDisplay(dateInput: DateInput): string {
  if (!dateInput) return '';

  try {
    let date: Date;

    if (typeof dateInput === 'string') {
      if (dateInput.includes('-') && dateInput.split('-')[0].length === 2) {
        // DD-MM-YYYY format
        date = parseFromDDMMYYYY(dateInput);
        if (!date) return '';
      } else {
        date = new Date(dateInput);
      }
    } else {
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}

/**
 * Formats date and time for display with Brazilian locale
 */
export function formatDateTimeForDisplay(dateInput: DateInput): string {
  if (!dateInput) return '';

  try {
    const date = new Date(dateInput);

    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

/**
 * Gets today's date in DD-MM-YYYY format
 */
export function getTodayDDMMYYYY(): string {
  return formatToDDMMYYYY(new Date());
}

/**
 * Converts DD-MM-YYYY to ISO string for database storage
 */
export function convertToISOString(ddmmyyyy: string): string {
  const date = parseFromDDMMYYYY(ddmmyyyy);
  return date ? date.toISOString() : '';
}

/**
 * Validates if a string is in valid DD-MM-YYYY format
 */
export function isValidDDMMYYYY(dateString: string): boolean {
  if (!dateString) return false;

  const regex = /^\d{2}-\d{2}-\d{4}$/;
  if (!regex.test(dateString)) return false;

  return parseFromDDMMYYYY(dateString) !== null;
}

/**
 * Checks if two dates in DD-MM-YYYY format are the same
 */
export function isSameDate(date1: string, date2: string): boolean {
  if (!date1 || !date2) return false;

  const d1 = parseFromDDMMYYYY(date1);
  const d2 = parseFromDDMMYYYY(date2);

  if (!d1 || !d2) return false;

  return d1.toDateString() === d2.toDateString();
}