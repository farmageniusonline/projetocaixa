/**
 * Bank-specific templates for parsing different spreadsheet formats
 * Customizable parsing rules for various banking institutions
 */

export interface ColumnMapping {
  name: string;
  aliases: string[];
  required: boolean;
  dataType: 'date' | 'text' | 'number' | 'currency';
  format?: string;
  transform?: (value: any) => any;
}

export interface ParsingRule {
  pattern: RegExp;
  extract: (match: string) => any;
  priority: number;
}

export interface BankTemplate {
  id: string;
  name: string;
  description: string;
  logo?: string;
  version: string;
  author?: string;

  // Column mappings
  columns: {
    date: ColumnMapping;
    history: ColumnMapping;
    value?: ColumnMapping;
    credit?: ColumnMapping;
    debit?: ColumnMapping;
    cpf?: ColumnMapping;
    paymentType?: ColumnMapping;
    account?: ColumnMapping;
    agency?: ColumnMapping;
  };

  // Parsing rules for specific data extraction
  parsingRules: {
    cpf: ParsingRule[];
    paymentType: ParsingRule[];
    value: ParsingRule[];
  };

  // Template-specific configurations
  config: {
    dateFormats: string[];
    currencySymbols: string[];
    decimalSeparator: ',' | '.';
    thousandSeparator: '.' | ',' | '';
    headerRowHints: string[];
    skipRows?: number;
    encoding?: string;
  };

  // Validation rules
  validation: {
    requiredColumns: string[];
    minRows: number;
    maxEmptyRows: number;
    dateRange?: { min: Date; max: Date };
  };
}

// Default universal template
export const universalTemplate: BankTemplate = {
  id: 'universal',
  name: 'Universal',
  description: 'Template genérico compatível com a maioria dos bancos',
  version: '1.0.0',

  columns: {
    date: {
      name: 'Data',
      aliases: ['data', 'date', 'data do lançamento', 'data do lancamento', 'dt', 'data mov', 'data movimento'],
      required: true,
      dataType: 'date'
    },
    history: {
      name: 'Histórico',
      aliases: ['histórico', 'historico', 'descrição', 'descricao', 'histórico/descrição', 'historico/descricao', 'descrição/histórico', 'descricao/historico', 'desc'],
      required: true,
      dataType: 'text'
    },
    value: {
      name: 'Valor',
      aliases: ['valor', 'valor (r$)', 'valor r$', 'vlr', 'val'],
      required: false,
      dataType: 'currency'
    },
    credit: {
      name: 'Crédito',
      aliases: ['crédito', 'credito', 'entrada', 'receita', 'c'],
      required: false,
      dataType: 'currency'
    },
    debit: {
      name: 'Débito',
      aliases: ['débito', 'debito', 'saída', 'saida', 'despesa', 'd'],
      required: false,
      dataType: 'currency'
    }
  },

  parsingRules: {
    cpf: [
      {
        pattern: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
        extract: (match) => match.replace(/\D/g, ''),
        priority: 10
      }
    ],
    paymentType: [
      {
        pattern: /pix\s*(recebid|enviad)/i,
        extract: (match) => match.includes('recebid') ? 'PIX RECEBIDO' : 'PIX ENVIADO',
        priority: 10
      },
      {
        pattern: /\bted\b/i,
        extract: () => 'TED',
        priority: 8
      },
      {
        pattern: /\bdoc\b/i,
        extract: () => 'DOC',
        priority: 8
      }
    ],
    value: [
      {
        pattern: /R\$?\s*[\d.,]+/g,
        extract: (match) => parseFloat(match.replace(/[R$\s]/g, '').replace(',', '.')),
        priority: 10
      }
    ]
  },

  config: {
    dateFormats: ['dd/mm/yyyy', 'dd/mm/yy', 'yyyy-mm-dd'],
    currencySymbols: ['R$', 'BRL', ''],
    decimalSeparator: ',',
    thousandSeparator: '.',
    headerRowHints: ['data', 'histórico', 'valor']
  },

  validation: {
    requiredColumns: ['date', 'history'],
    minRows: 1,
    maxEmptyRows: 10
  }
};

