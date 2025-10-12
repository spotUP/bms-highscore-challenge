import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

const logs = [];

page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
  if (text.includes('INIT') || text.includes('WebGL2DWithShaders') || text.includes('Mega Bezel') || text.includes('PureWebGL2MultiPass') || text.includes('✅') || text.includes('❌')) {
    console.log(text);
  }
});

console.log('🌐 Loading game...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

console.log('\n⏳ Waiting 5 seconds for shaders to load...\n');
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('\n--- Results ---');
console.log('Total logs:', logs.length);
console.log('Shader init logs:', logs.filter(l => l.includes('WebGL2DWithShaders')).length);
console.log('Success logs:', logs.filter(l => l.includes('✅') && l.includes('shader')).length);

await new Promise(resolve => setTimeout(resolve, 5000));
await browser.close();
