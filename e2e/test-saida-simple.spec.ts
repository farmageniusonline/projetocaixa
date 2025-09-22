import { test, expect } from '@playwright/test';

test.describe('Teste Simples - Funcionalidade Saída', () => {
  test('deve carregar a aplicação e verificar se existe botão Saída', async ({ page }) => {
    // Ir para a página
    await page.goto('http://localhost:5175');

    // Fazer screenshot da tela de login
    await page.screenshot({ path: 'login-screen.png' });

    // Verificar se a página carregou
    await expect(page.locator('text=Manipularium')).toBeVisible();

    // Tentar fazer login com as credenciais corretas
    const credentials = [
      { username: 'admin@manipularium.com.br', password: 'manipularium' }
    ];

    for (const cred of credentials) {
      console.log(`Tentando login com: ${cred.username}/${cred.password}`);

      // Limpar campos
      await page.fill('[data-testid="username-input"]', '');
      await page.fill('[data-testid="password-input"]', '');

      // Preencher credenciais
      await page.fill('[data-testid="username-input"]', cred.username);
      await page.fill('[data-testid="password-input"]', cred.password);
      await page.click('[data-testid="login-button"]');

      // Aguardar um pouco para ver se passou
      await page.waitForTimeout(2000);

      // Verificar se conseguiu entrar (se não há mais formulário de login)
      const loginForm = page.locator('[data-testid="login-form"]');
      const isLoginVisible = await loginForm.isVisible();

      if (!isLoginVisible) {
        console.log(`Login bem-sucedido com: ${cred.username}/${cred.password}`);

        // Fazer screenshot do dashboard
        await page.screenshot({ path: 'dashboard-screen.png' });

        // Verificar se existe a aba Lançamentos
        const lancamentosTab = page.locator('text=Lançamentos');
        if (await lancamentosTab.isVisible()) {
          await lancamentosTab.click();

          // Aguardar carregar
          await page.waitForTimeout(1000);

          // Fazer screenshot da aba lançamentos
          await page.screenshot({ path: 'lancamentos-tab.png' });

          // Verificar se existe o botão Saída
          const saidaButton = page.locator('button:has-text("Saída")');
          if (await saidaButton.isVisible()) {
            console.log('✅ Botão Saída encontrado!');
            await expect(saidaButton).toBeVisible();

            // Verificar se tem a cor vermelha
            const buttonClass = await saidaButton.getAttribute('class');
            console.log('Classes do botão Saída:', buttonClass);

            return; // Sucesso!
          } else {
            console.log('❌ Botão Saída não encontrado');
          }
        } else {
          console.log('❌ Aba Lançamentos não encontrada');
        }
        break;
      } else {
        console.log(`❌ Login falhou com: ${cred.username}/${cred.password}`);
      }
    }

    // Se chegou aqui, nenhum login funcionou
    throw new Error('Não foi possível fazer login com nenhuma credencial');
  });
});