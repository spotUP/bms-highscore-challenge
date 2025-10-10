# Shader Fixes Status Report - In Progress

## Current Error Count: 39,394 (down from 40,246)

### ✅ Fixed Issues (852 errors eliminated)
1. **Redefinition errors reduced** - Made some constants conditional
2. **Improved removeDuplicateFunctions()** - Better regex to catch more function types
3. **Added debug logging** - For tracking down issues

### ❌ Critical Remaining Issues

#### 1. Parameter Loss Bug - STILL NOT FIXED (6,912 errors)
**Symptoms:**
- `'value_to_match' : undeclared identifier` - 3,456 errors
- `'threshold' : undeclared identifier` - 3,456 errors

**Analysis:**
The function `HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)` exists in the source file with all 3 parameters, but somehow only 1 parameter makes it into the compiled output.

**What I've Checked:**
- ✅ Original source file has correct signature
- ✅ `removeDuplicateFunctions()` preserves the full line (line 3462: `result.push(line)`)
- ✅ Regex can match the function (regex on line 3409 should work)
- ❌ **Debug logging NOT appearing** - This means the function isn't being caught by removeDuplicateFunctions at all!

**Hypothesis:**
The function may not be matching the regex because:
1. It might have qualifiers like `inline`, `static`, or other modifiers not in our regex
2. The include file processing might be stripping parameters BEFORE removeDuplicateFunctions runs
3. There might be another transformation step that corrupts the function signature

**Next Steps to Debug:**
1. Add console.log at the START of removeDuplicateFunctions to see if it's even being called
2. Log the first 100 lines of input to removeDuplicateFunctions to see if the function is there
3. Check if the include preprocessing is corrupting the function
4. Search for ANY code that might be doing regex replacements on function signatures

#### 2. Constant Redefinition (Still ~1,500 errors)
- `HSM_POTATO_COLORIZE_CRT_WITH_BG` - 1,071 errors
- Various TUBE_* constants - ~430 errors each

**Issue:**
The `#ifndef` guards don't work for variable declarations. These constants are already defined as shader parameters (via #pragma parameter) and we shouldn't be injecting them at all.

**Fix:**
Remove ALL constant injections except for truly missing constants like M_PI. The shader parameter system should handle these values.

#### 3. Dimension Mismatch Errors (5,598 errors)
These are cascading from the parameter loss bug. When functions are missing parameters, their return values don't match the expected types.

#### 4. Texture2D Overload Issues (1,070 errors)
Some texture2D calls still have wrong signatures after our fixes.

#### 5. Missing Helper Functions (648 errors each)
- `HSM_GetVTexCoordWithArgs`
- `HSM_GetInverseScaledCoord`
- `HSM_AddPosScaleToCoord`

These are likely suffering from the same parameter loss bug.

### 📊 Error Breakdown

| Error Type | Count | Status |
|------------|-------|--------|
| Dimension mismatch | 5,598 | Cascading from param loss |
| value_to_match undeclared | 3,456 | ROOT CAUSE - param loss |
| threshold undeclared | 3,456 | ROOT CAUSE - param loss |
| Type conversion errors | 3,445 | Cascading |
| Redefinition errors | 1,071 | Need to remove injections |
| texture2D issues | 1,070 | Secondary |
| Missing functions | 648+ | Likely param loss |
| Missing constants | 2,365 | Should be shader params |

### 🔍 Investigation Plan

1. **Immediate:** Add comprehensive logging to understand where parameters are lost
   ```typescript
   console.log('[removeDuplicateFunctions] INPUT length:', glslCode.length);
   console.log('[removeDuplicateFunctions] First occurrence of HHLP_GetMaskCenteredOnValue:',
               glslCode.indexOf('HHLP_GetMaskCenteredOnValue'));
   console.log('[removeDuplicateFunctions] Function context:',
               glslCode.substring(glslCode.indexOf('HHLP_GetMaskCenteredOnValue') - 50,
                                glslCode.indexOf('HHLP_GetMaskCenteredOnValue') + 200));
   ```

2. **Check include processing:** The function comes from an `.inc` file. Check if `preprocessIncludes()` is corrupting it.

3. **Check for other transformations:** Search for ANY code doing regex replacements on function signatures between include processing and removeDuplicateFunctions.

4. **Check convertToWebGL:** This is called BEFORE fixWebGLIncompatibilities (which calls removeDuplicateFunctions). Maybe the corruption happens there?

### 💡 Key Insight

The debug logging I added to removeDuplicateFunctions is NOT appearing in the output, which means:
- Either the function isn't being called
- OR the function definition never makes it into the code being processed
- OR the regex isn't matching (but it should match based on the original source)

This is the smoking gun - we need to trace the shader code through each transformation step to see where the parameters disappear.

### 📝 Code Changes Made

1. **SlangShaderCompiler.ts:3409** - Improved function matching regex
2. **SlangShaderCompiler.ts:3433-3439** - Added debug logging
3. **SlangShaderCompiler.ts:3449-3451** - Added skip logging
4. **SlangShaderCompiler.ts:3630-3632** - Conditional HSM_POTATO_COLORIZE_CRT_WITH_BG

### 🎯 Success Metrics

**Current:** 39,394 errors
**Target:** Under 5,000 errors
**Stretch Goal:** Under 1,000 errors

**To achieve target, must fix:**
1. Parameter loss bug (eliminates ~10,000 errors)
2. Redefinition issues (eliminates ~1,500 errors)
3. Cascading type errors will auto-fix once params are fixed

### ⚠️ Warning

Do NOT add more constant injections without verifying they're not already defined as shader parameters! This just creates more redefinition errors.
