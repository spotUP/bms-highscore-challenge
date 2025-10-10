import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();

const messages = [];
page.on('console', msg => {
  const text = msg.text();
  messages.push(text);
});

try {
  console.log('Loading page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  // Wait for shader compilation to happen
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n=== CONSOLE OUTPUT ===\n');

  // Filter for shader-related messages
  const shaderMessages = messages.filter(m =>
    m.includes('SlangCompiler') ||
    m.includes('ERROR:') ||
    m.includes('MultiPassRenderer') ||
    m.includes('BezelComposition') ||
    m.includes('GlobalToVaryingConverter') ||
    m.includes('DualStage') ||
    m.includes('shader') ||
    m.includes('GLSL')
  );

  // Count errors
  const errorCount = messages.filter(m => m.includes('ERROR:')).length;

  console.log(`Total console messages: ${messages.length}`);
  console.log(`Shader-related messages: ${shaderMessages.length}`);
  console.log(`WebGL ERROR lines: ${errorCount}\n`);

  // GlobalToVaryingConverter specific logs
  console.log('=== GLOBAL-TO-VARYING CONVERTER ===\n');
  const converterMessages = messages.filter(m => m.includes('GlobalToVaryingConverter'));
  converterMessages.forEach(m => console.log(m));

  console.log('\n=== DUAL-STAGE PROCESSING ===\n');
  const dualStageMessages = messages.filter(m => m.includes('DualStage'));
  dualStageMessages.forEach(m => console.log(m));

  if (errorCount > 0) {
    console.log('\n=== ERRORS (first 50) ===\n');
    const errors = messages.filter(m => m.includes('ERROR:')).slice(0, 50);
    errors.forEach(e => console.log(e));
  } else {
    console.log('\n✅ NO ERRORS DETECTED\n');
  }

  console.log('\n=== COMPILER MESSAGES ===\n');
  const compilerMessages = shaderMessages.filter(m =>
    m.includes('[SlangCompiler]') || m.includes('[MultiPassRenderer]')
  ).slice(0, 30);
  compilerMessages.forEach(m => console.log(m));

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await browser.close();
}
