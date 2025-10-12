import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  let shaderLogs = [];
  let renderLogs = [];

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('Executing pass')) {
      shaderLogs.push(text);
      console.log(`✅ ${text}`);
    }

    if (text.includes('RENDER') || text.includes('shader') && text.includes('render')) {
      renderLogs.push(text);
      console.log(`🎨 ${text.substring(0, 150)}`);
    }

    if (text.includes('WebGL2DWithShaders') && text.includes('render')) {
      console.log(`🖼️  ${text}`);
    }

    if (msg.type() === 'error' && !text.includes('AudioContext')) {
      console.log(`❌ ${text.substring(0, 150)}`);
    }
  });

  console.log('🎮 Opening http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('⏳ Waiting 3 seconds...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));

  // Click the audio button
  console.log('🔊 Clicking Start Audio button...');
  try {
    await page.click('button'); // First button should be Start Audio
    console.log('✅ Audio button clicked');
  } catch (e) {
    console.log('⚠️  Could not find audio button:', e.message);
  }

  console.log('⏳ Waiting 10 seconds for rendering...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10000)));

  // Check canvas pixel data
  const canvasData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas' };

    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'No context' };

    // Sample center pixel
    const imageData = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1);
    const pixel = imageData.data;

    // Sample multiple points
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(canvas.width * (i + 1) / 6);
      const y = Math.floor(canvas.height / 2);
      const sample = ctx.getImageData(x, y, 1, 1);
      samples.push({
        x, y,
        r: sample.data[0],
        g: sample.data[1],
        b: sample.data[2],
        a: sample.data[3]
      });
    }

    return {
      centerPixel: { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] },
      samples,
      canvasSize: { w: canvas.width, h: canvas.height },
      allBlack: samples.every(s => s.r === 0 && s.g === 0 && s.b === 0)
    };
  });

  console.log('\n🖼️  CANVAS PIXEL DATA:');
  console.log(JSON.stringify(canvasData, null, 2));

  console.log(`\n📊 SHADER EXECUTION:`, shaderLogs.length, 'passes executed');

  if (canvasData.allBlack) {
    console.log('\n⚠️  WARNING: Canvas appears to be all black!');
    console.log('This could mean:');
    console.log('1. Shaders are not rendering correctly');
    console.log('2. Input texture is black');
    console.log('3. Shader output is being multiplied by zero');
    console.log('4. Frame buffer is not being copied to canvas');
  }

  console.log('\n👀 Browser staying open. Check DevTools console for more info.');
  await new Promise(() => {});
})();
