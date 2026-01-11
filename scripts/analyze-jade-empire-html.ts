#!/usr/bin/env tsx

// Analyze the exact HTML structure around Clear Logo section for Jade Empire

async function analyzeJadeEmpireHTML() {
  console.log('🔍 Analyzing Jade Empire HTML structure...');

  try {
    const response = await fetch('https://gamesdb.launchbox-app.com/games/details/29', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    const html = await response.text();

    // Find the exact position of "Clear Logo" text
    const clearLogoIndex = html.toLowerCase().indexOf('clear logo');

    if (clearLogoIndex === -1) {
      console.log('❌ "Clear Logo" text not found');
      return;
    }

    console.log('✅ Found "Clear Logo" text at position:', clearLogoIndex);

    // Extract a large chunk around "Clear Logo" to see the structure
    const start = Math.max(0, clearLogoIndex - 1000);
    const end = Math.min(html.length, clearLogoIndex + 2000);
    const context = html.substring(start, end);

    console.log('\n📋 HTML structure around "Clear Logo":');
    console.log('═'.repeat(80));
    console.log(context);
    console.log('═'.repeat(80));

    // Look for all img tags in this context
    const imgTags = context.match(/<img[^>]*>/g);
    if (imgTags) {
      console.log('\n🖼️  Image tags found in Clear Logo context:');
      imgTags.forEach((img, index) => {
        console.log(`${index + 1}. ${img}`);
      });
    }

    // Look for specific patterns that might indicate the clear logo vs banner
    console.log('\n🔍 Looking for distinguishing patterns...');

    // Pattern 1: Look for text that comes AFTER "Clear Logo"
    const afterClearLogo = html.substring(clearLogoIndex + 10, clearLogoIndex + 1500);
    const nextImg = afterClearLogo.match(/<img[^>]*>/);
    if (nextImg) {
      console.log('📸 First image AFTER "Clear Logo" text:', nextImg[0]);
    }

    // Pattern 2: Look for section/div structure around Clear Logo
    const sectionPattern = /<[^>]*clear[^>]*>/gi;
    const sections = context.match(sectionPattern);
    if (sections) {
      console.log('📦 Clear Logo related sections:');
      sections.forEach(section => console.log(`   ${section}`));
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

analyzeJadeEmpireHTML();