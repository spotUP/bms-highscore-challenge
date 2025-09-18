#!/usr/bin/env node

async function testEarthionTournamentLogos() {
  const earthionIds = [459720, 459665, 461032];

  console.log('Testing tournament logo URLs for Earthion games:');

  for (const id of earthionIds) {
    const launchBoxLogo = `https://images.launchbox-app.com/clearlogo/${id}-01.png`;
    console.log(`\nDatabase ID ${id}:`);
    console.log(`Clear logo URL: ${launchBoxLogo}`);

    try {
      const response = await fetch(launchBoxLogo, { method: 'HEAD' });
      console.log(`Status: ${response.ok ? '✅ Available' : '❌ Not found'}`);
    } catch (error) {
      console.log(`Status: ❌ Error - ${error}`);
    }
  }
}

testEarthionTournamentLogos();