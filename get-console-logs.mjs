import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Collect console messages
  const messages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    messages.push({ type, text });
  });
  
  // Navigate to the page
  console.log('Navigating to http://localhost:8080/slang-demo...');
  await page.goto('http://localhost:8080/slang-demo', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });
  
  // Wait for the app to initialize and render a few frames
  console.log('Waiting for app to initialize...');
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  // Print all console messages  
  console.log('\n=== BROWSER CONSOLE OUTPUT ===\n');
  messages.forEach(msg => {
    console.log(`[${msg.type}] ${msg.text}`);
  });
  console.log('\n=== END CONSOLE OUTPUT ===\n');
  console.log(`Total messages: ${messages.length}`);
  
  await browser.close();
})();
