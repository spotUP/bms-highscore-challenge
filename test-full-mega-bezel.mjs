import puppeteer from 'puppeteer';

console.log('🔍 Testing FULL Mega Bezel shader (36 passes)...\n');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let errors = [];
let successfulPasses = [];
let failedPass = null;

page.on('console', msg => {
  const text = msg.text();

  // Track successful pass compilation
  if (text.includes('Program pass_') && text.includes('compiled successfully')) {
    const match = text.match(/pass_(\d+)/);
    if (match) {
      successfulPasses.push(parseInt(match[1]));
      console.log(`✅ Pass ${match[1]} compiled`);
    }
  }

  // Track compilation failures
  if (text.includes('compilation failed') || text.includes('ERROR:')) {
    errors.push(text);
    const match = text.match(/pass_(\d+)/);
    if (match && !failedPass) {
      failedPass = parseInt(match[1]);
      console.log(`❌ Pass ${match[1]} FAILED`);
    }
  }

  // Track preset loading
  if (text.includes('Preset loaded successfully')) {
    console.log('🎉 ALL PASSES LOADED SUCCESSFULLY!');
  }

  if (text.includes('Failed to load shader preset')) {
    console.log('❌ Preset loading failed');
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('\n' + '='.repeat(70));
console.log('📊 COMPILATION RESULTS');
console.log('='.repeat(70));
console.log('Successful passes:', successfulPasses.length);
console.log('Failed pass:', failedPass !== null ? failedPass : 'None');
console.log('Total errors:', errors.length);

if (failedPass !== null) {
  console.log('\n❌ First failing pass:', failedPass);
  console.log('\nError details:');
  const relevantErrors = errors.filter(e => e.includes(`pass_${failedPass}`));
  relevantErrors.slice(0, 5).forEach(err => {
    console.log('  ', err.substring(0, 200));
  });
}

console.log('='.repeat(70));

await browser.close();
