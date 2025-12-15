const https = require('https');
const fs = require('fs');
const path = require('path');

const fileKey = 'c1QOl8EocqBiGd6R2NzrFn';
const nodes = {
  icon: { id: '1789:99', output: 'assets/branding/icon.png', expectedSize: '1024x1024' },
  adaptiveIcon: { id: '1789:74', output: 'assets/branding/adaptive icon foreground.png', expectedSize: '1024x1024' },
  splash: { id: '1789:23', output: 'assets/branding/splash.png', expectedSize: '1284x2778' }
};

// Tentar diferentes formatos de URL de exportação do Figma
function tryExportUrl(nodeId, format = 'png', scale = 1) {
  const nodeIdEncoded = encodeURIComponent(nodeId);
  const nodeIdDash = nodeId.replace(':', '-');
  
  return [
    `https://www.figma.com/api/mcp/export/${fileKey}/${nodeIdEncoded}?format=${format}&scale=${scale}`,
    `https://www.figma.com/api/file/${fileKey}/images?ids=${nodeIdEncoded}&format=${format}&scale=${scale}`,
    `https://www.figma.com/file/${fileKey}/export?ids=${nodeIdDash}&format=${format}&scale=${scale}`,
    `https://www.figma.com/api/mcp/file/${fileKey}/node/${nodeIdEncoded}/export?format=${format}&scale=${scale}`
  ];
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    const request = https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(outputPath, () => {});
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    
    request.on('error', (err) => {
      file.close();
      fs.unlink(outputPath, () => {});
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      file.close();
      fs.unlink(outputPath, () => {});
      reject(new Error('Timeout'));
    });
  });
}

async function tryExportNode(nodeName, nodeInfo) {
  console.log(`\nTentando exportar ${nodeName} (${nodeInfo.id})...`);
  const urls = tryExportUrl(nodeInfo.id);
  
  for (let i = 0; i < urls.length; i++) {
    try {
      console.log(`  Tentativa ${i + 1}: ${urls[i]}`);
      await downloadFile(urls[i], nodeInfo.output);
      
      // Verificar se o arquivo foi baixado e tem conteúdo
      const stats = fs.statSync(nodeInfo.output);
      if (stats.size > 0) {
        console.log(`  ✓ ${nodeName} exportado com sucesso! (${stats.size} bytes)`);
        return true;
      }
    } catch (error) {
      // Continuar para próxima URL
      if (fs.existsSync(nodeInfo.output)) {
        fs.unlinkSync(nodeInfo.output);
      }
    }
  }
  
  console.log(`  ✗ Não foi possível exportar ${nodeName} automaticamente.`);
  return false;
}

async function main() {
  const brandingDir = path.join(__dirname, 'assets', 'branding');
  if (!fs.existsSync(brandingDir)) {
    fs.mkdirSync(brandingDir, { recursive: true });
  }

  console.log('Tentando exportar nodes completos do Figma...');
  
  const results = {};
  for (const [name, info] of Object.entries(nodes)) {
    results[name] = await tryExportNode(name, info);
  }
  
  console.log('\n=== Resumo ===');
  for (const [name, success] of Object.entries(results)) {
    console.log(`${name}: ${success ? '✓' : '✗'}`);
  }
  
  if (!Object.values(results).every(v => v)) {
    console.log('\nNota: Alguns assets podem precisar ser exportados manualmente do Figma.');
    console.log('No Figma, selecione o node e use Export > PNG > 1x');
  }
}

main().catch(console.error);

