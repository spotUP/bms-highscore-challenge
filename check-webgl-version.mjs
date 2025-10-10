import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Capture WebGL version info
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (gl) {
        const isWebGL2 = gl instanceof WebGL2RenderingContext;
        console.log('=== WEBGL VERSION CHECK ===');
        console.log('WebGL2 supported:', isWebGL2);
        console.log('Version string:', gl.getParameter(gl.VERSION));
        console.log('GLSL version:', gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
        console.log('Renderer:', gl.getParameter(gl.RENDERER));
      }
    });
  });

  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (e) {}

  logs.forEach(log => console.log(log));

  await browser.close();
})();
