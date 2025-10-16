import puppeteer from 'puppeteer';

async function checkPass0Texture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const debugLogs = [];

  page.on('console', msg => {
    const text = msg.text();

    // Capture pass_0 and pass_4 debug messages
    if (text.includes('[DEBUG pass_0') || text.includes('[DEBUG pass_4')) {
      debugLogs.push(text);
    }
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for frame 60 (debug output)...');
    await new Promise(resolve => setTimeout(resolve, 12000));

    console.log('\n=== PASS_0 AND PASS_4 DEBUG OUTPUT ===\n');

    if (debugLogs.length > 0) {
      debugLogs.forEach(log => console.log(log));
    } else {
      console.log('❌ No debug logs found. Debug code may not be running.');
    }

    // Also check final output
    const finalPixel = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;

      const gl = canvas.getContext('webgl2');
      if (!gl) return null;

      const pixels = new Uint8Array(4);
      gl.readPixels(285, 285, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      return {
        center: `rgb(${pixels[0]}, ${pixels[1]}, ${pixels[2]})`,
        isWhite: pixels[0] > 240 && pixels[1] > 240 && pixels[2] > 240
      };
    });

    console.log('\n=== FINAL OUTPUT ===');
    console.log(finalPixel);

    if (finalPixel?.isWhite) {
      console.log('\n⚠️  OUTPUT IS STILL WHITE - Texture sampling issue persists');
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

checkPass0Texture();
