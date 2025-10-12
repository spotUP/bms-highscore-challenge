import puppeteer from 'puppeteer';
import fs from 'fs';

// Define all passes from potato preset in order
const passes = [
  { name: 'derez', shader: 'shaders/guest/extras/hsm-drez-g-sharp_resampler.slang', alias: 'DerezedPass' },
  { name: 'cache-info', shader: 'shaders/base/cache-info-potato-params.slang', alias: 'InfoCachePass' },
  { name: 'fetch-drez', shader: 'shaders/guest/extras/hsm-fetch-drez-output.slang', alias: null },
  { name: 'fxaa', shader: 'shaders/fxaa/fxaa.slang', alias: 'DeditherPass' },
  { name: 'grade', shader: 'shaders/dogway/hsm-grade.slang', alias: 'ColorCorrectPass' },
  { name: 'sharpen', shader: 'shaders/guest/hsm-custom-fast-sharpen.slang', alias: null },
  { name: 'linearize', shader: 'shaders/base/linearize.slang', alias: 'LinearizePass' },
  { name: 'screen-scale', shader: 'shaders/guest/extras/hsm-screen-scale-g-sharp_resampler-potato.slang', alias: 'CRTPass' },
  { name: 'post-crt-prep', shader: 'shaders/base/post-crt-prep-potato.slang', alias: 'PostCRTPass' }
];

function generatePreset(numPasses) {
  const lines = ['# Incremental test preset'];
  lines.push(`shaders = ${numPasses}`);
  lines.push('');

  for (let i = 0; i < numPasses; i++) {
    const pass = passes[i];
    lines.push(`# Pass ${i}: ${pass.name}`);
    lines.push(`shader${i} = ${pass.shader}`);
    lines.push(`filter_linear${i} = ${pass.name === 'derez' || pass.name === 'cache-info' || pass.name === 'fetch-drez' || pass.name === 'grade' ? 'false' : 'true'}`);

    // Last pass always goes to viewport
    if (i === numPasses - 1) {
      lines.push(`scale_type${i} = viewport`);
    } else {
      lines.push(`scale_type${i} = source`);
    }

    lines.push(`scale${i} = 1.0`);

    if (pass.alias) {
      lines.push(`alias${i} = "${pass.alias}"`);
    }

    if (pass.name === 'fetch-drez') {
      lines.push(`srgb_framebuffer${i} = true`);
    }

    if (pass.name === 'fxaa' || pass.name === 'linearize' || pass.name === 'screen-scale' || pass.name === 'post-crt-prep') {
      lines.push(`float_framebuffer${i} = true`);
    }

    lines.push('');
  }

  // Add textures
  lines.push('textures = "SamplerLUT1;SamplerLUT2;SamplerLUT3;SamplerLUT4"');
  lines.push('SamplerLUT1 = shaders/guest/lut/trinitron-lut.png');
  lines.push('SamplerLUT1_linear = true');
  lines.push('SamplerLUT2 = shaders/guest/lut/inv-trinitron-lut.png');
  lines.push('SamplerLUT2_linear = true');
  lines.push('SamplerLUT3 = shaders/guest/lut/nec-lut.png');
  lines.push('SamplerLUT3_linear = true');
  lines.push('SamplerLUT4 = shaders/guest/lut/ntsc-lut.png');
  lines.push('SamplerLUT4_linear = true');

  return lines.join('\n');
}

