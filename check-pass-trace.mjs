import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  logs.push(msg.text());
});

console.log('🔍 Loading page...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 5000));

console.log('\n📊 Pass-by-Pass Trace (Frame 60):');
const passLogs = logs.filter(l => l.includes('[PASS') && l.includes('rgb('));
if (passLogs.length > 0) {
  passLogs.forEach(l => console.log('  ' + l));
  
  // Find first black pass
  const firstBlack = passLogs.findIndex(l => l.includes('0/100 non-black'));
  if (firstBlack > 0) {
    console.log(`\n⚠️  FIRST BLACK OUTPUT: Pass ${firstBlack}`);
    console.log(`   Last good: ${passLogs[firstBlack - 1]}`);
  } else if (firstBlack === 0) {
    console.log(`\n⚠️  BLACK FROM THE START! Pass 0 outputs black`);
  }
} else {
  console.log('  ❌ No pass trace logs found');
}

await browser.close();
