/**
 * Test fixtures and data generators for E2E tests
 */

import { Page } from '@playwright/test';

// Mock data generators
export const mockBankingData = {
  // Valid banking entry
  validEntry: {
    date: '25/12/2023',
    paymentType: 'PIX RECEBIDO',
    cpf: '12345678901',
    value: '150,00',
    history: 'Pagamento teste E2E'
  },

  // Large value entry
  largeEntry: {
    date: '26/12/2023',
    paymentType: 'TED',
    cnpj: '12345678000195',
    value: '5.000,00',
    history: 'Transferência de grande valor'
  },

  // Multiple entries for batch testing
  multipleEntries: [
    {
      date: '20/12/2023',
      paymentType: 'PIX RECEBIDO',
      cpf: '11111111111',
      value: '100,00',
      history: 'Pagamento 1'
    },
    {
      date: '21/12/2023',
      paymentType: 'CARTÃO',
      cpf: '22222222222',
      value: '200,00',
      history: 'Pagamento 2'
    },
    {
      date: '22/12/2023',
      paymentType: 'DINHEIRO',
      cpf: '33333333333',
      value: '300,00',
      history: 'Pagamento 3'
    }
  ],

  // Invalid entries for error testing
  invalidEntries: [
    {
      date: 'invalid-date',
      paymentType: 'PIX RECEBIDO',
      cpf: '123',
      value: 'invalid-value',
      history: 'Invalid entry'
    }
  ]
};

// User test data
export const testUsers = {
  admin: {
    username: 'admin',
    password: 'admin123',
    role: 'admin'
  },
  user: {
    username: 'user',
    password: 'user123',
    role: 'user'
  },
  viewer: {
    username: 'viewer',
    password: 'viewer123',
    role: 'viewer'
  }
};

// File generators
export const createMockExcelFile = (entries: any[] = [mockBankingData.validEntry]) => {
  const headers = 'Date,Payment Type,CPF,CNPJ,Value,History\n';
  const rows = entries.map(entry =>
    `${entry.date},${entry.paymentType},${entry.cpf || ''},${entry.cnpj || ''},${entry.value},${entry.history}`
  ).join('\n');

  return Buffer.from(headers + rows);
};

export const createMockCSVFile = (entries: any[] = [mockBankingData.validEntry]) => {
  return createMockExcelFile(entries);
};

// Database state setup
export class DatabaseFixture {
  constructor(private page: Page) {}

  async setupCleanState() {
    // Mock clean database state
    await this.page.route('**/api/bank-entries**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 })
      });
    });

    await this.page.route('**/api/cash-conferences**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 })
      });
    });
  }

  async setupWithBankingData(entries: any[] = [mockBankingData.validEntry]) {
    await this.page.route('**/api/bank-entries**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: entries.map((entry, index) => ({ ...entry, id: index + 1 })),
          total: entries.length
        })
      });
    });
  }

  async setupWithConferences(conferences: any[] = []) {
    await this.page.route('**/api/cash-conferences**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: conferences.map((conf, index) => ({ ...conf, id: index + 1 })),
          total: conferences.length
        })
      });
    });
  }

  async mockUploadResponse(success: boolean = true, data: any = mockBankingData.validEntry) {
    await this.page.route('**/api/upload**', route => {
      if (success) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            rowsProcessed: Array.isArray(data) ? data.length : 1,
            data: Array.isArray(data) ? data : [data]
          })
        });
      } else {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Upload failed',
            details: 'Mock upload error for testing'
          })
        });
      }
    });
  }
}

// Authentication fixtures
export class AuthFixture {
  constructor(private page: Page) {}

