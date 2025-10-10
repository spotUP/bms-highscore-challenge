import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  const text = `[${msg.type()}] ${msg.text()}`;
  logs.push(text);
  console.log(text); // Also print to terminal
});

page.on('pageerror', error => {
  const text = `[ERROR] ${error.message}`;
  logs.push(text);
  console.log(text);
});

console.log('Loading page...');
await page.goto('http://localhost:8080/slang-demo', {
  waitUntil: 'networkidle0',
  timeout: 15000
});

console.log('Waiting 3 seconds...');
await new Promise(resolve => setTimeout(resolve, 3000));

// Save to file
fs.writeFileSync('/tmp/claude/console-logs.txt', logs.join('\n'));
console.log('\n✅ Logs saved to /tmp/claude/console-logs.txt');

await browser.close();
