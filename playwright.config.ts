import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Pasta dos testes
  testDir: './e2e',

  // Timeout para cada teste
  timeout: 60000,

  // Execução em paralelo
  fullyParallel: true,

  // Não falhar se CI estiver rodando
  forbidOnly: !!process.env.CI,

  // Repetir testes que falharam
  retries: process.env.CI ? 2 : 0,

  // Workers paralelos
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuração
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list']
  ],

  // Configurações globais
  use: {
    // URL base para testes
    baseURL: 'http://localhost:5175',

    // Trace apenas em falhas
    trace: 'on-first-retry',

    // Screenshot apenas em falhas
    screenshot: 'only-on-failure',

    // Video apenas em falhas
    video: 'retain-on-failure',

    // Timeout para ações
    actionTimeout: 15000,
  },

  // Projetos (diferentes browsers)
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Configurações específicas do Chrome
        launchOptions: {
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        }
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Testes mobile
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Servidor local para desenvolvimento
  webServer: {
    command: 'npm run dev',
    port: 5175,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    stderr: 'pipe',
    stdout: 'pipe',
  },
});