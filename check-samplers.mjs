import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    // Capture sampler-related logs
    if (text.includes('Processing binding') && text.includes('sampler')) {
      logs.push(text);
    }
    if (text.includes('Extracted samplers:')) {
      logs.push(text);
    }
    if (text.includes('uniform sampler')) {
      logs.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 8000));
  } catch (e) {}

  console.log('=== SAMPLER PROCESSING ===');
  logs.forEach(log => console.log(log));

  await browser.close();
})();
