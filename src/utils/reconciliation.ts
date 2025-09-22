/**
 * Advanced reconciliation system for automatic matching and validation
 * Cross-references multiple data sources and identifies discrepancies
 */

import { ParsedRow } from './excelParser';

export interface ReconciliationSource {
  id: string;
  name: string;
  data: (ParsedRow & { id?: string; sourceId?: string })[];
  type: 'bank_statement' | 'cash_register' | 'pos_system' | 'accounting' | 'custom';
  weight: number; // Importance weight for conflict resolution
  lastUpdated: Date;
}

export interface ReconciliationMatch {
  id: string;
  confidence: number;
  matchType: 'exact' | 'approximate' | 'pattern' | 'manual';
  sources: Array<{
    sourceId: string;
    record: ParsedRow & { id?: string; sourceId?: string };
    matchingFields: string[];
  }>;
  discrepancies: Array<{
    field: string;
    values: Record<string, any>;
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }>;
  resolution?: {
    action: 'accept' | 'reject' | 'merge' | 'investigate';
    resolvedBy?: string;
    resolvedAt?: Date;
    notes?: string;
  };
  createdAt: Date;
}

export interface ReconciliationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'range' | 'regex' | 'fuzzy';
    value: unknown;
    tolerance?: number;
  }>;
  actions: Array<{
    type: 'match' | 'flag' | 'auto_resolve' | 'notify';
    parameters: Record<string, any>;
  }>;
}

export interface ReconciliationReport {
  id: string;
  startDate: Date;
  endDate: Date;
  sources: ReconciliationSource[];
  matches: ReconciliationMatch[];
  summary: {
    totalRecords: number;
    matchedRecords: number;
    unmatchedRecords: number;
    conflictingRecords: number;
    totalValue: number;
    matchedValue: number;
    unmatchedValue: number;
    confidenceDistribution: Record<string, number>;
  };
  generatedAt: Date;
}

/**
 * Main Reconciliation Engine
 */
export class ReconciliationEngine {
  private sources: Map<string, ReconciliationSource> = new Map();
  private rules: Map<string, ReconciliationRule> = new Map();
  private matches: Map<string, ReconciliationMatch> = new Map();

  constructor() {
    this.loadDefaultRules();
  }

  /**
   * Add a data source for reconciliation
   */
  addSource(source: ReconciliationSource): void {
    // Add source identifier to each record
    source.data = source.data.map((record, index) => ({
      ...record,
      id: record.id || `${source.id}_${index}`,
      sourceId: source.id
    }));

    this.sources.set(source.id, source);
  }

  /**
   * Remove a data source
   */
  removeSource(sourceId: string): boolean {
    return this.sources.delete(sourceId);
  }

  /**
   * Add or update a reconciliation rule
   */
  addRule(rule: ReconciliationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Perform full reconciliation across all sources
   */
  async reconcile(): Promise<ReconciliationReport> {
    const startTime = Date.now();
    const matches = new Map<string, ReconciliationMatch>();

    // Get all active rules sorted by priority
    const activeRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    // Get all records from all sources
    const allRecords = Array.from(this.sources.values())
      .flatMap(source => source.data);

    // Group records by potential matching criteria
    const recordGroups = this.groupRecordsByMatchingCriteria(allRecords);

    // Process each group for potential matches
    for (const group of recordGroups) {
      if (group.length > 1) {
        const groupMatches = await this.findMatches(group, activeRules);
        groupMatches.forEach(match => {
          matches.set(match.id, match);
        });
      }
    }

    // Generate report
    const report = this.generateReport(matches);
    console.log(`Reconciliation completed in ${Date.now() - startTime}ms`);

    return report;
  }

  /**
   * Find matches within a group of records
   */
  private async findMatches(
    records: (ParsedRow & { id?: string; sourceId?: string })[],
    rules: ReconciliationRule[]
  ): Promise<ReconciliationMatch[]> {
    const matches: ReconciliationMatch[] = [];

    // Compare each record with others in the group
    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const record1 = records[i];
        const record2 = records[j];

        // Don't match records from the same source
        if (record1.sourceId === record2.sourceId) continue;

        const matchResult = this.evaluateMatch(record1, record2, rules);
        if (matchResult && matchResult.confidence > 0.3) {
          matches.push(matchResult);
        }
      }
    }

