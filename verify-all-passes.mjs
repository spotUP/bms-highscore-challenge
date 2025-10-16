import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Collect all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
  });

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for shader compilation (increased for complex shaders)
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Find compilation messages
    const compiled = consoleMessages.filter(m => m.includes('Compiled shader') && m.includes('ms'));
    const failed = consoleMessages.filter(m => m.includes('Failed to compile') || m.includes('compilation failed'));
    const errors = consoleMessages.filter(m => m.includes('ERROR:'));

    console.log('\n=== MEGA BEZEL SHADER COMPILATION RESULTS ===\n');

    if (errors.length > 0) {
      console.log(`❌ ${errors.length} COMPILATION ERRORS:\n`);
      errors.slice(0, 5).forEach(e => {
        const passMatch = e.match(/pass_\d+/);
        if (passMatch) {
          console.log(`  ${passMatch[0]}: ${e.substring(e.indexOf('ERROR:'))}`);
        }
      });
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more errors`);
      }
    } else {
      console.log('✅ NO COMPILATION ERRORS');
    }

    console.log(`\n✅ Successfully compiled ${compiled.length} passes\n`);

    // Show all compiled passes
    const passNames = new Set();
    compiled.forEach(m => {
      const match = m.match(/Compiled shader (\w+) in (\d+)ms/);
      if (match) {
        passNames.add(match[1]);
      }
    });

    console.log('Compiled passes:');
    Array.from(passNames).sort().forEach((name, idx) => {
      console.log(`  ${(idx + 1).toString().padStart(2)}. ${name}`);
    });

    console.log(`\n📊 Total unique passes: ${passNames.size}/17`);

    if (passNames.size === 17) {
      console.log('\n🎉 ALL 17 MEGA BEZEL PASSES COMPILED SUCCESSFULLY!\n');
    } else {
      console.log(`\n⚠️  Missing ${17 - passNames.size} passes\n`);
    }

    console.log('=== VERIFICATION COMPLETE ===\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
