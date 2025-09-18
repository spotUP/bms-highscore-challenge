#!/usr/bin/env node

async function testEarthionImages() {
  const earthionIds = [459720, 459665, 461032];

  for (const id of earthionIds) {
    console.log(`\nTesting images for database_id ${id}:`);

    const imageTypes = [
      { type: 'clearlogo', url: `https://images.launchbox-app.com/clearlogo/${id}-01.png` },
      { type: 'box-3d', url: `https://images.launchbox-app.com/box-3d/${id}-01.png` },
      { type: 'boxfront', url: `https://images.launchbox-app.com/boxfront/${id}-01.png` },
      { type: 'screenshot', url: `https://images.launchbox-app.com/screenshot/${id}-01.png` },
      { type: 'banner', url: `https://images.launchbox-app.com/banner/${id}-01.png` },
    ];

    for (const { type, url } of imageTypes) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        console.log(`  ${type}: ${response.ok ? '✅ EXISTS' : '❌ missing'}`);
        if (response.ok) {
          console.log(`    ${url}`);
        }
      } catch (e) {
        console.log(`  ${type}: ❌ error`);
      }
    }
  }
}

testEarthionImages();