    return matches;
  }

  /**
   * Evaluate if two records match based on rules
   */
  private evaluateMatch(
    record1: ParsedRow & { id?: string; sourceId?: string },
    record2: ParsedRow & { id?: string; sourceId?: string },
    rules: ReconciliationRule[]
  ): ReconciliationMatch | null {
    let totalConfidence = 0;
    const matchingFields: string[] = [];
    const discrepancies: ReconciliationMatch['discrepancies'] = [];

    // Check value matching
    const valueDiff = Math.abs(record1.value - record2.value);
    const valueConfidence = valueDiff === 0 ? 1 : Math.max(0, 1 - (valueDiff / Math.max(record1.value, record2.value)));

    if (valueConfidence > 0.95) {
      totalConfidence += 0.4;
      matchingFields.push('value');
    } else if (valueConfidence > 0.8) {
      totalConfidence += 0.2;
      matchingFields.push('value');
      discrepancies.push({
        field: 'value',
        values: {
          [record1.sourceId!]: record1.value,
          [record2.sourceId!]: record2.value
        },
        severity: valueDiff > 1 ? 'medium' : 'low',
        reason: `Diferença de valor: R$ ${valueDiff.toFixed(2)}`
      });
    }

    // Check date matching
    if (record1.date === record2.date) {
      totalConfidence += 0.3;
      matchingFields.push('date');
    } else {
      const date1 = this.parseDate(record1.date);
      const date2 = this.parseDate(record2.date);

      if (date1 && date2) {
        const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 1) {
          totalConfidence += 0.15;
          discrepancies.push({
            field: 'date',
            values: {
              [record1.sourceId!]: record1.date,
              [record2.sourceId!]: record2.date
            },
            severity: 'low',
            reason: `Diferença de ${daysDiff} dias`
          });
        }
      }
    }

    // Check CPF matching
    if (record1.cpf && record2.cpf) {
      const cpf1 = record1.cpf.replace(/\D/g, '');
      const cpf2 = record2.cpf.replace(/\D/g, '');

      if (cpf1 === cpf2) {
        totalConfidence += 0.2;
        matchingFields.push('cpf');
      } else if (cpf1.length >= 6 && cpf2.length >= 6) {
        // Check partial CPF match (useful for masked CPFs)
        const commonDigits = this.countCommonDigits(cpf1, cpf2);
        if (commonDigits >= 6) {
          totalConfidence += 0.1;
        }
      }
    }

    // Check history text similarity
    const historyScore = this.calculateTextSimilarity(
      record1.originalHistory.toLowerCase(),
      record2.originalHistory.toLowerCase()
    );

    if (historyScore > 0.7) {
      totalConfidence += 0.1;
      matchingFields.push('history');
    }

    // Apply custom rules
    for (const rule of rules) {
      const ruleResult = this.applyRule(rule, record1, record2);
      totalConfidence += ruleResult.confidenceBonus;
      matchingFields.push(...ruleResult.matchingFields);
      discrepancies.push(...ruleResult.discrepancies);
    }

    // Determine match type
    let matchType: ReconciliationMatch['matchType'] = 'pattern';
    if (totalConfidence > 0.95) {
      matchType = 'exact';
    } else if (totalConfidence > 0.8) {
      matchType = 'approximate';
    }

    // Only create match if confidence is above threshold
    if (totalConfidence < 0.3) return null;

    return {
      id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      confidence: Math.min(totalConfidence, 1),
      matchType,
      sources: [
        {
          sourceId: record1.sourceId!,
          record: record1,
          matchingFields: matchingFields.filter(f =>
            ['value', 'date', 'cpf'].includes(f)
          )
        },
        {
          sourceId: record2.sourceId!,
          record: record2,
          matchingFields: matchingFields.filter(f =>
            ['value', 'date', 'cpf'].includes(f)
          )
        }
      ],
      discrepancies: discrepancies.filter((disc, index, self) =>
        index === self.findIndex(d => d.field === disc.field)
      ),
      createdAt: new Date()
    };
  }

  /**
   * Apply a specific rule to two records
   */
  private applyRule(
    rule: ReconciliationRule,
    record1: ParsedRow & { id?: string; sourceId?: string },
    record2: ParsedRow & { id?: string; sourceId?: string }
  ): {
    confidenceBonus: number;
    matchingFields: string[];
    discrepancies: ReconciliationMatch['discrepancies'];
  } {
    const result = {
      confidenceBonus: 0,
      matchingFields: [] as string[],
      discrepancies: [] as ReconciliationMatch['discrepancies']
    };

    for (const condition of rule.conditions) {
      const value1 = this.getFieldValue(record1, condition.field);
      const value2 = this.getFieldValue(record2, condition.field);

      const conditionMet = this.evaluateCondition(condition, value1, value2);

      if (conditionMet) {
        result.confidenceBonus += 0.05; // Small bonus per matching condition
        result.matchingFields.push(condition.field);
      }
    }

    return result;
  }

  /**
   * Group records by potential matching criteria
   */
  private groupRecordsByMatchingCriteria(
    records: (ParsedRow & { id?: string; sourceId?: string })[]
  ): Array<(ParsedRow & { id?: string; sourceId?: string })[]> {
    const groups = new Map<string, (ParsedRow & { id?: string; sourceId?: string })[]>();

    records.forEach(record => {
      // Create grouping keys based on value ranges and date
      const valueRange = Math.floor(record.value / 10) * 10; // Group by value ranges of 10
      const date = record.date.substring(0, 10); // Group by date

      const key = `${valueRange}_${date}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    });

    return Array.from(groups.values());
  }

  /**
   * Generate reconciliation report
   */
  private generateReport(matches: Map<string, ReconciliationMatch>): ReconciliationReport {
    const allRecords = Array.from(this.sources.values()).flatMap(source => source.data);
    const matchedRecordIds = new Set<string>();

    // Collect all matched record IDs
    matches.forEach(match => {
      match.sources.forEach(source => {
        if (source.record.id) {
          matchedRecordIds.add(source.record.id);
        }
      });
    });

    const totalValue = allRecords.reduce((sum, record) => sum + record.value, 0);
    const matchedValue = allRecords
      .filter(record => record.id && matchedRecordIds.has(record.id))
      .reduce((sum, record) => sum + record.value, 0);

    // Calculate confidence distribution
    const confidenceDistribution = {
      'high (90-100%)': 0,
      'medium (70-89%)': 0,
      'low (30-69%)': 0
    };

    Array.from(matches.values()).forEach(match => {
      if (match.confidence >= 0.9) {
        confidenceDistribution['high (90-100%)']++;
      } else if (match.confidence >= 0.7) {
        confidenceDistribution['medium (70-89%)']++;
      } else {
        confidenceDistribution['low (30-69%)']++;
      }
    });

    return {
      id: `report_${Date.now()}`,
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate: new Date(),
      sources: Array.from(this.sources.values()),
      matches: Array.from(matches.values()),
      summary: {
        totalRecords: allRecords.length,
        matchedRecords: matchedRecordIds.size,
        unmatchedRecords: allRecords.length - matchedRecordIds.size,
        conflictingRecords: Array.from(matches.values()).filter(m => m.discrepancies.length > 0).length,
        totalValue,
        matchedValue,
        unmatchedValue: totalValue - matchedValue,
        confidenceDistribution
      },
      generatedAt: new Date()
    };
  }

  /**
   * Helper methods
   */
  private parseDate(dateStr: string): Date | null {
    try {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    } catch {
      return null;
    }
  }

  private countCommonDigits(str1: string, str2: string): number {
    let common = 0;
    const minLength = Math.min(str1.length, str2.length);

    for (let i = 0; i < minLength; i++) {
      if (str1[i] === str2[i]) {
        common++;
      }
    }

    return common;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);

    const allWords = new Set([...words1, ...words2]);
    let commonWords = 0;

    allWords.forEach(word => {
      if (words1.includes(word) && words2.includes(word)) {
        commonWords++;
      }
    });

    return commonWords / allWords.size;
  }

  private getFieldValue(record: unknown, field: string): any {
    return record[field];
  }

  private evaluateCondition(condition: unknown, value1: unknown, value2: unknown): boolean {
    switch (condition.operator) {
      case 'equals':
        return value1 === value2;
      case 'contains':
        return value1?.toString().includes(value2?.toString()) ||
               value2?.toString().includes(value1?.toString());
      case 'range': {
          const numValue1 = typeof value1 === 'number' ? value1 : parseFloat(value1);
        const numValue2 = typeof value2 === 'number' ? value2 : parseFloat(value2);
        const tolerance = condition.tolerance || 0.1;
        return Math.abs(numValue1 - numValue2) <= tolerance;
      default:
        return false;
    }
  }

  private loadDefaultRules(): void {
    // Default matching rules
    const defaultRules: ReconciliationRule[] = [
      {
        id: 'pix_matching',
        name: 'PIX Transaction Matching',
        description: 'Match PIX transactions based on value and timestamp',
        enabled: true,
        priority: 10,
        conditions: [
          { field: 'paymentType', operator: 'contains', value: 'PIX' },
          { field: 'value', operator: 'range', value: 0, tolerance: 0.01 }
        ],
        actions: [
          { type: 'match', parameters: { confidenceBonus: 0.1 } }
        ]
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }
}

// Global reconciliation engine instance
export const reconciliationEngine = new ReconciliationEngine();

/**
 * Utility functions for reconciliation management
 */
export function createReconciliationSource(
  id: string,
  name: string,
  data: ParsedRow[],
  type: ReconciliationSource['type'] = 'bank_statement'
): ReconciliationSource {
  return {
    id,
    name,
    data: data.map((record, index) => ({ ...record, id: `${id}_${index}` })),
    type,
    weight: 1,
    lastUpdated: new Date()
  };
}

export function exportReconciliationReport(report: ReconciliationReport): void {
  const reportData = {
    ...report,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(reportData, null, 2)], {
    type: 'application/json'
  });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `reconciliation-report-${report.id}.json`;
  link.click();
}