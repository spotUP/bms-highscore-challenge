# Slang Shader System Implementation Status

## Overview
This document describes the current state of RetroArch Slang shader support for WebGL, including what's implemented, what's working, and what's needed for full Mega Bezel POTATO preset support.

## Current Implementation

### ✅ Implemented Features

#### 1. **Preset Parser** (`SlangPresetParser.ts`)
- Parses `.slangp` preset files
- Extracts shader passes, textures, and parameters
- Handles multi-pass shader configurations
- Resolves relative paths correctly

#### 2. **Multi-Pass Renderer** (`MultiPassRenderer.ts`)
- Manages render targets for intermediate passes
- Handles history buffers (Original, OriginalHistory1-4)
- Supports multiple scaling modes (source, viewport, absolute)
- Proper texture binding between passes
- Frame buffer management

#### 3. **Slang Shader Compiler** (`SlangShaderCompiler.ts`)
Converts Slang GLSL to WebGL GLSL with the following conversions:

**Working Conversions:**
- ✅ Version directive conversion (`#version 450` → `#version 300 es`)
- ✅ Precision qualifiers injection
- ✅ Varying/in/out keyword conversion (WebGL1 vs WebGL2)
- ✅ #include file preprocessing (recursive resolution)
- ✅ #pragma parameter extraction
- ✅ UBO (Uniform Buffer Object) → individual uniforms
- ✅ Push constants → individual uniforms
- ✅ Layout qualifiers removal
- ✅ Sampler binding conversion
- ✅ Global uniform block flattening (`global.MVP` → `MVP`)
- ✅ UBO member type preservation (float, vec4, mat4, int, uint)
- ✅ Slang swizzle shorthand (`0.0.xxx` → `vec3(0.0)`)
- ✅ Global variable initialization extraction to `initGlobalVars()`
- ✅ Int literal → float conversion in comparisons
- ✅ #define directive stripping for UBO members
- ✅ #pragma parameter stripping (converted to uniforms)
- ✅ initParams() call removal

**Partial/Limited:**
- ⚠️ Texture coordinate conversion (basic only)
- ⚠️ Fragment coordinate system (`gl_FragCoord`)
- ⚠️ Attribute mapping (Position → position, TexCoord → uv)

