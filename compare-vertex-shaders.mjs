import puppeteer from 'puppeteer';

async function compareVertexShaders() {
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
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for shaders to compile...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find pass_3 vertex shader
    let pass3Start = -1;
    let pass3End = -1;
    let pass4Start = -1;
    let pass4End = -1;

    for (let i = 0; i < logs.length; i++) {
      if (logs[i].includes('=== PASS_3 VERTEX SHADER ATTRIBUTES ===')) {
        pass3Start = i + 1;
      }
      if (logs[i].includes('=== END PASS_3 VERTEX SHADER ===')) {
        pass3End = i;
      }
      if (logs[i].includes('=== PASS_4 VERTEX SHADER ATTRIBUTES ===')) {
        pass4Start = i + 1;
      }
      if (logs[i].includes('=== END PASS_4 VERTEX SHADER ===')) {
        pass4End = i;
      }
    }

    console.log('\n=== PASS_3 VERTEX SHADER (WORKING) ===\n');
    if (pass3Start !== -1 && pass3End !== -1) {
      for (let i = pass3Start; i < pass3End; i++) {
        console.log(logs[i]);
      }
    } else {
      console.log('❌ NOT FOUND');
    }

    console.log('\n=== PASS_4 VERTEX SHADER (BROKEN) ===\n');
    if (pass4Start !== -1 && pass4End !== -1) {
      for (let i = pass4Start; i < pass4End; i++) {
        console.log(logs[i]);
      }
    } else {
      console.log('❌ NOT FOUND');
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

compareVertexShaders();
