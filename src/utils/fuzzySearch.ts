/**
 * Advanced fuzzy search utilities for approximate value matching
 * Includes similarity algorithms and intelligent matching
 */

import { ParsedRow } from './excelParser';

export interface FuzzyMatch {
  item: ParsedRow & { id?: string };
  score: number;
  matchType: 'exact' | 'close' | 'fuzzy';
  matchReason: string;
  confidence: number;
}

export interface FuzzySearchOptions {
  tolerance: number; // Percentage tolerance for value matching (0.01 = 1%)
  maxResults: number;
  includePartialMatches: boolean;
  searchInHistory: boolean;
  searchInCPF: boolean;
  minConfidence: number; // Minimum confidence score (0-1)
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i += 1) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator, // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Normalize value for comparison
 */
function normalizeValue(value: string | number): number {
  if (typeof value === 'number') return Math.abs(value);

  // Remove currency symbols and normalize decimal separators
  const cleaned = value.toString()
    .replace(/[R$\s]/g, '')
    .replace(',', '.');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
}

/**
 * Check if two values are within tolerance
 */
function valuesWithinTolerance(value1: number, value2: number, tolerance: number): boolean {
  if (value1 === 0 && value2 === 0) return true;
  if (value1 === 0 || value2 === 0) return false;

  const larger = Math.max(value1, value2);
  const difference = Math.abs(value1 - value2);
  const percentageDifference = difference / larger;

  return percentageDifference <= tolerance;
}

/**
 * Extract numerical sequences from text
 */
function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+([.,]\d+)?/g) || [];
  return matches.map(match => parseFloat(match.replace(',', '.'))).filter(num => !isNaN(num));
}

/**
 * Calculate confidence score based on multiple factors
 */
function calculateConfidence(
  valueSimilarity: number,
  textSimilarity: number,
  matchType: string,
  hasDateMatch: boolean,
  hasCPFMatch: boolean
): number {
  let confidence = 0;

  // Base confidence from value similarity
  confidence += valueSimilarity * 0.4;

  // Text similarity contribution
  confidence += textSimilarity * 0.2;

  // Match type bonus
  switch (matchType) {
    case 'exact':
      confidence += 0.3;
      break;
    case 'close':
      confidence += 0.15;
      break;
    case 'fuzzy':
      confidence += 0.05;
      break;
  }

  // Additional context bonuses
  if (hasDateMatch) confidence += 0.05;
  if (hasCPFMatch) confidence += 0.1;

  return Math.min(confidence, 1);
}

/**
 * Perform fuzzy search on data
 */
export function fuzzySearch(
  searchValue: string | number,
  data: (ParsedRow & { id?: string })[],
  options: Partial<FuzzySearchOptions> = {}
): FuzzyMatch[] {
  const opts: FuzzySearchOptions = {
    tolerance: 0.02, // 2% tolerance
    maxResults: 10,
    includePartialMatches: true,
    searchInHistory: true,
    searchInCPF: false,
    minConfidence: 0.3,
    ...options
  };

  const searchNum = normalizeValue(searchValue);
  const searchStr = searchValue.toString().toLowerCase();
  const matches: FuzzyMatch[] = [];

  data.forEach(item => {
    const itemValue = normalizeValue(item.value);
    const scores: {
      valueSimilarity: number;
      textSimilarity: number;
      matchType: 'exact' | 'close' | 'fuzzy';
      matchReason: string;
      hasDateMatch: boolean;
      hasCPFMatch: boolean;
    } = {
      valueSimilarity: 0,
      textSimilarity: 0,
      matchType: 'fuzzy',
      matchReason: '',
      hasDateMatch: false,
      hasCPFMatch: false
    };

    // Value matching
    if (itemValue === searchNum) {
      scores.valueSimilarity = 1;
      scores.matchType = 'exact';
      scores.matchReason = 'Valor exato';
    } else if (valuesWithinTolerance(itemValue, searchNum, opts.tolerance)) {
      const difference = Math.abs(itemValue - searchNum);
      const larger = Math.max(itemValue, searchNum);
      scores.valueSimilarity = 1 - (difference / larger);
      scores.matchType = 'close';
      scores.matchReason = `Valor próximo (diferença: ${difference.toFixed(2)})`;
    } else {
      // Check if search value appears in the item's history as a number
      const historyNumbers = extractNumbers(item.originalHistory);
      const hasNumberMatch = historyNumbers.some(num =>
        num === searchNum || valuesWithinTolerance(num, searchNum, opts.tolerance * 2)
      );

      if (hasNumberMatch) {
        scores.valueSimilarity = 0.7;
        scores.matchType = 'fuzzy';
        scores.matchReason = 'Valor encontrado no histórico';
      }
    }

    // Text similarity in history
    if (opts.searchInHistory && typeof searchValue === 'string' && searchValue.length > 2) {
      const historySimilarity = stringSimilarity(
        searchStr,
        item.originalHistory.toLowerCase()
      );

      if (historySimilarity > 0.3) {
        scores.textSimilarity = historySimilarity;
        if (scores.matchReason === '') {
          scores.matchReason = `Texto similar no histórico (${(historySimilarity * 100).toFixed(0)}%)`;
        }
      }
    }

    // CPF matching
    if (opts.searchInCPF && typeof searchValue === 'string') {
      const cleanSearchCPF = searchValue.replace(/\D/g, '');
      const cleanItemCPF = item.cpf.replace(/\D/g, '');

      if (cleanSearchCPF.length >= 3 && cleanItemCPF.includes(cleanSearchCPF)) {
        scores.hasCPFMatch = true;
        scores.textSimilarity = Math.max(scores.textSimilarity, 0.8);
        if (scores.matchReason === '') {
          scores.matchReason = 'CPF parcialmente compatível';
        }
      }
    }

    // Date matching (if search contains date-like patterns)
    const datePattern = /\d{1,2}\/\d{1,2}\/?\d{0,4}/;
    if (typeof searchValue === 'string' && datePattern.test(searchValue)) {
      if (item.date.includes(searchValue) || searchValue.includes(item.date.substring(0, 5))) {
        scores.hasDateMatch = true;
        if (scores.matchReason === '') {
          scores.matchReason = 'Data compatível';
        }
      }
    }

    // Calculate overall confidence
    const confidence = calculateConfidence(
      scores.valueSimilarity,
      scores.textSimilarity,
      scores.matchType,
      scores.hasDateMatch,
      scores.hasCPFMatch
    );

    // Only include if meets minimum confidence
    if (confidence >= opts.minConfidence) {
      matches.push({
        item,
        score: scores.valueSimilarity + scores.textSimilarity,
        matchType: scores.matchType,
        matchReason: scores.matchReason,
        confidence
      });
    }
  });

  // Sort by confidence (descending) then by score
  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.score - a.score;
  });

  return matches.slice(0, opts.maxResults);
}

