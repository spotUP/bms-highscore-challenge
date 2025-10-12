import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true  // Open devtools automatically
  });
  const page = await browser.newPage();

  const timeline = [];

  page.on('console', msg => {
    const text = msg.text();
    const timestamp = Date.now();

    // Track shader-related events
    if (
      text.includes('WebGL2DWithShaders') ||
      text.includes('[INIT]') ||
      text.includes('shader') ||
      text.includes('Shader') ||
      text.includes('[AUTO]') ||
      text.includes('shadersEnabled') ||
      text.includes('shadersFailed') ||
      text.includes('Frame ') ||
      text.includes('NOT using shaders')
    ) {
      const event = { time: timestamp, text };
      timeline.push(event);

      const relativeTime = timeline.length > 1 ? `+${timestamp - timeline[0].time}ms` : '0ms';
      console.log(`[${relativeTime}] ${text}`);
    }
  });

  console.log('🎮 Opening game...\n');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 20000 });

  console.log('\n⏳ Monitoring for 10 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n\n📊 TIMELINE ANALYSIS:');
  console.log('='.repeat(80));

  // Find key events
  const init = timeline.find(e => e.text.includes('[INIT] Creating'));
  const loaded = timeline.find(e => e.text.includes('Shaders loaded and enabled'));
  const firstFrame = timeline.find(e => e.text.includes('First frame rendered'));
  const warnings = timeline.filter(e => e.text.includes('NOT using shaders'));
  const failures = timeline.filter(e => e.text.includes('shadersFailed = true'));

  if (init) console.log(`\n✓ Init at: ${init.time - timeline[0].time}ms`);
  if (loaded) console.log(`✓ Loaded at: ${loaded.time - timeline[0].time}ms`);
  if (firstFrame) console.log(`✓ First frame at: ${firstFrame.time - timeline[0].time}ms`);

  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} "NOT using shaders" warnings:`);
    warnings.forEach((w, i) => {
      console.log(`  ${i + 1}. [+${w.time - timeline[0].time}ms] ${w.text}`);
    });
  }

  if (failures.length > 0) {
    console.log(`\n❌ ${failures.length} shader failures:`);
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. [+${f.time - timeline[0].time}ms] ${f.text}`);
    });
  }

  if (warnings.length === 0 && failures.length === 0) {
    console.log('\n✅ No shader warnings or failures detected!');
  } else {
    console.log('\n❌ Shader issues detected - check timeline above');
  }

  console.log('\n\nPress Ctrl+C when done examining...');
  await new Promise(() => {}); // Wait forever
})();
