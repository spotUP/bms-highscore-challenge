import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const passOutputs = [];
  const pragmaExtractions = [];

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('[PASS OUTPUT]')) {
      passOutputs.push(text);
      console.log('📊', text);
    }

    if (text.includes('[PragmaDefaults]')) {
      pragmaExtractions.push(text);
      console.log('🔧', text);
    }
  });

  try {
    await page.goto('http://localhost:8080/pong', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('⏳ Waiting 3 seconds for shader rendering...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n=== SUMMARY ===');
    console.log(`Pragma extractions: ${pragmaExtractions.length}`);
    console.log(`Pass outputs captured: ${passOutputs.length}`);

    // Show first few pragma extractions
    if (pragmaExtractions.length > 0) {
      console.log('\nFirst 10 pragma extractions:');
      pragmaExtractions.slice(0, 10).forEach(p => console.log('  ', p));
    }

    // Check passes 15 & 16
    const pass15 = passOutputs.find(p => p.includes('pass_15'));
    const pass16 = passOutputs.find(p => p.includes('pass_16'));

    if (pass15) {
      console.log('\n✅ Pass 15 output:', pass15);
    } else {
      console.log('\n⚠️  No pass 15 output found (may need to wait for frame 60)');
    }

    if (pass16) {
      console.log('✅ Pass 16 output:', pass16);
    } else {
      console.log('⚠️  No pass 16 output found (may need to wait for frame 60)');
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
