import { test, expect } from '@playwright/test';

test.describe('Sistema de Conferência Bancária - Demo Completo', () => {
  test('jornada completa do usuário', async ({ page }) => {
    // 1. Acesso ao sistema
    await page.goto('/');

    // Verificar página inicial
    await expect(page.getByRole('heading', { name: 'Manipularium' })).toBeVisible();
    await expect(page.getByText('Conferência Bancária - Acesso Restrito')).toBeVisible();

    // 2. Login
    await page.fill('#username', 'admin');
    await page.fill('#password', 'manipularium');
    await page.click('button[type="submit"]');

    // 3. Dashboard principal
    await page.waitForURL('/dashboard');
    await expect(page.getByText('Manipularium - Sistema de Conferência')).toBeVisible();

    // 4. Upload de planilha
    const csvContent = `Data,Histórico,Valor,CPF
01/01/2024,PIX RECEBIDO DE JOAO SILVA,150.75,12345678901
02/01/2024,TED BANCO BRASIL PARA EMPRESA LTDA,1500.00,98765432109
03/01/2024,CARTAO DEBITO MAGAZINE LUIZA,89.99,11122233344
04/01/2024,PIX ENVIADO PARA MARIA SANTOS,275.50,55566677788
05/01/2024,TRANSFERENCIA DOC CAIXA ECONOMICA,450.00,77788899900`;

    const fileChooser = page.waitForEvent('filechooser');
    await page.click('text=📁 Escolher arquivo');
    const file = await fileChooser;

    await file.setFiles([{
      name: 'extrato-bancario.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);

    // 5. Processar arquivo
    await expect(page.getByText('✅ extrato-bancario.csv')).toBeVisible();
    await page.click('text=Carregar');

    // Aguardar processamento
    await expect(page.getByText('Processando arquivo...')).toBeVisible({ timeout: 5000 });

    // 6. Verificar dados carregados
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('PIX RECEBIDO')).toBeVisible();
    await expect(page.getByText('R$ 150,75')).toBeVisible();

    // 7. Buscar valor específico
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');
    await expect(searchInput).toBeEnabled();

    await searchInput.fill('150.75');
    await page.keyboard.press('Enter');

    // Aguardar resultado da busca
    await page.waitForTimeout(2000);

    // 8. Verificar transferência para caixa
    await page.click('text=Conferência de Caixa');

    // Verificar estatísticas
    await expect(page.getByText('Total de itens:')).toBeVisible();
    await expect(page.getByText('Valor total:')).toBeVisible();

    // 9. Testar busca de valor não encontrado
    await page.click('text=Conferência Bancária');
    await searchInput.fill('999.99');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000);

    // 10. Verificar histórico de não encontrados
    await page.click('text=Histórico de valores não encontrados');
    await expect(page.getByText('R$ 999,99')).toBeVisible({ timeout: 5000 });

    // 11. Testar funcionalidades avançadas

    // Alternar modo de data
    await page.click('input[value="manual"]');
    await page.fill('input[type="date"]', '2024-01-01');

    // Testar busca com formato brasileiro
    await searchInput.clear();
    await searchInput.fill('1.500,00');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000);

    // 12. Verificar responsividade mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // Interface deve se adaptar
    await expect(page.getByText('Manipularium')).toBeVisible();

    // Restaurar viewport desktop
    await page.setViewportSize({ width: 1280, height: 720 });

    // 13. Testar navegação entre abas
    await page.click('text=Conferência de Caixa');
    await expect(page.getByText('Filtrar por Data')).toBeVisible();

    await page.click('text=Conferência Bancária');
    await expect(page.getByText('Carregar Planilha')).toBeVisible();

    // 14. Logout
    await page.click('text=Sair');
    await expect(page).toHaveURL('/');
    await expect(page.locator('form')).toBeVisible();

    console.log('✅ Jornada completa do usuário executada com sucesso!');
  });

  test('teste de performance e carregamento', async ({ page }) => {
    const startTime = Date.now();

    // Medir tempo de carregamento inicial
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    console.log(`Tempo de carregamento inicial: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Menos de 5 segundos

    // Login rápido
    const loginStart = Date.now();
    await page.fill('#username', 'admin');
    await page.fill('#password', 'manipularium');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    const loginTime = Date.now() - loginStart;

    console.log(`Tempo de login: ${loginTime}ms`);
    expect(loginTime).toBeLessThan(3000); // Menos de 3 segundos

    // Teste de upload grande
    const largeContent = Array.from({ length: 100 }, (_, i) =>
      `${String(i + 1).padStart(2, '0')}/01/2024,Transação ${i + 1},${(Math.random() * 1000).toFixed(2)},${String(Math.random() * 100000000000).substring(0, 11)}`
    ).join('\n');

    const csvContent = 'Data,Histórico,Valor,CPF\n' + largeContent;

    const uploadStart = Date.now();
    const fileChooser = page.waitForEvent('filechooser');
    await page.click('text=📁 Escolher arquivo');
    const file = await fileChooser;

    await file.setFiles([{
      name: 'large-file.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);

    await page.click('text=Carregar');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    const uploadTime = Date.now() - uploadStart;
    console.log(`Tempo de upload e processamento de 100 registros: ${uploadTime}ms`);
    expect(uploadTime).toBeLessThan(15000); // Menos de 15 segundos
  });

  test('teste de recuperação de erro', async ({ page }) => {
    await page.goto('/');

    // 1. Teste de erro de login
    await page.fill('#username', 'wrong_user');
    await page.fill('#password', 'wrong_pass');
    await page.click('button[type="submit"]');

    await expect(page.getByText('incorretos')).toBeVisible();

    // Sistema deve permitir nova tentativa
    await page.fill('#username', 'admin');
    await page.fill('#password', 'manipularium');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // 2. Teste de arquivo inválido
    const invalidContent = 'dados,inválidos,sem,estrutura\n1,2,3,4';

    const fileChooser = page.waitForEvent('filechooser');
    await page.click('text=📁 Escolher arquivo');
    const file = await fileChooser;

    await file.setFiles([{
      name: 'invalid.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidContent)
    }]);

    await page.click('text=Carregar');

    // Deve mostrar erro mas permitir nova tentativa
    await expect(page.getByText('Erro')).toBeVisible({ timeout: 10000 });

    // Limpar e tentar novamente com arquivo válido
    await page.click('text=Tentar novamente');
    await expect(page.getByText('📁 Escolher arquivo')).toBeVisible();

    console.log('✅ Sistema se recupera adequadamente de erros');
  });
});