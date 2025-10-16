import puppeteer from 'puppeteer';

async function checkTextureDebug() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const messages = [];

  page.on('console', msg => {
    const text = msg.text();
    messages.push(text);
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting 15 seconds for rendering...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n=== SEARCHING FOR TEXTURE DEBUG MESSAGES ===');

    const textureVerifyLogs = messages.filter(m =>
      m.includes('TEXTURE BINDING VERIFICATION') ||
      m.includes('Pixel readback') ||
      m.includes('WHITE') ||
      m.includes('rgb(') ||
      m.includes('Texture contains') ||
      m.includes('texture sampling')
    );

    if (textureVerifyLogs.length > 0) {
      console.log('Found texture debug logs:');
      textureVerifyLogs.forEach(log => console.log(log));
    } else {
      console.log('No texture debug logs found - may need to add debug logging');
    }

    console.log('\n=== PASS RENDERING STATUS ===');
    const passStatus = messages.filter(m =>
      m.includes('pass_') && (m.includes('render') || m.includes('output') || m.includes('complete'))
    );
    passStatus.slice(-5).forEach(log => console.log(log));

    console.log('\n=== ANY ERRORS ===');
    const errors = messages.filter(m =>
      m.toLowerCase().includes('error') || m.toLowerCase().includes('failed')
    );
    if (errors.length > 0) {
      errors.slice(-5).forEach(log => console.log(log));
    } else {
      console.log('✓ No errors found');
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

checkTextureDebug();
