import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('SHADER') || text.includes('Pass') || text.includes('Black screen') || text.includes('ERROR')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2' });
  
  console.log('\n=== Waiting for shaders to load (5 seconds) ===');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('=== Pressing Space to start game ===');
  await page.keyboard.press('Space');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('=== Pressing Space again to confirm ===');
  await page.keyboard.press('Space');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('=== Game should be running now ===\n');
  
  // Check if canvas has content
  const hasContent = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };
    
    const gl = canvas.getContext('webgl2');
    if (!gl) return { error: 'No WebGL2 context' };
    
    // Read pixels from center of screen
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
    
    let nonBlackPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 10 || pixels[i+1] > 10 || pixels[i+2] > 10) {
        nonBlackPixels++;
      }
    }
    
    return {
      totalPixels: 100 * 100,
      nonBlackPixels,
      percentageNonBlack: (nonBlackPixels / (100 * 100) * 100).toFixed(1)
    };
  });
  
  console.log('Canvas content analysis:', hasContent);
  
  if (hasContent.nonBlackPixels > 100) {
    console.log('✅ Screen has visible content!');
  } else {
    console.log('❌ Screen is BLACK');
  }

  await browser.close();
})();
