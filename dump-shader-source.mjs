import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  let vertexShader = null;
  let fragmentShader = null;

  page.on('console', async msg => {
    const text = msg.text();

    // Capture compiled shader source
    if (text.includes('[SlangCompiler] Final compiled vertex shader')) {
      // Next log will be the shader
      const args = await msg.args();
      if (args[1]) {
        const shaderText = await args[1].jsonValue();
        vertexShader = shaderText;
      }
    }

    if (text.includes('[SlangCompiler] Final compiled fragment shader')) {
      const args = await msg.args();
      if (args[1]) {
        const shaderText = await args[1].jsonValue();
        fragmentShader = shaderText;
      }
    }
  });

  console.log('Loading page to capture shader source...');

  await page.goto('http://localhost:8080/webgl2-test', {
    waitUntil: 'networkidle2',
    timeout: 20000
  });

  await new Promise(r => setTimeout(r, 8000));

  if (vertexShader) {
    fs.writeFileSync('/tmp/compiled-vertex.glsl', vertexShader);
    console.log('✅ Saved vertex shader to /tmp/compiled-vertex.glsl');

    // Check for v_DEFAULT redefinitions
    const lines = vertexShader.split('\n');
    const defaultVars = lines.filter(l => l.includes('v_DEFAULT'));
    console.log('\nv_DEFAULT declarations in vertex shader:');
    defaultVars.forEach((line, idx) => {
      console.log(`  ${idx + 1}: ${line.trim()}`);
    });
  }

  if (fragmentShader) {
    fs.writeFileSync('/tmp/compiled-fragment.glsl', fragmentShader);
    console.log('\n✅ Saved fragment shader to /tmp/compiled-fragment.glsl');

    const lines = fragmentShader.split('\n');
    const defaultVars = lines.filter(l => l.includes('v_DEFAULT'));
    console.log('\nv_DEFAULT declarations in fragment shader:');
    defaultVars.forEach((line, idx) => {
      console.log(`  ${idx + 1}: ${line.trim()}`);
    });
  }

  await browser.close();
})();
