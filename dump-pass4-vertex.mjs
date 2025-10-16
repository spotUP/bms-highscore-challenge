import puppeteer from 'puppeteer';

async function dumpVertexShader() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  try {
    console.log('Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Find the vertex shader compilation logs for pass_4
    let capturing = false;
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      if (log.includes('Loading shader: pass_4')) {
        capturing = true;
        console.log('\n=== PASS_4 VERTEX SHADER ===\n');
      }

      if (capturing && log.includes('layout(location = 0) in vec4 Position')) {
        // Found the vertex shader - print next 20 lines
        for (let j = i; j < Math.min(i + 30, logs.length); j++) {
          console.log(logs[j]);
        }
        break;
      }
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

dumpVertexShader();
