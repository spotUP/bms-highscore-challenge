import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const messages = [];
  
  page.on('console', msg => {
    const msgType = msg.type();
    const text = msg.text();
    messages.push({ type: msgType, text: text, timestamp: Date.now() });
    
    if (text.includes('Failed') || text.includes('ERROR') || text.includes('Bypassing') || 
        text.includes('RENDERING FAILED') || text.includes('shadersFailed')) {
      console.log('[' + msgType + '] ' + text);
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR: ' + error.message);
    messages.push({ type: 'pageerror', text: error.message, timestamp: Date.now() });
  });

  console.log('Loading game...');
  const startTime = Date.now();
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });
  
  console.log('Clicking to dismiss audio prompt...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.mouse.click(285, 285);
  
  console.log('Monitoring for 10 seconds...');
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const shaderMsgs = messages.filter(m => m.text.includes('shadersEnabled='));
    const lastShader = shaderMsgs.length > 0 ? shaderMsgs[shaderMsgs.length - 1].text : 'none';
    const match = lastShader.match(/shadersEnabled=(\w+)/);
    const status = match ? match[1] : 'unknown';
    console.log('Second ' + (i+1) + '/10 (' + elapsed + 's) - Status: ' + status);
  }

  console.log('\nANALYSIS:');

  const errors = messages.filter(m => 
    m.text.includes('ERROR') || 
    m.text.includes('Failed') ||
    m.text.includes('Bypassing') ||
    m.text.includes('RENDERING FAILED')
  );

  if (errors.length > 0) {
    console.log('\nERRORS FOUND:');
    errors.forEach(e => console.log('  [' + e.type + '] ' + e.text));
  } else {
    console.log('\nNo errors found');
  }

  const shaderStates = messages.filter(m => m.text.includes('shadersEnabled='));
  console.log('\nSHADER STATE CHANGES:');
  shaderStates.forEach(s => {
    const elapsed = ((s.timestamp - startTime) / 1000).toFixed(1);
    console.log('  ' + elapsed + 's: ' + s.text);
  });

  const passExec = messages.filter(m => m.text.includes('All') && m.text.includes('passes executed'));
  console.log('\nPASS EXECUTION SUCCESS: ' + passExec.length + ' occurrences');
  if (passExec.length > 0) {
    console.log('  First: ' + passExec[0].text);
    console.log('  Last: ' + passExec[passExec.length - 1].text);
  }

  await browser.close();
})();
