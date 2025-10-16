import puppeteer from 'puppeteer';

async function verifyLayout() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const shaderSources = [];

  page.on('console', msg => {
    const text = msg.text();
    // Capture any shader source that contains vertex shader code
    if (text.includes('layout(location') || (text.includes('#version 300 es') && text.includes('in vec'))) {
      shaderSources.push(text);
    }
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for compilation...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('\n=== CHECKING FOR LAYOUT QUALIFIERS ===');

    const withLayout = shaderSources.filter(s => s.includes('layout(location'));

    if (withLayout.length > 0) {
      console.log(`✓ Found ${withLayout.length} shader sources with layout qualifiers`);

      // Show first few examples
      withLayout.slice(0, 3).forEach((shader, i) => {
        console.log(`\n--- Example ${i + 1} ---`);
        const lines = shader.split('\n');
        const layoutLines = lines.filter(l => l.includes('layout(location'));
        layoutLines.forEach(l => console.log(l.trim()));
      });
    } else {
      console.log('❌ No layout qualifiers found - fix may not be applied');
    }

    console.log(`\n=== TOTAL SHADER SOURCES CAPTURED: ${shaderSources.length} ===`);

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

verifyLayout();
