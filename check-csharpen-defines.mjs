import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let allLines = [];

page.on('console', msg => {
  const text = msg.text();
  allLines.push(text);
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

// Look for any mentions of CSHARPEN in the logs
const csharpenLines = allLines.filter(line =>
  line.includes('CSHARPEN') ||
  line.includes('#define') ||
  line.includes('redefined')
);

console.log('=== CSHARPEN RELATED LOGS ===');
csharpenLines.forEach(line => console.log(line));

await browser.close();
