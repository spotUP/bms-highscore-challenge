import puppeteer from 'puppeteer';

async function testVisualOutput() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const logs = {
    errors: [],
    warnings: [],
    shaderCompile: [],
    passRendering: [],
    textureBinding: [],
    webglErrors: []
  };

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();

    if (type === 'error') {
      logs.errors.push(text);
    } else if (type === 'warning') {
      logs.warnings.push(text);
    }

    if (text.includes('SlangCompiler') && (text.includes('compiled') || text.includes('shader'))) {
      logs.shaderCompile.push(text);
    }

    if (text.includes('pass_') || text.includes('Pass')) {
      logs.passRendering.push(text);
    }

    if (text.includes('texture') || text.includes('Texture') || text.includes('binding')) {
      logs.textureBinding.push(text);
    }

    if (text.toLowerCase().includes('webgl') && text.toLowerCase().includes('error')) {
      logs.webglErrors.push(text);
    }
  });

  page.on('pageerror', error => {
    logs.errors.push(`PAGE ERROR: ${error.message}`);
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for shader compilation and rendering...');
    await new Promise(resolve => setTimeout(resolve, 12000));

    // Try to get rendering stats from the page
    const renderingInfo = await page.evaluate(() => {
      // Check if WebGL context exists
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };

      const gl = canvas.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2 context' };

      // Check for shader programs
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';

      return {
        canvasSize: `${canvas.width}x${canvas.height}`,
        renderer: renderer,
        contextValid: !gl.isContextLost()
      };
    });

    console.log('\n=== RENDERING INFO ===');
    console.log(renderingInfo);

    console.log('\n=== ERRORS ===');
    if (logs.errors.length === 0) {
      console.log('✓ No errors');
    } else {
      console.log(`❌ ${logs.errors.length} errors:`);
      logs.errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
    }

    console.log('\n=== WEBGL ERRORS ===');
    if (logs.webglErrors.length === 0) {
      console.log('✓ No WebGL errors');
    } else {
      console.log(`❌ ${logs.webglErrors.length} WebGL errors:`);
      logs.webglErrors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
    }

    console.log('\n=== SHADER COMPILATION ===');
    const compileSuccess = logs.shaderCompile.filter(l => l.includes('compiled successfully'));
    const compileFailed = logs.shaderCompile.filter(l => l.includes('failed'));
    console.log(`✓ Successful: ${compileSuccess.length}`);
    if (compileFailed.length > 0) {
      console.log(`❌ Failed: ${compileFailed.length}`);
      compileFailed.forEach(f => console.log(`  - ${f}`));
    }

    console.log('\n=== PASS RENDERING (last 10) ===');
    logs.passRendering.slice(-10).forEach(log => console.log(log));

    console.log('\n=== WARNINGS (first 5) ===');
    if (logs.warnings.length === 0) {
      console.log('✓ No warnings');
    } else {
      logs.warnings.slice(0, 5).forEach((w, i) => console.log(`${i + 1}. ${w}`));
      if (logs.warnings.length > 5) {
        console.log(`... and ${logs.warnings.length - 5} more warnings`);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total Errors: ${logs.errors.length}`);
    console.log(`Total Warnings: ${logs.warnings.length}`);
    console.log(`WebGL Errors: ${logs.webglErrors.length}`);
    console.log(`Shader Compile Messages: ${logs.shaderCompile.length}`);
    console.log(`Pass Rendering Messages: ${logs.passRendering.length}`);

    if (logs.errors.length === 0 && logs.webglErrors.length === 0) {
      console.log('\n✅ RENDERING APPEARS SUCCESSFUL - No errors detected!');
      console.log('   Please check the browser visually to confirm CRT effects are visible.');
    } else {
      console.log('\n❌ ISSUES DETECTED - See errors above');
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

testVisualOutput();
