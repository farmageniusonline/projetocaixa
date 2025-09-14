import { test, expect } from '@playwright/test';

test.describe('Dashboard - Funcionalidades Principais', () => {
  test.beforeEach(async ({ page }) => {
    // Login automático
    await page.goto('/');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('deve exibir estrutura principal do dashboard', async ({ page }) => {
    // Header com logo e título
    await expect(page.getByText('Manipularium - Sistema de Conferência')).toBeVisible();

    // Tabs de navegação
    await expect(page.getByText('Conferência Bancária')).toBeVisible();
    await expect(page.getByText('Conferência de Caixa')).toBeVisible();

    // Sidebar com steps
    await expect(page.getByText('1')).toBeVisible();
    await expect(page.getByText('Carregar Planilha')).toBeVisible();
    await expect(page.getByText('2')).toBeVisible();
    await expect(page.getByText('Selecionar Dia')).toBeVisible();
  });

  test('deve alternar entre abas corretamente', async ({ page }) => {
    // Tab inicial deve ser Conferência Bancária
    await expect(page.locator('[data-testid="banking-tab"]')).toHaveClass(/border-indigo-500/);

    // Clicar na aba Conferência de Caixa
    await page.click('text=Conferência de Caixa');

    // Verificar mudança de layout
    await expect(page.getByText('Filtrar por Data')).toBeVisible();
    await expect(page.getByText('Total de itens:')).toBeVisible();
  });

  test('deve permitir upload de arquivo', async ({ page }) => {
    // Clicar no botão de escolher arquivo
    await page.click('text=📁 Escolher arquivo');

    // O input file deve estar presente
    await expect(page.locator('input[type="file"]')).toBePresent();

    // Simular upload (sem arquivo real)
    const fileChooser = page.waitForEvent('filechooser');
    await page.click('input[type="file"]');
    const file = await fileChooser;

    // Verificar que o file chooser foi aberto
    expect(file).toBeTruthy();
  });

  test('deve mostrar validação de campo obrigatório', async ({ page }) => {
    // Tentar buscar valor sem carregar planilha
    const input = page.locator('input[placeholder*="Digite o valor"]');
    await expect(input).toBeDisabled();

    // Verificar mensagem de orientação
    await expect(page.getByText('Carregue uma planilha para usar esta função')).toBeVisible();
  });

  test('deve permitir configuração de data', async ({ page }) => {
    // Verificar opções de data
    await expect(page.getByText('Data Automática')).toBeVisible();
    await expect(page.getByText('Selecionar Manualmente')).toBeVisible();

    // Selecionar data manual
    await page.click('input[value="manual"]');

    // Input de data deve aparecer
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test('deve funcionar busca de histórico', async ({ page }) => {
    // Clicar no botão de histórico
    await page.click('text=Histórico de valores não encontrados');

    // Verificar expansão do histórico
    await expect(page.getByText('Nenhum valor não encontrado')).toBeVisible();
  });

  test('deve permitir reiniciar dia', async ({ page }) => {
    // Clicar em reiniciar dia
    await page.click('text=Reiniciar dia atual');

    // Modal de confirmação deve aparecer
    await expect(page.getByText('Confirmar Reinício')).toBeVisible();
    await expect(page.getByText('Todos os dados transferidos e históricos serão apagados')).toBeVisible();

    // Botões de confirmação
    await expect(page.getByText('Confirmar')).toBeVisible();
    await expect(page.getByText('Cancelar')).toBeVisible();

    // Cancelar para não afetar outros testes
    await page.click('text=Cancelar');
  });

  test('deve mostrar estatísticas na aba de caixa', async ({ page }) => {
    // Ir para aba de caixa
    await page.click('text=Conferência de Caixa');

    // Verificar resumo
    await expect(page.getByText('Total de itens:')).toBeVisible();
    await expect(page.getByText('Valor total:')).toBeVisible();

    // Verificar valor formatado em BRL
    const valorElement = page.locator('text=R$');
    await expect(valorElement.first()).toBeVisible();
  });

  test('deve manter estado entre navegações', async ({ page }) => {
    // Definir uma data manual
    await page.click('input[value="manual"]');
    const hoje = new Date().toISOString().split('T')[0];
    await page.fill('input[type="date"]', hoje);

    // Alternar para aba de caixa
    await page.click('text=Conferência de Caixa');

    // Voltar para bancária
    await page.click('text=Conferência Bancária');

    // Verificar que a data foi mantida
    await expect(page.locator('input[value="manual"]')).toBeChecked();
    await expect(page.locator('input[type="date"]')).toHaveValue(hoje);
  });
});