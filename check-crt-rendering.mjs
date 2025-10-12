import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

// Click to dismiss audio prompt
await page.mouse.click(400, 400);
await new Promise(resolve => setTimeout(resolve, 2000));

// Take screenshot
await page.screenshot({ path: '/tmp/crt-test.jpeg', type: 'jpeg', quality: 70 });

// Sample pixels from different areas
const pixelData = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };

  const ctx = canvas.getContext('2d');
  if (!ctx) return { error: 'No context' };

  const w = canvas.width;
  const h = canvas.height;

  // Sample multiple areas
  const areas = [
    { name: 'center', x: w/2 - 25, y: h/2 - 25, size: 50 },
    { name: 'top-left', x: 50, y: 50, size: 50 },
    { name: 'bottom-right', x: w - 100, y: h - 100, size: 50 }
  ];

  const results = areas.map(area => {
    const imageData = ctx.getImageData(area.x, area.y, area.size, area.size);
    const data = imageData.data;

    let sumR = 0, sumG = 0, sumB = 0;
    let nonBlack = 0;
    let totalPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      sumR += r;
      sumG += g;
      sumB += b;
      totalPixels++;

      if (r > 10 || g > 10 || b > 10) {
        nonBlack++;
      }
    }

    return {
      name: area.name,
      avgColor: {
        r: Math.round(sumR / totalPixels),
        g: Math.round(sumG / totalPixels),
        b: Math.round(sumB / totalPixels)
      },
      nonBlackPixels: nonBlack,
      totalPixels,
      percentNonBlack: (nonBlack / totalPixels * 100).toFixed(1) + '%'
    };
  });

  return { results, canvasSize: `${w}x${h}` };
});

console.log('\n🎨 Pixel Analysis:');

if (pixelData.error) {
  console.log('ERROR:', pixelData.error);
} else if (!pixelData.results) {
  console.log('ERROR: No results returned');
  console.log('pixelData:', pixelData);
} else {
  console.log('Canvas:', pixelData.canvasSize);
  console.log('\nSampled Areas:');
  pixelData.results.forEach(r => {
    const isBlack = r.avgColor.r < 10 && r.avgColor.g < 10 && r.avgColor.b < 10;
    console.log(`\n  ${r.name}:`);
    console.log(`    Avg Color: RGB(${r.avgColor.r}, ${r.avgColor.g}, ${r.avgColor.b}) ${isBlack ? '⚫ BLACK' : '✅ HAS COLOR'}`);
    console.log(`    Non-black: ${r.percentNonBlack}`);
  });
}

console.log('\n📸 Screenshot saved to: /tmp/crt-test.jpeg');

await browser.close();
