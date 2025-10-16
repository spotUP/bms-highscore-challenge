import puppeteer from 'puppeteer';

async function findPixelLogs() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const pixelLogs = [];

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('pixel') || text.includes('rgb(')) {
      pixelLogs.push(text);
    }
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for frame 60...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n=== PIXEL/RGB LOGS ===\n');
    if (pixelLogs.length > 0) {
      pixelLogs.slice(0, 20).forEach(log => console.log(log));
      console.log(`\nTotal pixel logs: ${pixelLogs.length}`);
    } else {
      console.log('❌ NO PIXEL READBACK LOGS FOUND!');
      console.log('This means the console.log with pixel color is not executing');
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

findPixelLogs();
