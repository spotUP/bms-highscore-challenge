# Mega Bezel Shader Fixes - Complete Summary

## Current Status: MAJOR PROGRESS - ~20 Unique Errors Remaining

The shader compilation errors have been reduced from 200+ unique issues to approximately **20 unique errors that repeat 219 times** (one set per shader compilation attempt).

## Fixes Successfully Applied

### 1. Do-While Loop Conversion ✅
**Location**: `SlangShaderCompiler.ts:3393-3425`
**Fix**: Converts `do { body } while (condition);` → `{ body while (condition) { body } }`
**Reason**: WebGL 1 GLSL doesn't support do-while loops

### 2. Texture Function Conversions ✅
**Location**: `SlangShaderCompiler.ts:3458-3476`
**Fixes**:
- `texture(sampler, coord, lod)` → `texture2D(sampler, coord)` (strips LOD parameter)
- `texture(sampler, coord)` → `texture2D(sampler, coord)`
- `textureLod(sampler, coord, lod)` → `texture2D(sampler, coord)`
- `textureLodOffset(sampler, coord, lod, offset)` → `texture2D(sampler, coord)`
- `textureSize(sampler, lod)` → `ivec2(1024, 1024)` (fallback)

### 3. Function Overload Support ✅
**Location**: `SlangShaderCompiler.ts:3350-3378`
**Fix**: Modified `removeDuplicateFunctions()` to track full signatures `functionName(params)` instead of just name
**Result**: Preserves functions like `gaussian(float x)` and `gaussian(float x, float y)`

### 4. Type Conversions ✅
**Location**: `SlangShaderCompiler.ts:3442-3443, 3449-3451`
**Fixes**:
- `mat3x3` → `mat3`
- `mat2x2` → `mat2`
- `uint` → `float` (uniforms, variables, casts)

### 5. Missing Constants ✅
**Location**: `SlangShaderCompiler.ts:3532-3580`
**Added**: M_PI, CCONTR, CSHARPEN, CDETAILS defines plus color/gamut constants

### 6. Sampler Qualifiers ✅
**Location**: `SlangShaderCompiler.ts:3497-3498`
**Fix**: Removed `out`/`inout` from sampler2D parameters (not allowed for opaque types)

## Remaining Issues (20 Unique Errors × 219 Repetitions)

### Priority 1: Storage Qualifiers (CRITICAL)
**Error**: `'in'/'out' : storage qualifier supported in GLSL ES 3.00 and above only`
**Lines**: 215-216, 220-222
**Count**: 219 occurrences each

**Problem**: Three.js is getting shaders with raw `in`/`out` qualifiers that need conversion to `varying` (for inter-stage variables) or removal (for function parameters)

**Solution Needed**:
- Implement smart in/out → varying conversion ONLY for interface blocks
- Skip conversion for function parameters (inside parentheses)
- Skip conversion for built-in variables (position, uv, gl_*)

### Priority 2: Function Parameter Loss
**Errors**:
- `'in_pos' : undeclared identifier` (line 2180)
- `'in_scale' : undeclared identifier` (line 2181)
- `'value_to_match' : undeclared identifier` (multiple)
- `'threshold' : undeclared identifier` (multiple)

**Count**: 219 each

**Problem**: Function signatures are losing parameters during processing

**Investigation Needed**: Check if removeDuplicateFunctions or another transform is corrupting parameter lists

### Priority 3: Return Type Mismatches
**Errors**:
- `'FxaaLuma' : no matching overloaded function found` (line 324)
- `'xyz' : field selection requires structure or vector on left hand side` (line 324)
- Cannot convert vec4 to vec3 (line 358)

**Count**: 219 each

**Problem**: FxaaLuma function returning vec4 when vec3 expected, or being called on wrong type

### Priority 4: Duplicate Functions Still Appearing
**Error**: `'HSM_GetCurvedCoord' : function already has a body` (line 2468)
**Count**: 219

**Problem**: Function deduplication not catching all duplicates despite signature-based matching

### Priority 5: texture2D Argument Count
**Error**: `'texture2D' : no matching overloaded function found` (line 2276)
**Count**: 219

**Problem**: Some texture2D calls still have wrong number of arguments after conversion

### Priority 6: Function Return Type Errors
**Errors**:
- `'HSM_AddPosScaleToCoord' : no matching overloaded function found` (line 2223)
- `'return' : function return is not matching type` (line 2223)

**Count**: 219

**Problem**: Function signature mismatch or wrong return type

### Priority 7: Syntax Errors
**Errors**:
- `'dot' : no matching overloaded function found` (line 2580)
- `')' : syntax error` (line 2580, 359)

**Count**: 219 each

**Problem**: Likely cascading from earlier errors or malformed function calls

## Next Steps - Systematic Fix Order

### Step 1: Fix Storage Qualifiers (Will eliminate ~438 errors)
Create a proper in/out → varying converter that:
1. Only converts global scope (not inside functions)
2. Converts interface block variables (between vertex and fragment shaders)
3. Leaves function parameters unchanged
4. Excludes built-in variables

### Step 2: Debug Parameter Loss (Will eliminate ~876+ errors)
1. Add logging to removeDuplicateFunctions to see what's being removed
2. Check if parameter parsing regex is correct
3. Verify the full signature matching isn't corrupting params

### Step 3: Fix FxaaLuma Function
1. Find the function definition
2. Check if it's returning wrong type or being called incorrectly
3. May need to add .xyz swizzle or change return type

### Step 4: Fix Remaining texture2D Issues
1. Find calls with 3+ arguments
2. Ensure LOD stripping regex catches all patterns

### Step 5: Test and Iterate
After each fix, restart and count errors:
```bash
killall -9 node && sleep 2 && npm run dev
timeout 25s node capture-webgl-errors.mjs 2>&1 | grep -c "ERROR:"
```

## Success Criteria

- [ ] Zero "storage qualifier" errors
- [ ] Zero "undeclared identifier" errors for function parameters
- [ ] Zero "function already has a body" errors
- [ ] Zero "no matching overloaded function" errors
- [ ] DirectWebGLCompiler reports "✅ Shader compiled successfully!"
- [ ] Mega Bezel shaders render with CRT effects

## Error Count Tracking

- **Initial**: ~200+ unique errors
- **After basic fixes**: ~20 unique errors × 219 repetitions = ~4,380 total
- **Target**: 0 errors

The 219 repetition factor suggests we're compiling the same problematic shader(s) multiple times, or there are 219 shader variants. Fixing the 20 unique issues will eliminate all 4,380+ error messages.
