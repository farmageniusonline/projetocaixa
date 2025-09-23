import { test, expect } from '@playwright/test';

test('Descobrir conteúdo real da aba Lançamentos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175');

  // Login
  await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
  await page.fill('[data-testid="password-input"]', 'manipularium');
  await page.click('[data-testid="login-button"]');
  await page.waitForTimeout(3000);

  console.log('=== DESCOBRINDO CONTEÚDO DA ABA LANÇAMENTOS ===');

  // Clicar na aba Lançamentos
  const launchTab = page.locator('text=Lançamentos');
  await launchTab.click();
  await page.waitForTimeout(3000);

  // Capturar TODOS os h1, h2, h3 da página
  console.log('\n📋 TÍTULOS ENCONTRADOS:');

  const h1Elements = page.locator('h1');
  const h1Count = await h1Elements.count();
  for (let i = 0; i < h1Count; i++) {
    const text = await h1Elements.nth(i).textContent();
    console.log(`  H1 ${i + 1}: "${text}"`);
  }

  const h2Elements = page.locator('h2');
  const h2Count = await h2Elements.count();
  for (let i = 0; i < h2Count; i++) {
    const text = await h2Elements.nth(i).textContent();
    console.log(`  H2 ${i + 1}: "${text}"`);
  }

  const h3Elements = page.locator('h3');
  const h3Count = await h3Elements.count();
  for (let i = 0; i < h3Count; i++) {
    const text = await h3Elements.nth(i).textContent();
    console.log(`  H3 ${i + 1}: "${text}"`);
  }

  // Procurar por todos os botões
  console.log('\n🔘 BOTÕES ENCONTRADOS:');
  const buttons = page.locator('button');
  const buttonCount = await buttons.count();
  for (let i = 0; i < Math.min(buttonCount, 15); i++) {
    const text = await buttons.nth(i).textContent();
    const className = await buttons.nth(i).getAttribute('class');
    const dataAttrs = await buttons.nth(i).evaluate(el => {
      const attrs = [];
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-')) {
          attrs.push(`${attr.name}="${attr.value}"`);
        }
      }
      return attrs.join(' ');
    });
    console.log(`  Botão ${i + 1}: "${text}" | ${dataAttrs}`);
  }

  // Procurar por inputs
  console.log('\n📝 INPUTS ENCONTRADOS:');
  const inputs = page.locator('input');
  const inputCount = await inputs.count();
  for (let i = 0; i < inputCount; i++) {
    const type = await inputs.nth(i).getAttribute('type');
    const placeholder = await inputs.nth(i).getAttribute('placeholder');
    const name = await inputs.nth(i).getAttribute('name');
    console.log(`  Input ${i + 1}: type="${type}" placeholder="${placeholder}" name="${name}"`);
  }

  // Procurar por qualquer texto que contenha "Lançamento" ou variações
  console.log('\n🎯 TEXTOS RELACIONADOS A LANÇAMENTOS:');
  const launchTexts = page.locator(':has-text("ançament"), :has-text("Lançament"), :has-text("LANÇAMENT")');
  const launchCount = await launchTexts.count();
  for (let i = 0; i < Math.min(launchCount, 10); i++) {
    const text = await launchTexts.nth(i).textContent();
    const tagName = await launchTexts.nth(i).evaluate(el => el.tagName);
    console.log(`  ${tagName}: "${text?.substring(0, 100)}..."`);
  }

  // Procurar por classes ou data-testids úteis
  console.log('\n🏷️ ELEMENTOS COM DATA-TESTID:');
  const dataTestIds = page.locator('[data-testid]');
  const testIdCount = await dataTestIds.count();
  for (let i = 0; i < Math.min(testIdCount, 10); i++) {
    const testId = await dataTestIds.nth(i).getAttribute('data-testid');
    const tagName = await dataTestIds.nth(i).evaluate(el => el.tagName);
    const text = await dataTestIds.nth(i).textContent();
    console.log(`  ${tagName}[data-testid="${testId}"]: "${text?.substring(0, 50)}..."`);
  }

  // Screenshot para análise visual
  await page.screenshot({
    path: 'descobrir-conteudo-lancamentos.png',
    fullPage: true
  });

  console.log('\n📸 Screenshot salvo: descobrir-conteudo-lancamentos.png');
  console.log('🔍 Análise de conteúdo concluída!');
});