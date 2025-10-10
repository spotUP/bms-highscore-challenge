#!/usr/bin/env node
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(`[BROWSER] ${text}`);
  });

  // Navigate to shader demo page
  console.log('⏳ Loading shader demo page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 15000
  });

  // Wait for shaders to initialize
  console.log('⏳ Waiting for shaders to initialize...');
  await page.waitForTimeout(5000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/shader-demo.jpeg', type: 'jpeg', quality: 80 });
  console.log('📸 Screenshot saved to /tmp/shader-demo.jpeg');

  // Check for specific issues
  console.log('\n📊 Analysis:');

  const textureErrors = logs.filter(l => l.includes('Failed to load texture'));
  console.log(`\n❌ Texture loading errors: ${textureErrors.length}`);
  if (textureErrors.length > 0) {
    textureErrors.slice(0, 5).forEach(e => console.log(`   ${e}`));
  }

  const nullUniforms = logs.filter(l => l.includes('has null value'));
  console.log(`\n⚠️  Null uniform warnings: ${nullUniforms.length}`);
  if (nullUniforms.length > 0) {
    nullUniforms.slice(0, 5).forEach(e => console.log(`   ${e}`));
  }

  const compileErrors = logs.filter(l => l.toLowerCase().includes('compile') && l.toLowerCase().includes('error'));
  console.log(`\n❌ Compilation errors: ${compileErrors.length}`);
  if (compileErrors.length > 0) {
    compileErrors.slice(0, 5).forEach(e => console.log(`   ${e}`));
  }

  const renderSuccess = logs.filter(l => l.includes('render successful') || l.includes('Pipeline complete'));
  console.log(`\n✅ Render success messages: ${renderSuccess.length}`);

  console.log('\n✅ Done! Check screenshot at /tmp/shader-demo.jpeg');

  await browser.close();
})();