// Banco do Brasil template
export const bancoDoBrasilTemplate: BankTemplate = {
  id: 'bb',
  name: 'Banco do Brasil',
  description: 'Template específico para extratos do Banco do Brasil',
  logo: '🏦',
  version: '1.2.0',

  columns: {
    date: {
      name: 'Data',
      aliases: ['data', 'data mov.', 'data movimento'],
      required: true,
      dataType: 'date'
    },
    history: {
      name: 'Histórico',
      aliases: ['histórico', 'descrição', 'desc. lançamento'],
      required: true,
      dataType: 'text'
    },
    value: {
      name: 'Valor',
      aliases: ['valor', 'valor r$'],
      required: false,
      dataType: 'currency'
    },
    credit: {
      name: 'Crédito',
      aliases: ['crédito', 'entrada'],
      required: false,
      dataType: 'currency'
    },
    debit: {
      name: 'Débito',
      aliases: ['débito', 'saída'],
      required: false,
      dataType: 'currency'
    },
    account: {
      name: 'Conta',
      aliases: ['conta', 'nº conta'],
      required: false,
      dataType: 'text'
    }
  },

  parsingRules: {
    cpf: [
      {
        pattern: /CPF[\s:]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i,
        extract: (match) => match.replace(/\D/g, ''),
        priority: 15
      },
      {
        pattern: /\d{3}\.\d{3}\.\d{3}-\d{2}/g,
        extract: (match) => match.replace(/\D/g, ''),
        priority: 10
      }
    ],
    paymentType: [
      {
        pattern: /PIX\s+(RECEB|ENVIO)/i,
        extract: (match) => match.includes('RECEB') ? 'PIX RECEBIDO' : 'PIX ENVIADO',
        priority: 15
      },
      {
        pattern: /TRANSF.*PIX/i,
        extract: () => 'PIX ENVIADO',
        priority: 12
      },
      {
        pattern: /TED\s+(RECEB|ENVIO)/i,
        extract: (match) => match.includes('RECEB') ? 'TED RECEBIDA' : 'TED ENVIADA',
        priority: 10
      }
    ],
    value: []
  },

  config: {
    dateFormats: ['dd/mm/yyyy'],
    currencySymbols: ['R$'],
    decimalSeparator: ',',
    thousandSeparator: '.',
    headerRowHints: ['data', 'histórico', 'débito', 'crédito'],
    skipRows: 0
  },

  validation: {
    requiredColumns: ['date', 'history'],
    minRows: 1,
    maxEmptyRows: 5
  }
};

// Itaú template
export const itauTemplate: BankTemplate = {
  id: 'itau',
  name: 'Itaú',
  description: 'Template específico para extratos do Itaú',
  logo: '🔷',
  version: '1.1.0',

  columns: {
    date: {
      name: 'Data',
      aliases: ['data', 'dt'],
      required: true,
      dataType: 'date'
    },
    history: {
      name: 'Lançamento',
      aliases: ['lançamento', 'lancamento', 'histórico', 'descrição'],
      required: true,
      dataType: 'text'
    },
    value: {
      name: 'Valor',
      aliases: ['valor', 'vlr'],
      required: false,
      dataType: 'currency'
    },
    credit: {
      name: 'C',
      aliases: ['c', 'crédito', 'credito'],
      required: false,
      dataType: 'currency'
    },
    debit: {
      name: 'D',
      aliases: ['d', 'débito', 'debito'],
      required: false,
      dataType: 'currency'
    }
  },

  parsingRules: {
    cpf: [
      {
        pattern: /\*{3}\.\d{3}\.\d{3}-\*{2}/g,
        extract: (match) => match, // Keep masked format for Itaú
        priority: 15
      },
      {
        pattern: /\d{3}\.\d{3}\.\d{3}-\d{2}/g,
        extract: (match) => match.replace(/\D/g, ''),
        priority: 10
      }
    ],
    paymentType: [
      {
        pattern: /Pix\s+(Recebido|Enviado)/i,
        extract: (match) => match.includes('Recebido') ? 'PIX RECEBIDO' : 'PIX ENVIADO',
        priority: 15
      },
      {
        pattern: /Compra\s+com\s+cartão/i,
        extract: () => 'CARTÃO DE DÉBITO',
        priority: 10
      }
    ],
    value: []
  },

  config: {
    dateFormats: ['dd/mm/yyyy', 'dd/mm/yy'],
    currencySymbols: ['R$', ''],
    decimalSeparator: ',',
    thousandSeparator: '.',
    headerRowHints: ['data', 'lançamento', 'valor']
  },

  validation: {
    requiredColumns: ['date', 'history'],
    minRows: 1,
    maxEmptyRows: 3
  }
};

