#!/usr/bin/env tsx

// Simple test to verify split database functionality
// This simulates what happens in the browser

import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

console.log('🧪 Testing split database functionality...');

// Create a simple HTML test page
const testHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Split Database Test</title>
  <script src="https://sql.js.org/dist/sql-wasm.js"></script>
</head>
<body>
  <h1>Split Database Test</h1>
  <div id="results"></div>

  <script type="module">
    const results = document.getElementById('results');

    function log(message) {
      console.log(message);
      results.innerHTML += '<div>' + message + '</div>';
    }

    async function testSplitDatabase() {
      try {
        log('🔄 Starting split database test...');

        // Load SQL.js
        const sqlJs = await initSqlJs({
          locateFile: file => \`https://sql.js.org/dist/\${file}\`
        });

        log('📦 SQL.js loaded successfully');

        // Test 1: Load index database
        log('📇 Loading games index...');
        const indexResponse = await fetch('/games-index.db');
        if (!indexResponse.ok) {
          throw new Error('Failed to load index database');
        }

        const indexBuffer = await indexResponse.arrayBuffer();
        const indexDb = new sqlJs.Database(new Uint8Array(indexBuffer));

        log(\`✅ Index loaded: \${(indexBuffer.byteLength / 1024).toFixed(2)}KB\`);

        // Test 2: Query index for popular games
        log('🔍 Searching for Mario games...');
        const stmt = indexDb.prepare('SELECT id, name, has_logo, logo_chunk FROM games WHERE name LIKE ? AND has_logo = 1 LIMIT 5');
        stmt.bind(['%Mario%']);

        const marioGames = [];
        while (stmt.step()) {
          marioGames.push(stmt.getAsObject());
        }
        stmt.free();

        log(\`📋 Found \${marioGames.length} Mario games with logos\`);

        if (marioGames.length === 0) {
          log('❌ No Mario games found - this might indicate an issue');
          return;
        }

        // Test 3: Load first logo chunk
        const firstGame = marioGames[0];
        log(\`🖼️  Loading chunk \${firstGame.logo_chunk} for "\${firstGame.name}"\`);

        const chunkResponse = await fetch(\`/logos-\${firstGame.logo_chunk}.db\`);
        if (!chunkResponse.ok) {
          throw new Error(\`Failed to load chunk \${firstGame.logo_chunk}\`);
        }

        const chunkBuffer = await chunkResponse.arrayBuffer();
        const chunkDb = new sqlJs.Database(new Uint8Array(chunkBuffer));

        log(\`📁 Chunk \${firstGame.logo_chunk} loaded: \${(chunkBuffer.byteLength / 1024 / 1024).toFixed(2)}MB\`);

        // Test 4: Get logo from chunk
        const logoStmt = chunkDb.prepare('SELECT logo_base64 FROM logos WHERE game_id = ?');
        logoStmt.bind([firstGame.id]);

        let logoData = null;
        if (logoStmt.step()) {
          logoData = logoStmt.getAsObject().logo_base64;
        }
        logoStmt.free();

        if (logoData) {
          log(\`✅ Successfully retrieved logo for "\${firstGame.name}"\`);
          log(\`📊 Logo size: \${(logoData.length / 1024).toFixed(2)}KB\`);

          // Test 5: Display the logo
          const img = document.createElement('img');
          img.src = logoData;
          img.style.maxWidth = '200px';
          img.style.border = '2px solid green';
          img.onload = () => log('🖼️  Logo displayed successfully!');
          img.onerror = () => log('❌ Failed to display logo');
          results.appendChild(img);
        } else {
          log(\`❌ No logo found for game ID \${firstGame.id}\`);
        }

        // Clean up
        indexDb.close();
        chunkDb.close();

        log('🎉 Split database test completed successfully!');

      } catch (error) {
        log('❌ Test failed: ' + error.message);
        console.error(error);
      }
    }

    // Run test after page loads
    window.addEventListener('load', testSplitDatabase);
  </script>
</body>
</html>`;

// Write test file
writeFileSync('public/test-split-db.html', testHtml);

console.log('✅ Created test page: http://localhost:8080/test-split-db.html');
console.log('🌐 Open this URL in your browser to test the split database');
console.log('📊 Check the browser console for detailed logs');

// Also run a quick server-side test
console.log('\n🔧 Running server-side verification...');

try {
  const Database = require('better-sqlite3');

  // Test index database
  const indexDb = new Database('public/games-index.db');
  const indexStats = indexDb.prepare('SELECT COUNT(*) as total, COUNT(CASE WHEN has_logo = 1 THEN 1 END) as with_logos FROM games').get();
  console.log(\`📊 Index DB: \${indexStats.total} total games, \${indexStats.with_logos} with logos\`);

  // Test first chunk
  const chunk1Db = new Database('public/logos-1.db');
  const chunk1Stats = chunk1Db.prepare('SELECT COUNT(*) as count FROM logos').get();
  console.log(\`📁 Chunk 1: \${chunk1Stats.count} logos\`);

  // Test a specific game lookup
  const marioGames = indexDb.prepare('SELECT id, name, logo_chunk FROM games WHERE name LIKE ? AND has_logo = 1 LIMIT 1').all('%Mario%');

  if (marioGames.length > 0) {
    const mario = marioGames[0];
    const chunkDb = new Database(\`public/logos-\${mario.logo_chunk}.db\`);
    const logo = chunkDb.prepare('SELECT LENGTH(logo_base64) as logo_size FROM logos WHERE game_id = ?').get(mario.id);

    if (logo) {
      console.log(\`✅ Successfully found logo for "\${mario.name}" (\${logo.logo_size} characters)\`);
    } else {
      console.log(\`❌ Logo not found for "\${mario.name}" in chunk \${mario.logo_chunk}\`);
    }

    chunkDb.close();
  } else {
    console.log('⚠️  No Mario games found in index');
  }

  indexDb.close();
  chunk1Db.close();

  console.log('✅ Server-side verification completed');
} catch (error) {
  console.log('❌ Server-side test failed:', error.message);
}

console.log('\\n💡 Next steps:');
console.log('1. Open http://localhost:8080/test-split-db.html');
console.log('2. Check browser console for detailed test results');
console.log('3. Verify logos display correctly');
console.log('4. Test the main games browser at http://localhost:8080/games');