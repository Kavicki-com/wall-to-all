#!/usr/bin/env node

/**
 * Script auxiliar para substituir console.log por logger
 * 
 * USO:
 *   node scripts/replace-console-logs.js <arquivo>
 * 
 * Exemplo:
 *   node scripts/replace-console-logs.js app/(auth)/reset-password.tsx
 * 
 * NOTA: Este script faz backup do arquivo original antes de modificar
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];

if (!filePath) {
  console.error('Erro: Forneça o caminho do arquivo');
  console.log('Uso: node scripts/replace-console-logs.js <arquivo>');
  process.exit(1);
}

const fullPath = path.resolve(filePath);

if (!fs.existsSync(fullPath)) {
  console.error(`Erro: Arquivo não encontrado: ${fullPath}`);
  process.exit(1);
}

// Ler arquivo
let content = fs.readFileSync(fullPath, 'utf8');

// Verificar se já importa logger
const hasLoggerImport = content.includes("from '../lib/logger'") || 
                        content.includes("from '../../lib/logger'") ||
                        content.includes("from '../../../lib/logger'") ||
                        content.includes("from '../../../../lib/logger'");

// Adicionar import se não existir
if (!hasLoggerImport) {
  // Tentar encontrar onde adicionar o import
  const importMatch = content.match(/^import .* from ['"]/m);
  if (importMatch) {
    // Calcular caminho relativo para logger
    const depth = (filePath.match(/\//g) || []).length;
    const relativePath = '../'.repeat(depth - 1) + 'lib/logger';
    const loggerImport = `import { logger } from '${relativePath}';\n`;
    
    // Adicionar após o primeiro import
    const firstImportIndex = content.indexOf('import');
    const firstImportEnd = content.indexOf('\n', firstImportIndex);
    content = content.slice(0, firstImportEnd + 1) + loggerImport + content.slice(firstImportEnd + 1);
  }
}

// Substituições
const replacements = [
  // console.log com __DEV__
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

if (!modified) {
  console.log('Nenhuma substituição necessária.');
  process.exit(0);
}

// Fazer backup
const backupPath = fullPath + '.backup';
fs.writeFileSync(backupPath, fs.readFileSync(fullPath));
console.log(`Backup criado: ${backupPath}`);

// Escrever arquivo modificado
fs.writeFileSync(fullPath, content);
console.log(`Arquivo modificado: ${fullPath}`);
console.log('Revisar as mudanças antes de commitar!');

