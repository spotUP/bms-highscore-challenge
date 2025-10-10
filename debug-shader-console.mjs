import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', error => {
    logs.push(`[ERROR] ${error.message}`);
  });

  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle0',
    timeout: 5000
  }).catch(() => {}); // Ignore navigation errors

  // Wait a bit for any async logs
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('=== Console Output ===');
  logs.forEach(log => console.log(log));

  // Also check if canvas is rendering
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'No canvas found';

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'No WebGL context';

    // Sample a few pixels
    const pixels = new Uint8Array(4);
    gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    return {
      dimensions: `${canvas.width}x${canvas.height}`,
      centerPixel: `rgba(${pixels[0]}, ${pixels[1]}, ${pixels[2]}, ${pixels[3]})`
    };
  });

  console.log('\n=== Canvas Info ===');
  console.log(canvasInfo);

} finally {
  await browser.close();
}