#!/usr/bin/env node

/**
 * Script para corrigir automaticamente issues de lint mais comuns
 */

import fs from 'fs';
import path from 'path';

// Lista de arquivos que precisam de correções específicas
const FIXES = {
  // Remover imports não utilizados
  removeUnusedImports: [
    { file: 'src/components/DataTable.tsx', remove: 'useState' },
    { file: 'src/components/LoginForm.tsx', remove: 'useState' },
    { file: 'src/components/ExportButtons.tsx', remove: 'formatToDDMMYYYY' },
    { file: 'src/components/HistoryByDate.tsx', remove: 'formatDateTimeForDisplay' },
    { file: 'src/components/LaunchTab.test.tsx', remove: 'toast' },
    { file: 'src/utils/valueNormalizer.test.ts', remove: 'vi' }
  ],

  // Remover variáveis não utilizadas
  removeUnusedVars: [
    { file: 'src/components/BackupPanel.tsx', vars: ['currentDate', 'selectedFile'] },
    { file: 'src/components/ReconciliationDashboard.tsx', vars: ['ReconciliationSource', 'selectedMatch'] },
    { file: 'src/components/ProcessingSpinner.tsx', vars: ['stageConfig'] }
  ],

  // Adicionar blocos em case statements
  fixCaseBlocks: [
    'src/components/CashConferenceTable.tsx',
    'src/components/DataTable.tsx',
    'src/utils/reconciliation.ts',
    'src/utils/uploadTest.ts'
  ],

  // Substituir any por unknown
  fixAnyTypes: [
    'src/components/AdvancedFiltersPanel.tsx',
    'src/components/ExportModal.tsx',
    'src/utils/performanceLogger.ts',
    'src/utils/reconciliation.ts',
    'src/utils/smartCache.ts',
    'src/utils/syncExcelProcessor.ts',
    'src/utils/valueNormalizer.ts'
  ]
};

function removeUnusedImport(filePath, importToRemove) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Pattern para remover import específico de destructuring
    const destructuringPattern = new RegExp(
      `import\\s*\\{([^}]*),?\\s*${importToRemove}\\s*,?([^}]*)\\}\\s*from`,
      'g'
    );

    let newContent = content.replace(destructuringPattern, (match, before, after) => {
      const cleanBefore = before.trim().replace(/,$/, '');
      const cleanAfter = after.trim().replace(/^,/, '');

      const remaining = [cleanBefore, cleanAfter].filter(Boolean).join(', ');

      if (remaining) {
        return `import { ${remaining} } from`;
      } else {
        return '// import removed';
      }
    });

    // Remove linha completa se só tinha o import removido
    newContent = newContent.replace(/^\/\/ import removed.*$/gm, '');

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Removed unused import '${importToRemove}' from ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to fix ${filePath}:`, error.message);
  }
}

function addCaseBlocks(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Pattern para encontrar case statements sem blocos
    const casePattern = /case\s+[^:]+:\s*\n\s*(const|let|var)\s+/g;

    const newContent = content.replace(casePattern, (match) => {
      const indent = match.match(/\n(\s*)/)?.[1] || '';
      return match.replace(/:\s*\n\s*(const|let|var)/, `: {\n${indent}  $1`);
    });

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Added case blocks in ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to fix case blocks in ${filePath}:`, error.message);
  }
}

function replaceAnyWithUnknown(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Substituir any por unknown em contexts seguros
    let newContent = content
      .replace(/:\s*any\[\]/g, ': unknown[]')
      .replace(/:\s*any\s*=/g, ': unknown =')
      .replace(/:\s*any\s*\)/g, ': unknown)')
      .replace(/:\s*any\s*,/g, ': unknown,')
      .replace(/:\s*any\s*;/g, ': unknown;')
      .replace(/:\s*any\s*\|/g, ': unknown |')
      .replace(/\|\s*any\s/g, '| unknown ');

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Replaced 'any' with 'unknown' in ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to fix any types in ${filePath}:`, error.message);
  }
}

function removeUnusedVars(filePath, varsToRemove) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;

    varsToRemove.forEach(varName => {
      // Pattern para remover declarações de variáveis não utilizadas
      const varPattern = new RegExp(`\\s*const\\s+${varName}\\s*=.*?;.*?\\n`, 'g');
      const letPattern = new RegExp(`\\s*let\\s+${varName}\\s*=.*?;.*?\\n`, 'g');
      const importPattern = new RegExp(`\\s*${varName}\\s*,?`, 'g');

      newContent = newContent
        .replace(varPattern, '\n')
        .replace(letPattern, '\n')
        .replace(importPattern, '');
    });

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Removed unused variables from ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to remove unused vars in ${filePath}:`, error.message);
  }
}

// Executar correções
console.log('🔧 Starting automated lint fixes...\n');

// 1. Remover imports não utilizados
FIXES.removeUnusedImports.forEach(fix => {
  removeUnusedImport(fix.file, fix.remove);
});

// 2. Remover variáveis não utilizadas
FIXES.removeUnusedVars.forEach(fix => {
  removeUnusedVars(fix.file, fix.vars);
});

// 3. Corrigir case blocks
FIXES.fixCaseBlocks.forEach(file => {
  addCaseBlocks(file);
});

// 4. Substituir any por unknown
FIXES.fixAnyTypes.forEach(file => {
  replaceAnyWithUnknown(file);
});

console.log('\n✅ Automated lint fixes completed!');
console.log('Run "npm run lint" to see remaining issues.');