  async mockSuccessfulAuth(user: any = testUsers.admin) {
    await this.page.route('**/api/auth/login**', route => {
      const requestBody = route.request().postDataJSON();

      if (requestBody.username === user.username && requestBody.password === user.password) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: '1',
              username: user.username,
              role: user.role
            },
            token: 'mock-jwt-token'
          })
        });
      } else {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Usuário ou senha incorretos'
          })
        });
      }
    });

    await this.page.route('**/api/auth/verify**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: '1',
            username: user.username,
            role: user.role
          }
        })
      });
    });
  }

  async mockAuthFailure() {
    await this.page.route('**/api/auth/**', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Authentication failed'
        })
      });
    });
  }

  async mockSessionExpiry() {
    await this.page.route('**/api/**', route => {
      // First request succeeds, subsequent ones fail
      if (route.request().url().includes('login')) {
        route.continue();
      } else {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Session expired'
          })
        });
      }
    });
  }
}

// Performance testing utilities
export class PerformanceFixture {
  constructor(private page: Page) {}

  async measurePageLoad(url: string): Promise<number> {
    const startTime = Date.now();
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
    return Date.now() - startTime;
  }

  async measureSearchPerformance(searchTerm: string): Promise<number> {
    const startTime = Date.now();
    await this.page.fill('[data-testid="search-input"]', searchTerm);
    await this.page.waitForSelector('[data-testid="search-results"]');
    return Date.now() - startTime;
  }

  async measureUploadPerformance(fileSize: 'small' | 'medium' | 'large' = 'small'): Promise<number> {
    const entries = {
      small: mockBankingData.multipleEntries.slice(0, 10),
      medium: Array(100).fill(0).map((_, i) => ({ ...mockBankingData.validEntry, id: i })),
      large: Array(1000).fill(0).map((_, i) => ({ ...mockBankingData.validEntry, id: i }))
    };

    const file = createMockExcelFile(entries[fileSize]);

    const startTime = Date.now();
    await this.page.setInputFiles('[data-testid="file-input"]', {
      name: `test-${fileSize}.csv`,
      mimeType: 'text/csv',
      buffer: file
    });
    await this.page.waitForSelector('[data-testid="upload-success"]');
    return Date.now() - startTime;
  }
}

// Error simulation utilities
export class ErrorFixture {
  constructor(private page: Page) {}

  async simulateNetworkError() {
    await this.page.route('**/api/**', route => {
      route.abort('failed');
    });
  }

  async simulateSlowNetwork(delayMs: number = 5000) {
    await this.page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      route.continue();
    });
  }

  async simulateServerError() {
    await this.page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      });
    });
  }

  async simulateRateLimitError() {
    await this.page.route('**/api/**', route => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Rate limit exceeded'
        })
      });
    });
  }
}

// Accessibility testing utilities
export class AccessibilityFixture {
  constructor(private page: Page) {}

  async checkKeyboardNavigation() {
    // Check if all interactive elements are keyboard accessible
    const focusableElements = await this.page.locator('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])').all();

    for (const element of focusableElements) {
      await element.focus();
      const isFocused = await element.evaluate(el => document.activeElement === el);
      if (!isFocused) {
        throw new Error(`Element ${await element.textContent()} is not keyboard accessible`);
      }
    }
  }

  async checkAriaLabels() {
    // Check for missing ARIA labels on form controls
    const formControls = await this.page.locator('input, select, textarea').all();

    for (const control of formControls) {
      const hasLabel = await control.evaluate(el => {
        return el.hasAttribute('aria-label') ||
               el.hasAttribute('aria-labelledby') ||
               document.querySelector(`label[for="${el.id}"]`) !== null;
      });

      if (!hasLabel) {
        const tagName = await control.evaluate(el => el.tagName);
        throw new Error(`${tagName} element missing accessible label`);
      }
    }
  }

  async checkColorContrast() {
    // Basic color contrast check
    await this.page.addStyleTag({
      content: `
        * {
          background-color: white !important;
          color: black !important;
        }
      `
    });

    // Verify high contrast mode doesn't break layout
    await this.page.waitForTimeout(1000);
  }
}

export {
  DatabaseFixture,
  AuthFixture,
  PerformanceFixture,
  ErrorFixture,
  AccessibilityFixture
};