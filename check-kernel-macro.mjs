import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);

    // Capture the compiled fragment shader for pass_7
    if (text.includes('[SlangCompiler] Final compiled fragment shader') && logs[logs.length - 2]?.includes('pass_7')) {
      console.log('\n🔍 PASS_7 FRAGMENT SHADER COMPILATION:');
      console.log(text.substring(0, 500));
    }

    // Look for kernel-related logs
    if (text.includes('kernel')) {
      console.log(`[KERNEL] ${text}`);
    }
  });

  console.log('🎮 Navigating to http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('⏳ Waiting 15 seconds for shaders to compile...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 15000)));

  // Try to get the full compiled shader for pass_7
  console.log('\n📋 Searching for #define kernel in logs...');
  const kernelDefines = logs.filter(l => l.includes('#define kernel'));
  if (kernelDefines.length > 0) {
    console.log('✅ Found #define kernel declarations:');
    kernelDefines.forEach(log => console.log(`  ${log.substring(0, 200)}`));
  } else {
    console.log('❌ No #define kernel found in logs (it may have been stripped!)');
  }

  await browser.close();
  console.log('✅ Test complete!');
})();