/**
 * Smart value search with multiple strategies
 */
export function smartValueSearch(
  searchValue: string | number,
  data: (ParsedRow & { id?: string })[],
  transferredIds: Set<string> = new Set()
): {
  exactMatches: FuzzyMatch[];
  closeMatches: FuzzyMatch[];
  fuzzyMatches: FuzzyMatch[];
  suggestions: string[];
} {
  // Filter out already transferred items
  const availableData = data.filter(item =>
    !item.id || !transferredIds.has(item.id)
  );

  // Exact matches
  const exactMatches = fuzzySearch(searchValue, availableData, {
    tolerance: 0,
    maxResults: 5,
    minConfidence: 0.9
  });

  // Close matches (within tolerance)
  const closeMatches = fuzzySearch(searchValue, availableData, {
    tolerance: 0.05, // 5% tolerance
    maxResults: 10,
    minConfidence: 0.6
  }).filter(match => match.matchType === 'close');

  // Fuzzy matches (broader search)
  const fuzzyMatches = fuzzySearch(searchValue, availableData, {
    tolerance: 0.1, // 10% tolerance
    maxResults: 15,
    includePartialMatches: true,
    searchInHistory: true,
    searchInCPF: true,
    minConfidence: 0.3
  }).filter(match =>
    match.matchType === 'fuzzy' &&
    !exactMatches.some(exact => exact.item.id === match.item.id) &&
    !closeMatches.some(close => close.item.id === match.item.id)
  );

  // Generate search suggestions based on available values
  const suggestions = generateSearchSuggestions(searchValue, availableData);

  return {
    exactMatches,
    closeMatches,
    fuzzyMatches,
    suggestions
  };
}

/**
 * Generate search suggestions based on data patterns
 */
function generateSearchSuggestions(
  searchValue: string | number,
  data: (ParsedRow & { id?: string })[]
): string[] {
  const suggestions: string[] = [];
  const searchNum = normalizeValue(searchValue);

  // Find values within different tolerance ranges
  const tolerances = [0.01, 0.05, 0.1, 0.2];

  tolerances.forEach(tolerance => {
    const withinTolerance = data
      .filter(item => valuesWithinTolerance(item.value, searchNum, tolerance))
      .map(item => item.value.toFixed(2))
      .filter((value, index, self) => self.indexOf(value) === index)
      .slice(0, 3);

    suggestions.push(...withinTolerance);
  });

  // Add common rounded values
  if (searchNum > 0) {
    const rounded = [
      Math.round(searchNum),
      Math.ceil(searchNum),
      Math.floor(searchNum),
      Math.round(searchNum * 10) / 10,
      Math.round(searchNum * 100) / 100
    ].map(val => val.toFixed(2))
     .filter(val => parseFloat(val) !== searchNum);

    suggestions.push(...rounded);
  }

  // Remove duplicates and limit
  return [...new Set(suggestions)].slice(0, 5);
}

/**
 * Highlight matching parts in text
 */
export function highlightMatch(text: string, searchTerm: string): string {
  if (!searchTerm || searchTerm.length < 2) return text;

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-300 text-black">$1</mark>');
}

/**
 * Get search suggestions based on recent searches
 */
export function getRecentSearchSuggestions(): string[] {
  try {
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    return recent.slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Save search to recent searches
 */
export function saveRecentSearch(searchValue: string | number): void {
  try {
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    const newRecent = [searchValue.toString(), ...recent.filter((item: string) => item !== searchValue.toString())];
    localStorage.setItem('recentSearches', JSON.stringify(newRecent.slice(0, 10)));
  } catch {
    // Ignore storage errors
  }
}