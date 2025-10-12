import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const messages = [];
  
  page.on('console', msg => messages.push(`[${msg.type()}] ${msg.text()}`));

  console.log('Loading game...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
  
  // Click to dismiss audio prompt
  await page.mouse.click(285, 285);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n=== INITIAL STATE (first 3 seconds) ===');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const initial = messages.filter(m => 
    m.includes('shader') || m.includes('endFrame') || m.includes('Bypassing') || 
    m.includes('ERROR') || m.includes('WebGL')
  );
  initial.slice(-10).forEach(m => console.log(m));

  console.log('\n=== WAITING FOR DEATH (next 3 seconds) ===');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const death = messages.filter(m => 
    m.includes('Bypassing') || m.includes('ERROR') || m.includes('Failed') ||
    m.includes('shadersEnabled=false')
  );
  
  if (death.length > 0) {
    console.log('\n❌ SHADER DEATH DETECTED:');
    death.forEach(m => console.log(m));
  }

  // Get last frame states
  const frames = messages.filter(m => m.includes('endFrame')).slice(-5);
  console.log('\n=== LAST 5 FRAMES ===');
  frames.forEach(m => console.log(m));

  await browser.close();
})();
