#!/usr/bin/env node

/**
 * Script para substituir console.log por logger em múltiplos arquivos
 * 
 * USO:
 *   node scripts/replace-all-console-logs.js
 *   (processa todos os arquivos TypeScript/TSX do projeto)
 * 
 * OU:
 *   node scripts/replace-all-console-logs.js <arquivo1> <arquivo2> ...
 *   (processa arquivos específicos)
 * 
 * NOTA: Este script faz backup dos arquivos antes de modificar
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Lista de arquivos prioritários (mais críticos primeiro)
const priorityFiles = [
  'app/(auth)/reset-password.tsx',
  'lib/useDeepLinking.ts',
  'app/_layout.tsx',
  'context/AuthContext.tsx',
  'context/ProfileContext.tsx',
  'context/BusinessProfileContext.tsx',
  'lib/notifications.ts',
  'app/(client)/profile/index.tsx',
  'app/(merchant)/profile/index.tsx',
  'app/(merchant)/dashboard/index.tsx',
  'app/(client)/appointments/index.tsx',
  'app/(merchant)/home/index.tsx',
  'app/(merchant)/services/index.tsx',
  'app/(auth)/client-signup-loading.tsx',
  'app/(auth)/merchant-signup-loading.tsx',
  'app/(auth)/client-signup-address.tsx',
  'app/(auth)/merchant-signup-address.tsx',
  'app/(auth)/merchant-signup-business.tsx',
  'app/(merchant)/dashboard/month.tsx',
  'app/(merchant)/services/create.tsx',
  'app/(merchant)/profile/edit.tsx',
  'app/(client)/profile/edit.tsx',
  'app/(client)/schedule/confirm.tsx',
  'app/(client)/schedule/service.tsx',
  'app/(client)/schedule/time.tsx',
  'app/(client)/store/[id].tsx',
  'app/(client)/appointments/reschedule.tsx',
  'app/(client)/appointments/[id].tsx',
  'app/(merchant)/dashboard/appointment/reschedule.tsx',
  'app/(merchant)/dashboard/appointment/reschedule-confirm.tsx',
  'app/(merchant)/dashboard/appointment/confirm.tsx',
  'app/(merchant)/services/edit/[id].tsx',
  'app/(merchant)/settings/index.tsx',
  'app/(client)/search/index.tsx',
  'lib/categories.ts',
  'components/notifications/NotificationModal.tsx',
  'components/layout/AppHeader.tsx',
  'components/ui/ServiceImagePicker.tsx',
  'components/appointments/MerchantRescheduleConfirmCard.tsx',
];

// Função para calcular caminho relativo para logger
function getLoggerImportPath(filePath) {
  const depth = (filePath.match(/\//g) || []).length;
  if (depth === 1) return '../lib/logger';
  if (depth === 2) return '../../lib/logger';
  if (depth === 3) return '../../../lib/logger';
  if (depth === 4) return '../../../../lib/logger';
  if (depth === 5) return '../../../../../lib/logger';
  return '../../../lib/logger'; // fallback
}

// Função para substituir console.log em um arquivo
function replaceConsoleLogs(filePath) {
  const fullPath = path.resolve(filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `Arquivo não encontrado: ${filePath}` };
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;

  // Verificar se já importa logger
  const hasLoggerImport = /from ['"].*lib\/logger['"]/.test(content);
  
  // Verificar se tem console.log para substituir
  const hasConsoleLogs = /console\.(log|warn|error|debug|info)\(/.test(content);
  
  if (!hasConsoleLogs) {
    return { success: false, skipped: true, message: 'Sem console.log para substituir' };
  }

  // Adicionar import se não existir
  if (!hasLoggerImport) {
    const loggerPath = getLoggerImportPath(filePath);
    const loggerImport = `import { logger } from '${loggerPath}';\n`;
    
    // Encontrar última linha de import
    const importLines = content.match(/^import .* from ['"].*['"];?$/gm);
    if (importLines && importLines.length > 0) {
      const lastImport = importLines[importLines.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertIndex = content.indexOf('\n', lastImportIndex) + 1;
      content = content.slice(0, insertIndex) + loggerImport + content.slice(insertIndex);
    } else {
      // Se não houver imports, adicionar no início
      content = loggerImport + content;
    }
  }

  // Substituições
  const replacements = [
    // console.log com __DEV__ (manter a verificação)
    {
      pattern: /if\s*\(__DEV__\)\s*\{\s*console\.log\(/g,
      replacement: 'if (__DEV__) { logger.debug('
    },
    // console.log simples
    {
      pattern: /console\.log\(/g,
      replacement: 'logger.debug('
    },
    // console.warn
    {
      pattern: /console\.warn\(/g,
      replacement: 'logger.warn('
    },
    // console.error
    {
      pattern: /console\.error\(/g,
      replacement: 'logger.error('
    },
    // console.info
    {
      pattern: /console\.info\(/g,
      replacement: 'logger.info('
    },
  ];

  let modified = false;
  replacements.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  if (!modified || content === originalContent) {
    return { success: false, skipped: true, message: 'Nenhuma mudança necessária' };
  }

  // Fazer backup
  const backupPath = fullPath + '.backup';
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, originalContent);
  }

  // Escrever arquivo modificado
  fs.writeFileSync(fullPath, content);
  return { success: true, backup: backupPath };
}

// Processar arquivos
const filesToProcess = process.argv.length > 2 
  ? process.argv.slice(2) 
  : priorityFiles;

console.log('🔄 Processando substituição de console.log por logger...\n');
console.log(`📁 Arquivos a processar: ${filesToProcess.length}\n`);

let processed = 0;
let skipped = 0;
let failed = 0;
const results = [];

filesToProcess.forEach(file => {
  try {
    const result = replaceConsoleLogs(file);
    
    if (result.success) {
      console.log(`✅ ${file}`);
      if (result.backup) {
        console.log(`   📦 Backup: ${result.backup}`);
      }
      processed++;
      results.push({ file, status: 'success' });
    } else if (result.skipped) {
      console.log(`⏭️  ${file} (${result.message || 'já atualizado ou sem console.log'})`);
      skipped++;
      results.push({ file, status: 'skipped' });
    } else {
      console.error(`❌ ${file}: ${result.error || 'erro desconhecido'}`);
      failed++;
      results.push({ file, status: 'failed', error: result.error });
    }
  } catch (error) {
    console.error(`❌ ${file}: ${error.message}`);
    failed++;
    results.push({ file, status: 'failed', error: error.message });
  }
});

console.log(`\n📊 Resumo:`);
console.log(`✅ Processados: ${processed}`);
console.log(`⏭️  Ignorados: ${skipped}`);
console.log(`❌ Falhas: ${failed}`);

if (processed > 0) {
  console.log(`\n⚠️  ${processed} arquivo(s) modificado(s). Revise as mudanças antes de commitar!`);
  console.log(`💡 Use git diff para ver as mudanças`);
}

if (failed > 0) {
  console.log(`\n❌ Alguns arquivos falharam. Revise os erros acima.`);
  process.exit(1);
}

process.exit(0);

