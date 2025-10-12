import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();

// Capture ALL console messages with type
page.on('console', msg => {
  const type = msg.type();
  const text = msg.text();
  const args = msg.args();

  console.log(`[CONSOLE:${type.toUpperCase()}] ${text}`);

  // For error types, try to get more details
  if (type === 'error') {
    args.forEach(async (arg, i) => {
      try {
        const json = await arg.jsonValue();
        console.log(`[ERROR_ARG_${i}]`, JSON.stringify(json, null, 2));
      } catch (e) {
        // Can't serialize, try toString
        try {
          const str = await arg.evaluate(obj => {
            if (obj instanceof Error) {
              return {
                message: obj.message,
                stack: obj.stack,
                name: obj.name
              };
            }
            return String(obj);
          });
          console.log(`[ERROR_ARG_${i}]`, JSON.stringify(str, null, 2));
        } catch (e2) {
          console.log(`[ERROR_ARG_${i}] Could not serialize`);
        }
      }
    });
  }
});

// Capture page errors (uncaught exceptions)
page.on('pageerror', error => {
  console.log('[PAGE_ERROR]', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
});

// Capture failed requests
page.on('requestfailed', request => {
  console.log('[REQUEST_FAILED]', request.url(), request.failure()?.errorText);
});

console.log('Opening page...');
await page.goto('http://localhost:8080/404', {
  waitUntil: 'networkidle0',
  timeout: 30000
});

console.log('Waiting 3 seconds...');
await page.waitForTimeout(3000);

console.log('Pressing "s" to enable shaders...');
await page.keyboard.press('s');

console.log('Waiting 1 second...');
await page.waitForTimeout(1000);

console.log('Pressing "m" to toggle Mega Bezel...');
await page.keyboard.press('m');

console.log('Waiting 10 seconds for shader loading...');
await page.waitForTimeout(10000);

console.log('Capturing final console state...');

// Try to get error details from window
const errorDetails = await page.evaluate(() => {
  return {
    hasErrors: window.console?.errors?.length || 0,
    lastError: window.lastError || null
  };
});

console.log('[ERROR_DETAILS]', JSON.stringify(errorDetails, null, 2));

await browser.close();
console.log('Done.');
