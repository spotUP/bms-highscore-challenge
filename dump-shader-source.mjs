import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('Loading game...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('Waiting for shaders to load...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Dump the compiled fragment shader source
  const fragmentSource = await page.evaluate(() => {
    const wrapper = window.webglShaderWrapper;
    if (!wrapper || !wrapper.shaderRenderer) return { error: 'No renderer' };

    // Get the PureWebGL2Renderer
    const renderer = wrapper.shaderRenderer.renderer;
    if (!renderer) return { error: 'No PureWebGL2Renderer' };

    const gl = renderer.gl;

    // Get the first compiled program
    const programs = Array.from(renderer.programs.entries());
    if (programs.length === 0) return { error: 'No programs' };

    const [name, program] = programs[0];

    // Get attached shaders
    const shaders = gl.getAttachedShaders(program);
    if (!shaders || shaders.length === 0) return { error: 'No shaders attached' };

    // Find fragment shader
    let fragmentShader = null;
    for (const shader of shaders) {
      if (gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER) {
        fragmentShader = shader;
        break;
      }
    }

    if (!fragmentShader) return { error: 'No fragment shader found' };

    // Get shader source
    const source = gl.getShaderSource(fragmentShader);
    return {
      programName: name,
      source: source,
      lines: source ? source.split('\n').length : 0
    };
  });

  console.log('='.repeat(80));
  console.log('COMPILED FRAGMENT SHADER SOURCE');
  console.log('='.repeat(80));

  if (fragmentSource.error) {
    console.log('Error:', fragmentSource.error);
  } else {
    console.log(`Program: ${fragmentSource.programName}`);
    console.log(`Lines: ${fragmentSource.lines}`);
    console.log('\nSource (first 100 lines):');
    console.log('='.repeat(80));

    if (fragmentSource.source) {
      const lines = fragmentSource.source.split('\n');
      lines.slice(0, 100).forEach((line, i) => {
        console.log(`${String(i + 1).padStart(4)}: ${line}`);
      });
      if (lines.length > 100) {
        console.log(`... ${lines.length - 100} more lines`);
      }
    }
  }

  console.log('='.repeat(80));

  await browser.close();
})();
