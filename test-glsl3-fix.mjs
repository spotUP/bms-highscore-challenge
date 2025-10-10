import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,  // Show browser for visual confirmation
    args: ['--no-sandbox'],
    devtools: true  // Open DevTools automatically
  });

  const page = await browser.newPage();

  console.log('🚀 Opening shader demo page with DevTools...');
  console.log('⏰ Page will stay open for 60 seconds for manual inspection');
  console.log('👀 Check the console for errors!\n');

  const errors = [];
  const successes = [];

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('ERROR') || text.includes('error')) {
      errors.push(text);
      console.log('❌', text.substring(0, 150));
    }

    if (text.includes('✅') || text.includes('SUCCESS') || text.includes('compiled successfully')) {
      successes.push(text);
      console.log('✅', text.substring(0, 150));
    }
  });

  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for shaders to compile
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n📊 SUMMARY:');
  console.log(`Errors: ${errors.length}`);
  console.log(`Successes: ${successes.length}`);

  if (errors.length === 0) {
    console.log('\n🎉 NO ERRORS! The fix appears to be working!');
  } else {
    console.log('\n⚠️  Still have errors - needs more investigation');
  }

  console.log('\n⏳ Keeping browser open for 50 more seconds...');
  await new Promise(resolve => setTimeout(resolve, 50000));

  await browser.close();
  console.log('\n✨ Test complete!');
})();
