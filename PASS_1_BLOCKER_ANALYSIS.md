# Pass 1 Blocker - HSM_FRM_OUTER_EDGE_THICKNESS Undeclared

**Date**: 2025-10-11
**Status**: 🔴 BLOCKED - Complex architectural issue
**Pass**: Pass 1 (cache-info-all-params.slang)
**Error**: `ERROR: 0:4003: 'HSM_FRM_OUTER_EDGE_THICKNESS' : undeclared identifier`

---

## Summary

HSM_FRM_* variables (and likely many other HSM_* parameters) are neither declared as uniforms NOR extracted as global variables, leaving them completely undeclared in the compiled shader.

---

## Root Cause Chain

### 1. Variable Declaration Pattern

The Mega Bezel shaders use a complex pattern for these variables:

**In `globals.inc` (line 377)**:
```glsl
float HSM_FRM_INNER_EDGE_HIGHLIGHT; float HSM_FRM_OUTER_EDGE_THICKNESS;
```
- Declares variables without initialization

**In `params-2-bezel.inc` (line 174-175)**:
```glsl
#pragma parameter HSM_FRM_OUTER_EDGE_THICKNESS "Outer Edge Thickness" 100 0 1000 10
float HSM_FRM_OUTER_EDGE_THICKNESS = global.HSM_FRM_OUTER_EDGE_THICKNESS * 0.00006;
```
- Pragma creates a parameter
- Initialization derives a local variable from the UBO value

### 2. Current Compiler Behavior

**Step 1 - Pragma Extraction** (line 70):
- `HSM_FRM_OUTER_EDGE_THICKNESS` added to `pragmas.parameters[]`

**Step 2 - excludeNames Creation** (line 78):
- `HSM_FRM_OUTER_EDGE_THICKNESS` added to `excludeNames` set
- Purpose: Prevent extracting variables that conflict with uniforms

**Step 3 - Global Extraction** (lines 609-614, 688):
- BOTH the declaration AND initialization are SKIPPED because name is in `excludeNames`
- Result: Variable not in `globalDefs.globals[]`

**Step 4 - Uniform Generation** (lines 1639-1660):
- Parameters already in UBO are filtered out (line 1642)
- `HSM_FRM_OUTER_EDGE_THICKNESS` is in the UBO block, so it's skipped
- Result: No uniform created

**Step 5 - Final Shader**:
- Variable is NEITHER a global NOR a uniform
- Shader tries to use it → UNDECLARED IDENTIFIER

### 3. Why This Happens

The architecture assumes:
- Either a parameter becomes a uniform (if not in UBO)
- OR it's accessed via UBO member syntax (`global.X`)

But Mega Bezel shaders do:
- Declare in UBO
- Create derived local variable with same name
- Use the derived variable throughout shader

The compiler strips the derived variable thinking the uniform will handle it, but the uniform is never created because the parameter is already in the UBO.

---

## Investigation Logs

**Console output shows**:
```
[SlangCompiler] Skipped HSM_FRM_OUTER_EDGE_THICKNESS via excludeNames (in pragmas or UBO)
```

**Uniforms NOT generated**:
```bash
$ grep "uniform.*HSM_FRM" shader.frag
# NO RESULTS
```

**Parameters exist**:
- #pragma parameter exists in source
- Added to pragmas.parameters[]
- Added to excludeNames

**But filtered out**:
- Line 1642: `if (existingMembers.has(param.name)) return false;`
- `HSM_FRM_OUTER_EDGE_THICKNESS` is in UBO, so skipped from uniform generation

---

## Attempted Fixes

### Fix 1: Remove redundant UBO initializers ✅
**Code**: Lines 101-110
**Result**: Works but too restrictive - only removes exact matches like `float X = global.X;`

### Fix 2: Smart global. replacement ✅
**Code**: Lines 144-168
**Result**: Detects and comments out self-referential inits like `float X = global.X * calc;`

### Fix 3: Clean globalDefs after replacement ✅
**Code**: Lines 168-206
**Result**: Cleans both `globalDefs.defines` and `globalDefs.globals` of self-referential entries

