import fs from 'fs';

// Read the compiler state to get the most recent compiled shader
const compilerStatePath = 'slang-compiler-state.json';
let shaderSource = '';

try {
  const state = JSON.parse(fs.readFileSync(compilerStatePath, 'utf8'));
  // Get pass_2 which is the bezel shader
  const pass2 = state.passes?.find(p => p.name === 'pass_2');
  if (pass2) {
    shaderSource = pass2.fragment;
    // Save to file
    fs.writeFileSync('bezel_fragment_current.glsl', shaderSource);
    
    // Look for lines around 4196 (the error line)
    const lines = shaderSource.split('\n');
    console.log('=== Lines around 4196 (error location) ===');
    for (let i = 4190; i <= 4210 && i < lines.length; i++) {
      const prefix = i === 4195 ? '>>> ' : '    ';
      console.log(`${prefix}${i}: ${lines[i]}`);
    }
    
    // Also search for float/int comparison patterns
    console.log('\n=== Float/int comparison patterns found ===');
    lines.forEach((line, idx) => {
      // Look for patterns like: floatVar == integer
      if (line.match(/\w+Mode\s*==\s*\d+(?!\.)/)) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
      }
      // Look for MASK_MODE comparisons
      if (line.match(/maskMode\s*==\s*MASK_MODE_/)) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
      }
    });
  }
} catch (e) {
  console.log('Could not read compiler state:', e.message);
}
