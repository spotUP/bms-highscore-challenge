import puppeteer from 'puppeteer';

async function checkLayoutDebug() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const layoutLogs = [];

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Added layout qualifiers') || text.includes('layout(location')) {
      layoutLogs.push(text);
    }
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for shader compilation...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n=== LAYOUT QUALIFIER DEBUG LOGS ===');
    if (layoutLogs.length > 0) {
      console.log(`✓ Found ${layoutLogs.length} layout-related logs:`);
      layoutLogs.forEach(log => console.log(log));
    } else {
      console.log('❌ No layout qualifier logs found');
      console.log('This could mean:');
      console.log('1. Shaders don\'t have Position/TexCoord attributes');
      console.log('2. The conversion isn\'t being applied');
      console.log('3. Shaders are using default vertex shader (which already has layout qualifiers)');
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

checkLayoutDebug();
