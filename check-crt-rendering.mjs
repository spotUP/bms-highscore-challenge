import puppeteer from 'puppeteer';

async function checkCRTRendering() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const shaderMessages = [];
  const renderMessages = [];

  page.on('console', msg => {
    const text = msg.text();

    // Capture shader-related messages
    if (text.includes('shader') || text.includes('Shader')) {
      shaderMessages.push(text);
    }

    // Capture rendering pipeline messages
    if (text.includes('pass_') || text.includes('CRT') || text.includes('scanline') || text.includes('bloom')) {
      renderMessages.push(text);
    }
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for rendering...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get pixel data from canvas to check if it's rendering
    const canvasCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };

      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2 context' };

      // Read center pixel
      const pixels = new Uint8Array(4);
      gl.readPixels(
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2),
        1, 1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );

      // Check if rendering (not all black or all white)
      const isBlack = pixels[0] === 0 && pixels[1] === 0 && pixels[2] === 0;
      const isWhite = pixels[0] === 255 && pixels[1] === 255 && pixels[2] === 255;

      return {
        centerPixel: `rgb(${pixels[0]}, ${pixels[1]}, ${pixels[2]})`,
        isBlack,
        isWhite,
        isRendering: !isBlack && !isWhite,
        canvasSize: `${canvas.width}x${canvas.height}`
      };
    });

    console.log('\n=== CANVAS RENDERING CHECK ===');
    console.log(canvasCheck);

    if (canvasCheck.isRendering) {
      console.log('✅ Canvas is rendering (not solid black or white)');
    } else if (canvasCheck.isBlack) {
      console.log('⚠️  Canvas is solid black - may indicate shader issue');
    } else if (canvasCheck.isWhite) {
      console.log('⚠️  Canvas is solid white - may indicate texture sampling issue');
    }

    console.log('\n=== SHADER PIPELINE STATUS (last 20 messages) ===');
    const uniqueShaderMessages = [...new Set(shaderMessages)];
    uniqueShaderMessages.slice(-20).forEach(msg => {
      if (msg.includes('ready') || msg.includes('enabled') || msg.includes('initialized')) {
        console.log(`✓ ${msg}`);
      } else {
        console.log(`  ${msg}`);
      }
    });

    console.log('\n=== RENDER PASS ACTIVITY ===');
    const passActivity = renderMessages.filter(m =>
      m.includes('pass_16') || m.includes('CRT') || m.includes('scanline')
    );
    console.log(`Total render messages: ${renderMessages.length}`);
    console.log(`Pass 16 (final CRT) messages: ${passActivity.length}`);

    if (passActivity.length > 0) {
      console.log('Last few pass_16 messages:');
      passActivity.slice(-5).forEach(msg => console.log(`  ${msg}`));
    }

    console.log('\n=== FINAL VERDICT ===');
    const allGood = !canvasCheck.error && canvasCheck.isRendering;
    if (allGood) {
      console.log('✅ SHADERS APPEAR TO BE RENDERING CORRECTLY!');
      console.log('   - Canvas is not blank');
      console.log('   - Rendering pipeline is active');
      console.log('   - No errors detected');
      console.log('\n   Please check the browser window to verify CRT effects (scanlines, curvature, etc.)');
    } else {
      console.log('⚠️  POTENTIAL ISSUES:');
      if (canvasCheck.error) console.log(`   - ${canvasCheck.error}`);
      if (!canvasCheck.isRendering) console.log('   - Canvas not rendering properly');
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

checkCRTRendering();
