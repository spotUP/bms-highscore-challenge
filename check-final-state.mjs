import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    if (type === 'error') {
      errors.push(text);
      console.log('[ERROR]', text);
    } else if (type === 'warning') {
      warnings.push(text);
    } else if (text.includes('Mega Bezel') || text.includes('shader') || text.includes('passes')) {
      console.log('[SHADER]', text);
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('[PAGE ERROR]', error.message);
  });

  console.log('Loading http://localhost:8080/404...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });
  
  console.log('Waiting 5 seconds for shaders to load...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('Starting game (pressing Space twice)...');
  await page.keyboard.press('Space');
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.keyboard.press('Space');
  
  console.log('Waiting 3 seconds for game to run...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n=== FINAL STATUS ===');
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\nError details:');
    errors.slice(0, 5).forEach(e => console.log('  -', e));
  }

  // Check if canvas has content
  const status = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };
    
    const gl = canvas.getContext('webgl2');
    if (!gl) return { error: 'No WebGL2 context' };
    
    const pixels = new Uint8Array(100 * 100 * 4);
    gl.readPixels(
      canvas.width / 2 - 50,
      canvas.height / 2 - 50,
      100,
      100,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    
    let nonBlack = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 10 || pixels[i+1] > 10 || pixels[i+2] > 10) {
        nonBlack++;
      }
    }
    
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      totalPixels: 100 * 100,
      nonBlackPixels: nonBlack,
      percentageVisible: (nonBlack / (100 * 100) * 100).toFixed(1)
    };
  });

  console.log('\nCanvas status:', status);
  
  if (status.nonBlackPixels > 100) {
    console.log('✅ Game is RENDERING!');
  } else {
    console.log('❌ Screen is BLACK');
  }

  await browser.close();
})();