// Bradesco template
export const bradescoTemplate: BankTemplate = {
  id: 'bradesco',
  name: 'Bradesco',
  description: 'Template específico para extratos do Bradesco',
  logo: '🔴',
  version: '1.0.0',

  columns: {
    date: {
      name: 'Data',
      aliases: ['data', 'data mov'],
      required: true,
      dataType: 'date'
    },
    history: {
      name: 'Histórico',
      aliases: ['histórico', 'descrição da operação'],
      required: true,
      dataType: 'text'
    },
    debit: {
      name: 'Débito',
      aliases: ['débito', 'valor débito'],
      required: false,
      dataType: 'currency'
    },
    credit: {
      name: 'Crédito',
      aliases: ['crédito', 'valor crédito'],
      required: false,
      dataType: 'currency'
    }
  },

  parsingRules: {
    cpf: [
      {
        pattern: /CPF\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i,
        extract: (match) => match.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)![0].replace(/\D/g, ''),
        priority: 15
      }
    ],
    paymentType: [
      {
        pattern: /PIX\s*-\s*(RECEBIMENTO|PAGAMENTO)/i,
        extract: (match) => match.includes('RECEBIMENTO') ? 'PIX RECEBIDO' : 'PIX ENVIADO',
        priority: 15
      }
    ],
    value: []
  },

  config: {
    dateFormats: ['dd/mm/yyyy'],
    currencySymbols: ['R$'],
    decimalSeparator: ',',
    thousandSeparator: '.',
    headerRowHints: ['data', 'histórico', 'débito', 'crédito']
  },

  validation: {
    requiredColumns: ['date', 'history'],
    minRows: 1,
    maxEmptyRows: 5
  }
};

// Caixa Econômica Federal template
export const caixaTemplate: BankTemplate = {
  id: 'caixa',
  name: 'Caixa Econômica Federal',
  description: 'Template específico para extratos da Caixa',
  logo: '🏛️',
  version: '1.0.0',

  columns: {
    date: {
      name: 'Data',
      aliases: ['data', 'data de lançamento'],
      required: true,
      dataType: 'date'
    },
    history: {
      name: 'Descrição',
      aliases: ['descrição', 'histórico', 'desc'],
      required: true,
      dataType: 'text'
    },
    value: {
      name: 'Valor',
      aliases: ['valor', 'valor (r$)'],
      required: false,
      dataType: 'currency'
    }
  },

  parsingRules: {
    cpf: [
      {
        pattern: /\d{3}\.\d{3}\.\d{3}-\d{2}/g,
        extract: (match) => match.replace(/\D/g, ''),
        priority: 10
      }
    ],
    paymentType: [
      {
        pattern: /PIX/i,
        extract: () => 'PIX',
        priority: 10
      }
    ],
    value: []
  },

  config: {
    dateFormats: ['dd/mm/yyyy'],
    currencySymbols: ['R$'],
    decimalSeparator: ',',
    thousandSeparator: '.',
    headerRowHints: ['data', 'descrição', 'valor']
  },

  validation: {
    requiredColumns: ['date', 'history'],
    minRows: 1,
    maxEmptyRows: 10
  }
};