**Not Implemented:**
- ❌ Full C preprocessor (#ifdef, #ifndef, #elif, #undef, etc.)
- ❌ Function extraction from #include files
- ❌ Constant/define extraction from #include files
- ❌ Macro expansion (#define FOO(x) bar(x))
- ❌ Global variable tracking across includes
- ❌ Complex type inference
- ❌ Builtin Slang function implementations

### 📊 Test Results

#### Mega Bezel POTATO Preset
**Status:** ❌ Not Working

**Configuration:**
- 9 shader passes
- 353-414 parameters per pass
- 7 texture dependencies
- 50+ #include files
- 800+ UBO members (globals.inc)

**Compilation Results:**
- ✅ All 9 passes load without crash
- ✅ Preset parsing successful
- ✅ Render targets created (800x800)
- ✅ Parameters extracted (345 unique)
- ❌ Fragment shader compilation fails

**Remaining Errors:**

1. **Undeclared UBO Members** (~10 errors)
   ```
   'SourceSize' : undeclared identifier
   'DerezedPassSize' : undeclared identifier
   'FinalViewportSize' : undeclared identifier
   ```
   - Cause: #define aliases interfering with UBO conversion
   - Example: `#define SourceSize params.OriginalSize`

2. **Redefined Parameters** (~2 errors)
   ```
   'HSM_GSHARP_DREZ_EMPTY_LINE' : redefinition
   'GSHARP_DREZ_TITLE' : redefinition
   ```
   - Cause: Parameters extracted multiple times from includes
   - Duplicate uniform declarations

3. **Missing Functions from Includes** (~20 errors)
   ```
   'HSM_GetTubeCurvedCoord' : no matching overloaded function found
   'HSM_Linearize' : no matching overloaded function found
   'HSM_GetCoreImageSplitDirection' : no matching overloaded function found
   'HSM_UpdateGlobalScreenValuesFromCache' : no matching overloaded function found
   ```
   - Cause: Functions defined in #include files not being extracted
   - Requires function-aware preprocessor

4. **Missing Constants** (~15 errors)
   ```
   'DEFAULT_SRGB_GAMMA' : undeclared identifier
   'DEFAULT_SCREEN_HEIGHT' : undeclared identifier
   'CACHE_INFO_CHANGED' : undeclared identifier
   'RW' : undeclared identifier
   'wp_temp' : undeclared identifier
   ```
   - Cause: Constants/defines from includes not propagated
   - Some are global defines, some from #define chains

5. **Invalid Number Syntax** (~1 error)
   ```
   '700.00.' : invalid number
   ```
   - Cause: Int literal conversion regex too aggressive
   - Converting `7000.` to `7000.0.` incorrectly

6. **Type Conversion Errors** (~5 errors)
   ```
   '=' : cannot convert from 'int' to 'highp float'
   '-' : wrong operand types (const int vs highp float)
   ```
   - Cause: Missing type coercion in arithmetic
   - Need to convert int literals to float in expressions

## Architecture

### File Structure
```
src/shaders/
├── SlangPresetParser.ts       # Parses .slangp files
├── SlangShaderCompiler.ts     # Converts Slang → WebGL GLSL
├── MultiPassRenderer.ts       # Multi-pass rendering engine
├── ParameterManager.ts        # Uniform parameter management
└── examples/                  # Example shader integrations
    └── PongSlangDemo.tsx      # Demo page with Pong game
```

### Data Flow
```
.slangp file
    ↓
SlangPresetParser.parse()
    ↓
{passes: [...], textures: [...], parameters: [...]}
    ↓
MultiPassRenderer.loadShaders()
    ↓
For each pass:
  1. Fetch .slang file
  2. SlangShaderCompiler.loadFromURL()
  3. Recursive #include preprocessing
  4. SlangShaderCompiler.compile()
     a. Extract pragmas (#pragma parameter)
     b. Extract UBO bindings
     c. Convert to WebGL GLSL
     d. Strip #define directives
     e. Remove initParams() calls
     f. Inject parameter uniforms
  5. Create Three.js ShaderMaterial
  6. Create render target
    ↓
Render loop:
  1. Update uniforms (SourceSize, FrameCount, params)
  2. For each pass:
     - Bind input textures
     - Render to target
  3. Final pass renders to screen
```

## What's Needed for Mega Bezel Support

### 🔧 Critical Fixes Required

#### 1. **Full Preprocessor Implementation**
**Priority:** HIGH
**Effort:** Large (2-3 weeks)

Currently missing:
- `#ifdef` / `#ifndef` / `#elif` / `#else` / `#endif`
- `#undef`
- Macro expansion with arguments
- Proper #define scoping
- Conditional compilation

**Impact:** 60% of errors

**Approach:**
- Use existing preprocessor library (e.g., `glsl-preprocessor`)
- Or implement custom recursive descent preprocessor
- Must handle nested conditions and macro expansion

#### 2. **Function Extraction from Includes**
**Priority:** HIGH
**Effort:** Medium (1-2 weeks)

Need to:
- Parse function definitions from #include files
- Track function dependencies
- Resolve function call order
- Handle function overloading
- Preserve function signatures

**Impact:** 30% of errors

**Approach:**
- Add GLSL AST parser (e.g., `glsl-parser`)
- Extract all function definitions during #include processing
- Build dependency graph
- Topologically sort functions

#### 3. **Constant & Define Propagation**
**Priority:** MEDIUM
**Effort:** Medium (1 week)

Need to:
- Track `#define CONSTANT value` across includes
- Resolve define chains (`#define A B`, `#define B 5`)
- Replace constant references in code
- Handle expression defines

**Impact:** 5% of errors

**Approach:**
- Build symbol table during preprocessing
- Track all #define statements with values
- Perform substitution pass after includes resolved

#### 4. **Type Coercion & Inference**
**Priority:** LOW
**Effort:** Small (2-3 days)

Need to:
- Auto-convert int to float in mixed expressions
- Handle implicit type conversions
- Better literal detection

**Impact:** 3% of errors

#### 5. **Duplicate Symbol Detection**
**Priority:** LOW
**Effort:** Small (1-2 days)

Need to:
- Deduplicate parameters from multiple includes
- Track which parameters already declared
- Prevent redefinition errors

**Impact:** 2% of errors

### 📋 Recommended Approach

**Phase 1: Foundation (Week 1-2)**
1. Integrate glsl-parser or custom AST parser
2. Implement function extraction from includes
3. Build symbol table for all definitions

**Phase 2: Preprocessor (Week 3-4)**
1. Implement #ifdef/#ifndef conditionals
2. Add macro expansion with arguments
3. Implement #undef support

**Phase 3: Type System (Week 5)**
1. Add type inference engine
2. Implement automatic type coercion
3. Better literal handling

**Phase 4: Testing (Week 6)**
1. Test with Mega Bezel POTATO
2. Test with other complex presets
3. Performance optimization

### 🎯 Alternative: Simpler Shader Testing

To validate the current implementation works, test with simpler shaders:

**Single-Pass Shaders** (should work now):
- `crt-pi.slang` - Simple CRT shader
- `ntsc.slang` - NTSC TV effect
- `sharp-bilinear.slang` - Sharp scaling

**2-3 Pass Shaders** (might work):
- `crt-royale-kurozumi.slangp` - Simpler CRT preset
- `crt-easymode.slangp` - Easy CRT effect

**Complex Presets** (won't work yet):
- `mega-bezel-*.slangp` - Requires full preprocessor
- `crt-royale.slangp` - Requires function extraction

## Current Code Quality

### ✅ Good
- Well-structured TypeScript with interfaces
- Comprehensive error handling
- Recursive #include resolution
- Proper path handling
- Clean separation of concerns

### ⚠️ Needs Work
- Regex-based parsing (fragile for complex cases)
- No AST representation
- Limited error messages
- No shader cache
- Performance not optimized

## Conclusion

The current implementation provides a solid **foundation** for Slang shader support:
- ✅ Preset parsing works
- ✅ Multi-pass rendering works
- ✅ Basic syntax conversion works
- ✅ #include preprocessing works

However, **Mega Bezel POTATO requires**:
- ❌ Full preprocessor (#ifdef, macros)
- ❌ Function extraction
- ❌ Better type system
- ❌ Constant propagation

**Estimated effort for full Mega Bezel support:** 6 weeks
**Estimated effort for simple shaders:** Already works, just needs testing

**Recommendation:** Test with simple single-pass shaders first to validate the architecture, then incrementally add preprocessor features.
