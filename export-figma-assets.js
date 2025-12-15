const https = require('https');
const fs = require('fs');
const path = require('path');

// URLs dos assets do Figma MCP obtidas do get_design_context
const assets = {
  icon: {
    nodeId: '1789:99',
    url: 'https://www.figma.com/api/mcp/asset/c6528d81-6b62-4dcc-81c4-4086f0ff0679',
    output: 'assets/branding/icon.png'
  },
  adaptiveIcon: {
    nodeId: '1789:74',
    url: 'https://www.figma.com/api/mcp/asset/ffc69bc9-a64a-40c6-a4c2-8336918512d4',
    output: 'assets/branding/adaptive icon foreground.png'
  },
  splash: {
    nodeId: '1789:23',
    // Para splash, precisamos compor a imagem ou obter a URL completa
    // Por enquanto, vamos tentar usar a URL do bricks como base
    url: 'https://www.figma.com/api/mcp/asset/557da9d4-57d8-4861-ad48-c64d63a8b4cb',
    output: 'assets/branding/splash.png'
  }
};

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Seguir redirect
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  // Garantir que o diretório existe
  const brandingDir = path.join(__dirname, 'assets', 'branding');
  if (!fs.existsSync(brandingDir)) {
    fs.mkdirSync(brandingDir, { recursive: true });
  }

  console.log('Baixando assets do Figma...');
  
  // Baixar ícone
  try {
    console.log('Baixando ícone...');
    await downloadFile(assets.icon.url, assets.icon.output);
    console.log(`✓ Ícone salvo em ${assets.icon.output}`);
  } catch (error) {
    console.error('Erro ao baixar ícone:', error.message);
  }

  // Baixar adaptive icon
  try {
    console.log('Baixando adaptive icon...');
    await downloadFile(assets.adaptiveIcon.url, assets.adaptiveIcon.output);
    console.log(`✓ Adaptive icon salvo em ${assets.adaptiveIcon.output}`);
  } catch (error) {
    console.error('Erro ao baixar adaptive icon:', error.message);
  }

  // Para o splash, as URLs são de componentes individuais
  // Precisamos de uma abordagem diferente
  console.log('Nota: Splash screen pode precisar ser exportado manualmente do Figma ou composto a partir de múltiplos assets.');
}

main().catch(console.error);

