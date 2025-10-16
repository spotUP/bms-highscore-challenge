import puppeteer from 'puppeteer';

async function checkRendering() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const shaderLogs = [];
  const textureLogs = [];
  const passLogs = [];

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('[SlangCompiler]') && text.includes('layout')) {
      shaderLogs.push(text);
    }
    if (text.includes('texture') || text.includes('Texture') || text.includes('TEXTURE')) {
      textureLogs.push(text);
    }
    if (text.includes('pass') || text.includes('Pass')) {
      passLogs.push(text);
    }
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for shader compilation...');
    await new Promise(resolve => setTimeout(resolve, 12000));

    console.log('\n=== SHADER LAYOUT LOGS ===');
    shaderLogs.slice(-10).forEach(log => console.log(log));

    console.log('\n=== TEXTURE BINDING LOGS ===');
    textureLogs.slice(-15).forEach(log => console.log(log));

    console.log('\n=== PASS RENDERING LOGS ===');
    passLogs.slice(-10).forEach(log => console.log(log));

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

checkRendering();
