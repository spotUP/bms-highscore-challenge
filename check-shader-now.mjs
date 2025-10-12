import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  const errors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  console.log('🔍 Loading page...');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle2',
    timeout: 15000
  });

  console.log('⏳ Waiting for shaders to compile...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n🎨 Shader compilation logs:');
  const shaderLogs = logs.filter(l => 
    l.includes('PureWebGL2') || 
    l.includes('pass_') ||
    l.includes('Vertex shader') ||
    l.includes('Fragment shader') ||
    l.includes('compilation') ||
    l.includes('Preset loaded') ||
    l.includes('MEGA BEZEL')
  );
  
  shaderLogs.slice(-30).forEach(log => console.log('  ', log));

  console.log('\n❌ Errors found:');
  if (errors.length === 0) {
    console.log('  ✅ No errors!');
  } else {
    errors.slice(-10).forEach(err => console.log('  ', err));
  }

  console.log('\n🔍 Shader status logs:');
  const statusLogs = logs.filter(l =>
    l.includes('shadersEnabled') ||
    l.includes('Shaders') ||
    l.includes('bypassing')
  );
  statusLogs.slice(-10).forEach(log => console.log('  ', log));

  await browser.close();
})();
