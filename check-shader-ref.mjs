import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let hasRef = false;

page.on('console', msg => {
  const text = msg.text();
  console.log(text);

  if (text.includes('webglWithShadersRef exists:')) {
    hasRef = text.includes('true');
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 1000));

// Inject check
const refExists = await page.evaluate(() => {
  // Access React internals to find ref
  const canvas = document.querySelector('canvas');
  if (canvas) {
    const fiber = canvas._reactFiberNode || canvas._reactInternalFiber;
    console.log('Canvas found:', !!canvas);
    console.log('Fiber found:', !!fiber);
  }
  return !!canvas;
});

console.log('\nCanvas exists:', refExists);
console.log('Ref found from logs:', hasRef);

await browser.close();
