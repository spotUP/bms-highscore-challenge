import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });

    // Wait for shader compilation to fail and expose the source
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract the shader source from window
    const shaderData = await page.evaluate(() => {
      return {
        source: window.debugPass0VertexSource,
        errorLine: window.debugPass0ErrorLine
      };
    });

    if (!shaderData.source) {
      console.log('No pass_0 vertex shader source found on window');
      await browser.close();
      return;
    }

    console.log(`\nExtracted pass_0 vertex shader (error at line ${shaderData.errorLine})\n`);

    // Write full source to file
    fs.writeFileSync('pass0-vertex-shader.glsl', shaderData.source);
    console.log('✅ Saved full shader to: pass0-vertex-shader.glsl\n');

    // Show lines around error
    const lines = shaderData.source.split('\n');
    const errorLine = shaderData.errorLine;

    console.log(`Showing lines ${errorLine - 10} to ${errorLine + 5}:\n`);
    for (let i = errorLine - 11; i < errorLine + 5; i++) {
      if (i >= 0 && i < lines.length) {
        const marker = i === errorLine - 1 ? '>>>' : '   ';
        console.log(`${marker} ${i + 1}: ${lines[i]}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
