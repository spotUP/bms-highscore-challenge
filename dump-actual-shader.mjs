import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Intercept console logs
  const shaderSources = [];
  page.on('console', msg => {
    const text = msg.text();

    // Capture shader source dumps (first 3000 chars)
    if (text.includes('#version') && text.includes('precision') && text.includes('uniform')) {
      shaderSources.push(text);
    }
  });

  console.log('🔍 Loading shader demo page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for shaders to compile
  await page.waitForFunction(() => window.performance.now() > 5000, { timeout: 10000 });

  console.log(`\n📊 Captured ${shaderSources.length} shader source dumps\n`);

  if (shaderSources.length > 0) {
    // Save first vertex shader
    const vertexShader = shaderSources.find(s => s.includes('MVP'));
    if (vertexShader) {
      fs.writeFileSync('/tmp/vertex-shader.glsl', vertexShader);
      console.log('✅ Saved vertex shader to /tmp/vertex-shader.glsl');

      // Check for critical features
      console.log('\n=== VERTEX SHADER ANALYSIS ===');
      console.log('Has #version 300 es:', vertexShader.includes('#version 300 es'));
      console.log('Has "in" keyword:', vertexShader.includes(' in '));
      console.log('Has "out" keyword:', vertexShader.includes(' out '));
      console.log('Has "attribute" keyword:', vertexShader.includes('attribute'));
      console.log('Has "varying" keyword:', vertexShader.includes('varying'));
      console.log('Has texture() calls:', vertexShader.includes('texture('));
      console.log('Has texture2D() calls:', vertexShader.includes('texture2D('));
    }

    // Save first fragment shader
    const fragmentShader = shaderSources.find(s => !s.includes('MVP') && s.includes('FragColor'));
    if (fragmentShader) {
      fs.writeFileSync('/tmp/fragment-shader.glsl', fragmentShader);
      console.log('\n✅ Saved fragment shader to /tmp/fragment-shader.glsl');

      // Check for critical features
      console.log('\n=== FRAGMENT SHADER ANALYSIS ===');
      console.log('Has #version 300 es:', fragmentShader.includes('#version 300 es'));
      console.log('Has "in" keyword:', fragmentShader.includes(' in '));
      console.log('Has "out" keyword:', fragmentShader.includes(' out '));
      console.log('Has "varying" keyword:', fragmentShader.includes('varying'));
      console.log('Has texture() calls:', fragmentShader.includes('texture('));
      console.log('Has texture2D() calls:', fragmentShader.includes('texture2D('));

      // Count texture calls
      const textureCount = (fragmentShader.match(/\btexture\(/g) || []).length;
      const texture2DCount = (fragmentShader.match(/\btexture2D\(/g) || []).length;
      console.log(`texture() calls: ${textureCount}`);
      console.log(`texture2D() calls: ${texture2DCount}`);
    }
  }

  await browser.close();
})();
