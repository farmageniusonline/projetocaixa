import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Upload e Processamento de Arquivos', () => {
  test.beforeEach(async ({ page }) => {
    // Login automático
    await page.goto('/');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('deve processar arquivo CSV válido', async ({ page }) => {
    // Criar arquivo CSV temporário
    const csvContent = `Data,Histórico,Valor
01/01/2024,PIX RECEBIDO CPF 12345678901,100.50
02/01/2024,TED ENVIADA BANCO DO BRASIL,250.00
03/01/2024,CARTÃO DÉBITO LOJA TESTE,45.90`;

    // Upload do arquivo
    const fileChooser = page.waitForEvent('filechooser');
    await page.click('input[type="file"]');
    const file = await fileChooser;

    // Simular arquivo (no ambiente real, usaríamos um arquivo real)
    await file.setFiles([{
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);

    // Verificar que arquivo foi selecionado
    await expect(page.getByText('✅ test-data.csv')).toBeVisible();

    // Clicar em carregar
    await page.click('text=Carregar');

    // Aguardar processamento (com timeout maior)
    await expect(page.getByText('Processando arquivo...')).toBeVisible({ timeout: 2000 });

    // Aguardar conclusão
    await expect(page.getByText('Dados')).toBeVisible({ timeout: 10000 });
  });

  test('deve mostrar erro para arquivo inválido', async ({ page }) => {
    const invalidContent = `Dados inválidos sem estrutura`;

    const fileChooser = page.waitForEvent('filechooser');
    await page.click('input[type="file"]');
    const file = await fileChooser;

    await file.setFiles([{
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(invalidContent)
    }]);

    await page.click('text=Carregar');

    // Deve mostrar erro
    await expect(page.getByText('Erro ao processar arquivo')).toBeVisible({ timeout: 10000 });
  });

  test('deve limpar dados ao clicar em limpar', async ({ page }) => {
    // Simular seleção de arquivo
    const fileChooser = page.waitForEvent('filechooser');
    await page.click('input[type="file"]');
    const file = await fileChooser;

    await file.setFiles([{
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Data,Histórico,Valor\n01/01/2024,Teste,100')
    }]);

    // Verificar arquivo selecionado
    await expect(page.getByText('✅ test.csv')).toBeVisible();

    // Limpar
    await page.click('text=Limpar');

    // Arquivo deve ser removido
    await expect(page.getByText('📁 Escolher arquivo')).toBeVisible();
    await expect(page.getByText('test.csv')).not.toBeVisible();
  });

  test('deve habilitar campo de busca após carregar dados', async ({ page }) => {
    // Campo deve estar desabilitado inicialmente
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');
    await expect(searchInput).toBeDisabled();

    // Upload de arquivo válido
    const csvContent = 'Data,Histórico,Valor\n01/01/2024,Teste,100.00';

    const fileChooser = page.waitForEvent('filechooser');
    await page.click('input[type="file"]');
    const file = await fileChooser;

    await file.setFiles([{
      name: 'valid.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);

    await page.click('text=Carregar');

    // Aguardar processamento
    await page.waitForTimeout(2000);

    // Campo deve estar habilitado agora
    await expect(searchInput).toBeEnabled();
  });

  test('deve mostrar estatísticas do arquivo processado', async ({ page }) => {
    const csvContent = `Data,Histórico,Valor
01/01/2024,PIX RECEBIDO,100.50
02/01/2024,TED ENVIADA,250.00
03/01/2024,CARTÃO DÉBITO,45.90`;

    const fileChooser = page.waitForEvent('filechooser');
    await page.click('input[type="file"]');
    const file = await fileChooser;

    await file.setFiles([{
      name: 'stats-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);

    await page.click('text=Carregar');

    // Aguardar tabela aparecer
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Verificar se há dados na tabela
    await expect(page.getByText('01/01/2024')).toBeVisible();
    await expect(page.getByText('PIX RECEBIDO')).toBeVisible();
    await expect(page.getByText('R$ 100,50')).toBeVisible();
  });

  test('deve aceitar diferentes formatos de arquivo', async ({ page }) => {
    // Input deve aceitar extensões específicas
    const fileInput = page.locator('input[type="file"]');
    const acceptAttr = await fileInput.getAttribute('accept');

    expect(acceptAttr).toContain('.xlsx');
    expect(acceptAttr).toContain('.xls');
    expect(acceptAttr).toContain('.csv');
  });
});