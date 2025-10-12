import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let contextLines = [];

page.on('console', msg => {
  const text = msg.text();

  // Capture the error context lines
  if (text.includes('Context around line') || text.match(/^(\s{3}|>>>)\s*\d+:/)) {
    contextLines.push(text);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

console.log('=== SHADER ERROR CONTEXT ===');
contextLines.forEach(line => console.log(line));

await browser.close();