async function testPreset(numPasses, testNum) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST ${testNum}: ${numPasses} passes - up to "${passes[numPasses - 1].name}"`);
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleMessages = [];
  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);

    if (text.includes('ERROR') || text.includes('Failed') || text.includes('error')) {
      errors.push(text);
    }
  });

  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  // Generate and write preset
  const presetPath = '/Users/spot/Code/bms-highscore-challenge/public/shaders/mega-bezel/test-incremental.slangp';
  const presetContent = generatePreset(numPasses);
  fs.writeFileSync(presetPath, presetContent);

  // Modify Pong404WebGL.tsx to use test preset
  const pongFile = '/Users/spot/Code/bms-highscore-challenge/src/pages/Pong404WebGL.tsx';
  const originalContent = fs.readFileSync(pongFile, 'utf8');
  const modifiedContent = originalContent.replace(
    /presetPath: '\/shaders\/mega-bezel\/[^']+'/,
    `presetPath: '/shaders/mega-bezel/test-incremental.slangp'`
  );
  fs.writeFileSync(pongFile, modifiedContent);

  // Give Vite time to rebuild
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Loading game...');
  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for rendering
    console.log('Waiting 8 seconds for shader rendering...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Take screenshot
    const screenshotPath = `/tmp/test-pass-${numPasses}-${passes[numPasses - 1].name}.jpg`;
    await page.screenshot({
      path: screenshotPath,
      type: 'jpeg',
      quality: 80,
      fullPage: false
    });
    console.log(`Screenshot: ${screenshotPath}`);

    // Check for compilation errors
    const compilationErrors = consoleMessages.filter(msg =>
      msg.includes('Compilation failed') ||
      msg.includes('ERROR:')
    );

    // Check for WebGL errors
    const webglErrors = consoleMessages.filter(msg =>
      msg.includes('WebGL error') ||
      msg.includes('INVALID_')
    );

    // Check if shaders disabled
    const bypassMessages = consoleMessages.filter(msg =>
      msg.includes('Bypassing shaders due to error')
    );

    console.log(`\n--- RESULTS ---`);
    console.log(`Compilation errors: ${compilationErrors.length}`);
    console.log(`WebGL errors: ${webglErrors.length}`);
    console.log(`Shader bypass: ${bypassMessages.length > 0 ? 'YES' : 'NO'}`);

    if (compilationErrors.length > 0) {
      console.log('\n⚠️ COMPILATION ERRORS:');
      compilationErrors.slice(0, 5).forEach(err => console.log('  ', err));
    }

    if (webglErrors.length > 0) {
      console.log('\n⚠️ WEBGL ERRORS:');
      webglErrors.slice(0, 5).forEach(err => console.log('  ', err));
    }

    if (bypassMessages.length > 0) {
      console.log('\n❌ SHADER BYPASS DETECTED');
      bypassMessages.forEach(msg => console.log('  ', msg));
    }

    // Restore original file
    fs.writeFileSync(pongFile, originalContent);

    await browser.close();

    // Return test result
    return {
      numPasses,
      passName: passes[numPasses - 1].name,
      compilationErrors: compilationErrors.length,
      webglErrors: webglErrors.length,
      bypassed: bypassMessages.length > 0,
      screenshot: screenshotPath
    };

  } catch (error) {
    console.error('Test failed:', error.message);
    fs.writeFileSync(pongFile, originalContent);
    await browser.close();
    return {
      numPasses,
      passName: passes[numPasses - 1].name,
      compilationErrors: -1,
      webglErrors: -1,
      bypassed: true,
      error: error.message
    };
  }
}

(async () => {
  console.log('\n🔬 INCREMENTAL PASS TEST - FINDING BLACK SCREEN CULPRIT');
  console.log('Testing potato preset passes one at a time\n');

  const results = [];

  // Test each number of passes from 1 to 9
  for (let i = 1; i <= passes.length; i++) {
    const result = await testPreset(i, i);
    results.push(result);

    // Give Vite time to rebuild between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Stop if we hit errors
    if (result.compilationErrors > 0 || result.webglErrors > 0 || result.bypassed) {
      console.log(`\n⚠️ STOPPING: Found issue at ${i} passes (${result.passName})`);
      break;
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  results.forEach(r => {
    const status = r.compilationErrors > 0 || r.webglErrors > 0 || r.bypassed ? '❌ FAIL' : '✅ PASS';
    console.log(`${status} - ${r.numPasses} passes (up to ${r.passName})`);
    if (r.screenshot) {
      console.log(`       Screenshot: ${r.screenshot}`);
    }
  });

  // Find the first failing pass
  const firstFail = results.find(r => r.compilationErrors > 0 || r.webglErrors > 0 || r.bypassed);
  if (firstFail) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 BLACK SCREEN CULPRIT FOUND');
    console.log('='.repeat(80));
    console.log(`Pass ${firstFail.numPasses}: ${firstFail.passName}`);
    console.log(`Shader: ${passes[firstFail.numPasses - 1].shader}`);
    console.log(`\nThis is the pass that causes the black screen or shader failure.`);
  } else {
    console.log('\n✅ All passes work! The potato preset should work without black screen.');
  }

  console.log('='.repeat(80) + '\n');
})();
