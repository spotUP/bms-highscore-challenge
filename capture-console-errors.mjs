import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
const errors = [];
const warnings = [];

page.on('console', msg => {
  const text = msg.text();
  const type = msg.type();

  if (type === 'error') {
    errors.push(text);
  } else if (type === 'warning') {
    warnings.push(text);
  }
  logs.push({ type, text });
});

page.on('pageerror', error => {
  errors.push(`PAGE ERROR: ${error.message}\n${error.stack}`);
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n🔴 ERRORS (' + errors.length + '):');
console.log('='.repeat(80));
errors.forEach((err, i) => {
  console.log(`\n[${i + 1}] ${err}`);
});

console.log('\n\n⚠️  WARNINGS (' + warnings.length + '):');
console.log('='.repeat(80));
warnings.slice(0, 10).forEach((warn, i) => {
  console.log(`\n[${i + 1}] ${warn}`);
});

// Get unique error patterns
const errorPatterns = new Map();
errors.forEach(err => {
  // Extract key parts of error
  const pattern = err
    .replace(/pass_\d+/g, 'pass_X')
    .replace(/\d+/g, 'N')
    .replace(/uniform \w+/g, 'uniform VAR');

  if (!errorPatterns.has(pattern)) {
    errorPatterns.set(pattern, []);
  }
  errorPatterns.get(pattern).push(err);
});

console.log('\n\n📊 ERROR PATTERNS:');
console.log('='.repeat(80));
for (const [pattern, instances] of errorPatterns.entries()) {
  console.log(`\nPattern (${instances.length} occurrences):`);
  console.log(pattern);
  console.log('First instance:', instances[0]);
}

await browser.close();
