import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const unmappedParams = [];

  page.on('console', async msg => {
    const text = msg.text();

    if (text.includes('Unmapped parameters in pass')) {
      // Get the actual array argument
      const args = msg.args();
      if (args.length >= 2) {
        try {
          const paramsObj = await args[1].jsonValue();
          console.log('Found unmapped parameters:', paramsObj);
          unmappedParams.push({
            message: text,
            params: paramsObj
          });
        } catch (e) {
          console.log('Could not extract params:', e.message);
        }
      }
    }
  });

  console.log('Loading http://localhost:8080/slang-demo...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  // Wait for shaders to compile
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n=== UNMAPPED PARAMETERS SUMMARY ===');
  if (unmappedParams.length > 0) {
    console.log(`Found ${unmappedParams.length} instances of unmapped parameters`);

    // Group by unique parameter lists
    const uniqueParams = new Set();
    unmappedParams.forEach(item => {
      if (Array.isArray(item.params)) {
        uniqueParams.add(JSON.stringify(item.params));
      }
    });

    console.log(`\nUnique unmapped parameter sets: ${uniqueParams.size}`);
    uniqueParams.forEach((paramSet, i) => {
      console.log(`\nSet ${i + 1}:`, JSON.parse(paramSet));
    });
  } else {
    console.log('No unmapped parameters found!');
  }

  await browser.close();
})();
