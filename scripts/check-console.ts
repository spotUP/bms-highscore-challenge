import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const errors: string[] = [];
  const warnings: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();

    if (type === 'error') {
      errors.push(text);
      console.log(`❌ ERROR: ${text}`);
    } else if (type === 'warning') {
      warnings.push(text);
      console.log(`⚠️  WARNING: ${text}`);
    } else if (text.includes('SlangCompiler') || text.includes('pass_') || text.includes('shader')) {
      console.log(`ℹ️  INFO: ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.log(`❌ PAGE ERROR: ${error.message}`);
  });

  console.log('🌐 Opening http://localhost:8080/404...');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle2',
    timeout: 20000
  });

  // Wait for page to load
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Press S key to enable shaders
  console.log('🔧 Pressing S key to enable shaders...');
  await page.keyboard.press('s');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Press M key to enable Mega Bezel
  console.log('🎨 Pressing M key to enable Mega Bezel...');
  await page.keyboard.press('m');

  // Wait for shaders to compile
  console.log('⏳ Waiting for shaders to compile...');
  await new Promise(resolve => setTimeout(resolve, 8000));

  console.log('\n📊 Summary:');
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS DETECTED - shader compilation likely failed');
    process.exit(1);
  } else {
    console.log('\n✅ No console errors detected');
  }

  await browser.close();
})();
