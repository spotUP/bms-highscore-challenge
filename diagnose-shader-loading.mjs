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

    // Show shader loading related messages
    if (text.includes('[WebGL2DWithShaders]') ||
        text.includes('SHADER') ||
        text.includes('shader') ||
        text.includes('Preset') ||
        text.includes('preset') ||
        text.includes('enabled') ||
        text.includes('PureWebGL2MultiPass')) {
      console.log(text);
    }
  });

  page.on('pageerror', error => {
    console.log(`💥 PAGE ERROR: ${error.message}`);
  });

  console.log('🌐 Navigating to http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('\n⏳ Waiting 10 seconds for shaders to compile...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSTIC SUMMARY');
  console.log('='.repeat(80));

  // Search for key messages
  const loadingStarted = logs.some(l => l.includes('Loading shader preset'));
  const presetLoaded = logs.some(l => l.includes('Preset loaded successfully') || l.includes('SHADER PRESET LOADED'));
  const shadersEnabled = logs.some(l => l.includes('shadersEnabled = true'));
  const shadersActive = logs.some(l => l.includes('MEGA BEZEL SHADERS NOW ACTIVE'));

  console.log(`Loading Started: ${loadingStarted ? '✅' : '❌'}`);
  console.log(`Preset Loaded: ${presetLoaded ? '✅' : '❌'}`);
  console.log(`Shaders Enabled: ${shadersEnabled ? '✅' : '❌'}`);
  console.log(`Shaders Active: ${shadersActive ? '✅' : '❌'}`);

  // Look for errors
  const errors = logs.filter(l => l.includes('ERROR') || l.includes('Failed') || l.includes('failed'));
  if (errors.length > 0) {
    console.log(`\n❌ Found ${errors.length} errors:`);
    errors.slice(0, 5).forEach(err => console.log(`  - ${err.substring(0, 100)}`));
  }

  console.log('\n⏸️  Keeping browser open for inspection. Press Ctrl+C to close.');
  await new Promise(() => {});
})();