### Fix 4: Fragment shader gets defines ✅
**Code**: Line 1543
**Result**: Both vertex and fragment shaders now get all defines

**None of these fixes solve the core problem**: The variables are excluded from extraction BEFORE any of this cleanup runs.

---

## Potential Solutions

### Option A: Fix UBO → Uniform Conversion
**Location**: Lines 3490-3510, UBO extraction logic
**Approach**: Ensure UBO members create individual uniforms even when pragma parameters exist
**Complexity**: High - requires understanding UBO block parsing and uniform generation
**Risk**: Medium - could break other shaders that depend on current behavior

### Option B: Don't Exclude From Global Extraction
**Location**: Lines 609-614, 688
**Approach**: Allow these variables to be extracted as globals even if they're in pragmas
**Then**: The smart global. replacement (Fix 2) will comment out circular inits
**Complexity**: Medium - need to ensure uniforms aren't also created (double declaration)
**Risk**: Medium - could cause redefinition errors if not careful

### Option C: Create Hybrid System
**Approach**:
1. Extract uninitialized declaration: `float HSM_FRM_OUTER_EDGE_THICKNESS;`
2. Skip the initialization line (it's circular after replacement)
3. The pragma parameter creates a uniform
4. Shader uses the global variable, which reads from uniform

**Complexity**: High - requires careful coordination between extraction and uniform generation
**Risk**: High - complex interactions between multiple systems

### Option D: Transform Initialization Pattern
**Approach**:
1. Detect pattern: `float X = global.X * calc;`
2. Transform to: `float X = UNIFORM_X * calc;` (rename uniform)
3. OR: Initialize in shader code instead of at declaration

**Complexity**: Very High - AST-level transformation
**Risk**: Very High - could break many shaders

---

## Recommendation

**Option B is most promising** because:
1. Simpler than Option A (don't need to understand full UBO conversion)
2. Builds on existing fixes (smart global. replacement already works)
3. Localized changes to extraction logic
4. Lower risk than hybrid or transformation approaches

**Implementation**:
1. Modify lines 609-614 to NOT skip variables that have declarations in globals.inc
2. The initialization lines will be commented out by Fix 2
3. Only the uninitialized declaration will be extracted
4. Pragmas will create uniforms (existing behavior)
5. Shader code can use both the global variable and the uniform

**Caveat**: Need to ensure this doesn't cause double declarations or redefinition errors.

---

## Files Modified This Session

1. **src/shaders/SlangShaderCompiler.ts**:
   - Lines 105: Fixed UBO initializer regex to require semicolon
   - Lines 144-168: Smart global. replacement to avoid circular inits
   - Lines 159-166: Comment out self-referential variable initializations
   - Lines 168-186: Clean globalDefs.defines of self-referential entries
   - Lines 188-206: Clean globalDefs.globals of self-referential entries
   - Line 1490: Restored isVertex variable declaration
   - Line 1543: Fragment shaders now get all defines

---

## Current State

- **Pass 0**: ✅ Compiling
- **Pass 1**: ❌ BLOCKED on HSM_FRM_* undeclared variables
- **Passes 2-14**: ⏳ Unknown (can't test until Pass 1 works)

**Total Progress**: 1 out of 15 passes working (6.7%)

---

## Next Session TODO

1. Implement Option B: Allow pragma parameters to be extracted as globals
2. Modify exclusion logic at lines 609-614 and 688
3. Add safeguards to prevent double declarations
4. Test with Pass 1 to verify HSM_FRM_* variables are declared
5. Continue through remaining passes

---

## Key Code Locations

- **Pragma extraction**: Line 70
- **excludeNames creation**: Lines 78-87
- **Global extraction (initialized)**: Lines 592-675
- **Global extraction (uninitialized)**: Lines 677-699
- **Uniform generation from pragmas**: Lines 1639-1660
- **UBO → Uniform conversion**: Lines 3490-3510
- **Global. replacement**: Lines 144-168

---

**Status**: Ready for next session to implement Option B and continue shader pass progression.
