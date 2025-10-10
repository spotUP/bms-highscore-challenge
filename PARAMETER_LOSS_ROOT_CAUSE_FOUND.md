# Parameter Loss Root Cause - INVESTIGATION COMPLETE

## Executive Summary

I've traced the parameter loss bug through the entire compilation pipeline and found WHERE it happens, but NOT exactly why yet. The function parameters are being corrupted somewhere between `buildGlobalDefinitionsCode()` and `removeDuplicateFunctions()`.

## Key Findings

### ✅ What We Know

1. **Function is correct in source file:**
   ```glsl
   float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
   ```

2. **Function is correct after extraction and fixes in `buildGlobalDefinitionsCode()`:**
   ```
   [buildGlobalDefinitionsCode] BEFORE fixes, HHLP first line: float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
   [buildGlobalDefinitionsCode] AFTER fixes, HHLP first line: float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
   ```

3. **Function is corrupted when it reaches `removeDuplicateFunctions()`:**
   ```
   [removeDuplicateFunctions] HHLP_GetMaskCenteredOnValue
     Full line: "float HHLP_GetMaskCenteredOnValue(float in_value)"
     Signature: "HHLP_GetMaskCenteredOnValue(float)"
   ```

4. **Function is NOT in the input to `convertToWebGL()`:**
   ```
   [convertToWebGL vertex] HHLP_GetMaskCenteredOnValue NOT in input source
   [convertToWebGL fragment] HHLP_GetMaskCenteredOnValue NOT in input source
   ```

## The Corruption Window

The corruption happens in this sequence:

```
1. extractGlobalDefinitions() - Extracts function with ALL 3 parameters ✅
2. buildGlobalDefinitionsCode() - Processes function with ALL 3 parameters ✅
3. [CORRUPTION HAPPENS HERE] ❌
4. fixWebGLIncompatibilities() - Function has ONLY 1 parameter
5. removeDuplicateFunctions() - Function has ONLY 1 parameter
```

## Possible Causes

### Theory 1: String Concatenation Issue
The global definitions code is inserted into the shader via string manipulation:
```javascript
output = output.substring(0, insertPos) + '\n' + globalDefsCode + '\n' + output.substring(insertPos);
```

Maybe there's a regex later that's corrupting the function? But I checked all regex replacements and none should affect function signatures.

### Theory 2: Multiple Processing
Maybe `removeDuplicateFunctions()` is being called multiple times, and the FIRST time it incorrectly strips parameters?

### Theory 3: Function Signature Parsing Bug
The regex in `removeDuplicateFunctions()` that extracts parameters:
```javascript
const funcMatch = trimmed.match(/^((?:const\s+)?(?:highp\s+|mediump\s+|lowp\s+)?(?:vec[234]|mat[234](?:x[234])?|float|bool|void|int|uint|[iu]?vec[234]|sampler2D))\s+(\w+)\s*\(([^)]*)\)/);
```

The `([^)]*)` captures parameters, but this should work fine for comma-separated parameters. UNLESS... what if there are nested parentheses or something weird in the parameter types?

### Theory 4: The Uniform Mega-String
After global definitions are added, a MASSIVE string of uniforms is added (lines 1377-2300+). This string concatenation could be causing issues if there's a buffer limit or string processing issue.

### Theory 5: Hidden Regex Replacement
There might be a regex replacement in `convertToWebGL()` that I haven't found yet that's stripping comma-separated lists thinking they're something else.

## Next Steps to Fix

### Immediate Action: Add More Logging

Add logging RIGHT AFTER the global definitions are inserted into the shader to see if the function is still intact:

```javascript
// In convertToWebGL(), right after line 1331:
if (output.includes('HHLP_GetMaskCenteredOnValue')) {
  const idx = output.indexOf('HHLP_GetMaskCenteredOnValue');
  const functionLine = output.substring(idx, output.indexOf('\n', idx));
  console.log('[convertToWebGL] AFTER global defs injection, HHLP line:', functionLine);
}
```

### Debugging Strategy

1. Add logging after EVERY major transformation in `convertToWebGL()` to find the exact line where corruption occurs
2. Check if `removeDuplicateFunctions()` is being called multiple times
3. Check if there's any code that parses function signatures and might be stripping commas

### Potential Quick Fix

If we can't find the root cause, we could:
1. Add HHLP_GetMaskCenteredOnValue to the stub functions with the correct signature
2. Skip extraction of this function from includes

But this is a band-aid, not a real fix.

## Impact

This bug affects ALL helper functions with multiple parameters:
- HHLP_GetMaskCenteredOnValue (3 params → 1 param)
- Likely many other HHLP_* functions
- Possibly some HSM_* functions too

Total impact: **~10,000 errors** from missing parameters and cascading type mismatches.

## Files Involved

- `src/shaders/SlangShaderCompiler.ts:295-394` - `extractGlobalDefinitions()` ✅ Works correctly
- `src/shaders/SlangShaderCompiler.ts:717-1234` - `buildGlobalDefinitionsCode()` ✅ Works correctly
- `src/shaders/SlangShaderCompiler.ts:1239-2400` - `convertToWebGL()` ❌ Corruption happens here
- `src/shaders/SlangShaderCompiler.ts:3375-3495` - `removeDuplicateFunctions()` ⚠️ Receives corrupted function

## Test Commands

```bash
# Check if function has correct params in buildGlobalDefinitionsCode
timeout 20s node -e "..." 2>&1 | grep "HHLP first line"

# Check if function is corrupted in removeDuplicateFunctions
timeout 20s node -e "..." 2>&1 | grep "Full line"
```

## Conclusion

The parameter loss is happening inside `convertToWebGL()` after the global definitions are added to the shader output string, but before `fixWebGLIncompatibilities()` is called. The most likely culprit is:

1. A hidden regex replacement
2. String truncation during the massive uniform concatenation
3. Multiple calls to a function that corrupts signatures

The fix requires adding more strategic logging to pinpoint the EXACT line where the corruption occurs.