// Collection of all templates
export const bankTemplates = {
  universal: universalTemplate,
  bb: bancoDoBrasilTemplate,
  itau: itauTemplate,
  bradesco: bradescoTemplate,
  caixa: caixaTemplate
};

/**
 * Template Manager Class
 */
export class TemplateManager {
  private templates: Map<string, BankTemplate> = new Map();
  private customTemplates: Map<string, BankTemplate> = new Map();

  constructor() {
    // Load default templates
    Object.values(bankTemplates).forEach(template => {
      this.templates.set(template.id, template);
    });

    // Load custom templates from localStorage
    this.loadCustomTemplates();
  }

  /**
   * Get all available templates
   */
  getAllTemplates(): BankTemplate[] {
    return [...this.templates.values(), ...this.customTemplates.values()];
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): BankTemplate | undefined {
    return this.templates.get(id) || this.customTemplates.get(id);
  }

  /**
   * Auto-detect best template based on column headers
   */
  autoDetectTemplate(headers: string[]): BankTemplate {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    let bestMatch = universalTemplate;
    let bestScore = 0;

    for (const template of this.getAllTemplates()) {
      let score = 0;

      // Check for specific header hints
      template.config.headerRowHints.forEach(hint => {
        if (normalizedHeaders.some(header => header.includes(hint))) {
          score += 2;
        }
      });

      // Check column matches
      Object.values(template.columns).forEach(column => {
        column.aliases.forEach(alias => {
          if (normalizedHeaders.some(header => header.includes(alias))) {
            score += column.required ? 3 : 1;
          }
        });
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = template;
      }
    }

    return bestMatch;
  }

  /**
   * Create custom template
   */
  createCustomTemplate(template: BankTemplate): void {
    this.customTemplates.set(template.id, template);
    this.saveCustomTemplates();
  }

  /**
   * Update existing template
   */
  updateTemplate(id: string, updates: Partial<BankTemplate>): boolean {
    const existing = this.customTemplates.get(id);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    this.customTemplates.set(id, updated);
    this.saveCustomTemplates();
    return true;
  }

  /**
   * Delete custom template
   */
  deleteCustomTemplate(id: string): boolean {
    const deleted = this.customTemplates.delete(id);
    if (deleted) {
      this.saveCustomTemplates();
    }
    return deleted;
  }

  /**
   * Export template to JSON
   */
  exportTemplate(id: string): string | null {
    const template = this.getTemplate(id);
    if (!template) return null;
    return JSON.stringify(template, null, 2);
  }

  /**
   * Import template from JSON
   */
  importTemplate(jsonStr: string): boolean {
    try {
      const template: BankTemplate = JSON.parse(jsonStr);

      // Validate template structure
      if (!this.validateTemplate(template)) {
        throw new Error('Invalid template structure');
      }

      this.createCustomTemplate(template);
      return true;
    } catch (error) {
      console.error('Failed to import template:', error);
      return false;
    }
  }

  /**
   * Validate template structure
   */
  private validateTemplate(template: any): template is BankTemplate {
    const required = ['id', 'name', 'description', 'version', 'columns', 'parsingRules', 'config', 'validation'];
    return required.every(field => field in template) &&
           'date' in template.columns &&
           'history' in template.columns;
  }

  /**
   * Save custom templates to localStorage
   */
  private saveCustomTemplates(): void {
    try {
      const serialized = JSON.stringify([...this.customTemplates.entries()]);
      localStorage.setItem('customBankTemplates', serialized);
    } catch (error) {
      console.error('Failed to save custom templates:', error);
    }
  }

  /**
   * Load custom templates from localStorage
   */
  private loadCustomTemplates(): void {
    try {
      const stored = localStorage.getItem('customBankTemplates');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.customTemplates = new Map(parsed);
      }
    } catch (error) {
      console.error('Failed to load custom templates:', error);
      this.customTemplates = new Map();
    }
  }
}

// Global instance
export const templateManager = new TemplateManager();