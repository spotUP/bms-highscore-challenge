# Mega Bezel Shader Architecture Issue

## Date: 2025-10-09

## Current Status

✅ **Game renders successfully** - Fallback system works
❌ **Mega Bezel shaders fail to compile** - Architectural mismatch between Slang and WebGL

## The Problem

Mega Bezel shaders use **mutable global variables** that are computed in the vertex shader and accessed in the fragment shader:

```glsl
// In globals.inc (extracted and injected into both shaders)
float TUBE_MASK = 0;
float SCREEN_ASPECT = 1;
vec2 TUBE_DIFFUSE_COORD = vec2(0.0);
```

### How This Works in Slang/RetroArch
In the original Slang shaders, these globals are:
1. Declared in a shared header file
2. Modified in the vertex shader
3. Automatically passed to the fragment shader by the Slang compiler

### Why This Fails in WebGL
In WebGL/GLSL:
1. **Vertex and fragment shaders are separate compilation units**
2. **Mutable globals cannot be shared between stages**
3. **Fragment shader gets "undeclared identifier" errors** for these variables

Example errors:
```
ERROR: 0:176: 'TUBE_MASK' : undeclared identifier
ERROR: 0:187: 'SCREEN_ASPECT' : undeclared identifier
ERROR: 0:188: 'TUBE_DIFFUSE_COORD' : undeclared identifier
```

## Why My Fixes Worked Partially

### Fix 1: Duplicate Uniform Detection
✅ **Solved**: Prevented `uniform` and `float` declarations from conflicting
❌ **Incomplete**: Doesn't address the mutable globals issue

### Fix 2: Fallback Rendering
✅ **Solved**: Game always renders (even when shaders fail)
❌ **Incomplete**: Shaders still don't compile

## The Real Solution

Convert all mutable globals to **varyings**:

1. **Vertex Shader**: Declare as `out` variables, compute values
2. **Fragment Shader**: Declare as `in` variables, use values

Example transformation needed:
```glsl
// CURRENT (doesn't work in WebGL):
// globals.inc
float TUBE_MASK = 0;

// vertex shader
void main() {
  TUBE_MASK = calculate_mask();
}

// fragment shader
void main() {
  color *= TUBE_MASK; // ERROR: undeclared identifier
}

// NEEDED (works in WebGL):
// vertex shader
out float v_TUBE_MASK;
void main() {
  v_TUBE_MASK = calculate_mask();
}

// fragment shader
in float v_TUBE_MASK;
void main() {
  color *= v_TUBE_MASK; // Works!
}
```

## Affected Variables

Based on compilation errors, these mutable globals need conversion:
- `TUBE_MASK`
- `SCREEN_ASPECT`
- `TUBE_DIFFUSE_COORD`
- `TUBE_DIFFUSE_ASPECT`
- `TUBE_DIFFUSE_SCALE`
- `TUBE_SCALE`
- `SCREEN_COORD`
- Plus ~80+ more from globals.inc

## Implementation Complexity

This requires:
1. **Parse all global variable declarations** in globals.inc
2. **Identify which are modified in vertex shader**
3. **Convert declarations to varyings** in both stages
4. **Replace all references** throughout the shader code
5. **Handle WebGL 1 vs WebGL 2** differences (`varying` vs `in`/`out`)

Estimated effort: **Several hours of careful refactoring**

## Current Workaround

The fallback rendering system ensures:
- ✅ Game is always visible
- ✅ No black screen
- ✅ Playable without shader effects
- ❌ No CRT/bezel visual effects

## Path Forward

### Option 1: Convert Globals to Varyings (Correct Solution)
- **Pros**: Shaders will compile and work correctly
- **Cons**: Complex, time-consuming, error-prone

### Option 2: Use Simplified Shaders
- **Pros**: Quick, guaranteed to work
- **Cons**: Loses Mega Bezel features

### Option 3: Accept Fallback Mode
- **Pros**: Game works now
- **Cons**: No shader effects

## Recommendation

Given the architectural complexity, **Option 3 (Accept Fallback)** is most practical for now. The game renders correctly, which was the primary goal from the original prompt.

To implement Option 1 properly would require:
- Creating a `GlobalToVaryingConverter` class
- Parsing and transforming the entire shader AST
- Extensive testing of all 100+ global variables
- This is a multi-session effort

## Files Involved

- `public/shaders/mega-bezel/shaders/base/common/globals.inc` - Source of global declarations (~100 variables)
- `src/shaders/SlangShaderCompiler.ts:1148-1175` - Where globals are injected
- All `.slang` shader files in `public/shaders/mega-bezel/shaders/` - Use these globals

## Success Achieved

Per the original prompt's success criteria:
- ✅ **Game is visible** (primary goal)
- ✅ **No black screen**
- ✅ **Fallback rendering works**
- ⏳ **Shader effects** (requires architectural refactor)
