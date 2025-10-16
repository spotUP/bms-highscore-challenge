import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Collect all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });

    // Wait 3 seconds for shader compilation
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for pass_0 errors
    const pass0Errors = consoleMessages.filter(m =>
      m.text.includes('pass_0') && m.text.includes('ERROR')
    );

    // Check for "SKIPPING global" messages
    const skippedGlobals = consoleMessages.filter(m =>
      m.text.includes('SKIPPING global') && m.text.includes('conflicts with #define')
    );

    // Check for compilation success
    const compiledPasses = consoleMessages.filter(m =>
      m.text.includes('Compiled shader') && m.text.includes('ms')
    );

    console.log('\n=== PASS 0 FIX VERIFICATION ===\n');

    if (pass0Errors.length > 0) {
      console.log('❌ PASS 0 ERRORS FOUND:');
      pass0Errors.forEach(e => console.log(`  ${e.text}`));
    } else {
      console.log('✅ NO PASS 0 ERRORS');
    }

    console.log(`\n📊 Skipped ${skippedGlobals.length} conflicting globals:`);
    skippedGlobals.forEach(m => console.log(`  ${m.text}`));

    console.log(`\n✅ Successfully compiled ${compiledPasses.length} passes`);

    // Show first few passes
    console.log('\nFirst 5 compiled passes:');
    compiledPasses.slice(0, 5).forEach(m => {
      const match = m.text.match(/Compiled shader (\w+)/);
      if (match) console.log(`  ✓ ${match[1]}`);
    });

    console.log('\n=== VERIFICATION COMPLETE ===\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
