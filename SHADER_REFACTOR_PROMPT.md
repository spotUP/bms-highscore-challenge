# Shader Global-to-Varying Refactor Required - For Sonnet

## Critical Issue
The Mega Bezel shaders are failing to compile in WebGL due to an architectural mismatch. The game renders via fallback, but the shader effects don't work.

## The Problem

### Current Architecture (Broken)
Slang shaders use **mutable global variables** that are modified in the vertex shader and accessed in the fragment shader:

```glsl
// globals.inc (included in both stages)
float TUBE_MASK = 0;
float SCREEN_ASPECT = 1;
vec2 TUBE_DIFFUSE_COORD = vec2(0.0);

// vertex shader
void main() {
    TUBE_MASK = calculateMask();  // Modifies global
    SCREEN_ASPECT = calculateAspect();
}

// fragment shader
void main() {
    color *= TUBE_MASK;  // ERROR: undeclared identifier
    // Fragment shader can't see vertex shader's globals
}
```

### WebGL Reality
- Vertex and fragment shaders are **separate compilation units**
- Global variables **cannot be shared** between stages
- Fragment shader gets **"undeclared identifier" errors** for ~100+ variables

### Required Architecture (WebGL-Compatible)
Convert all mutable globals to **varyings**:

```glsl
// vertex shader
out float v_TUBE_MASK;
out float v_SCREEN_ASPECT;
out vec2 v_TUBE_DIFFUSE_COORD;

void main() {
    v_TUBE_MASK = calculateMask();
    v_SCREEN_ASPECT = calculateAspect();
}

// fragment shader
in float v_TUBE_MASK;
in float v_SCREEN_ASPECT;
in vec2 v_TUBE_DIFFUSE_COORD;

void main() {
    color *= v_TUBE_MASK;  // Works!
}
```

## Required Implementation

### Step 1: Create GlobalToVaryingConverter Class
Create `src/shaders/GlobalToVaryingConverter.ts`:

```typescript
export class GlobalToVaryingConverter {
  // Parse globals.inc to identify all mutable globals
  private extractGlobalVariables(globalsInc: string): GlobalVariable[]

  // Determine which globals are modified in vertex shader
  private analyzeVertexShaderUsage(vertexSource: string, globals: GlobalVariable[]): Set<string>

  // Convert globals to varyings in both stages
  public convertGlobalsToVaryings(
    vertexSource: string,
    fragmentSource: string,
    globalDefs: GlobalDefinitions
  ): { vertex: string, fragment: string }
}
```

### Step 2: Identify Affected Variables
From `public/shaders/mega-bezel/shaders/base/common/globals.inc`, these ~100 variables need conversion:

**Critical ones (from error logs):**
- `TUBE_MASK`
- `SCREEN_ASPECT`
- `TUBE_DIFFUSE_COORD`
- `TUBE_DIFFUSE_ASPECT`
- `TUBE_DIFFUSE_SCALE`
- `TUBE_SCALE`
- `SCREEN_COORD`
- `HSM_GLOBAL_CORNER_RADIUS`
- `HSM_BZL_INNER_CORNER_RADIUS_SCALE`
- `HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE`
- `HSM_CRT_CURVATURE_SCALE`
- `HSM_SCREEN_VIGNETTE_IN_REFLECTION`
- `HSM_POTATO_COLORIZE_BRIGHTNESS`
- `HSM_BG_BRIGHTNESS`
- `HSM_BG_OPACITY`

**And ~85 more globals that are computed in vertex shader**

### Step 3: Modify SlangShaderCompiler
In `src/shaders/SlangShaderCompiler.ts`:

1. **After line 1295** (where globalDefsCode is built), add:
```typescript
if (stage === 'vertex' || stage === 'fragment') {
  const converter = new GlobalToVaryingConverter();
  const converted = converter.convertGlobalsToVaryings(
    output,  // current shader source
    stage,   // 'vertex' or 'fragment'
    globalDefs
  );
  output = converted;
}
```

2. **Track varyings between stages** - ensure vertex outputs match fragment inputs

### Step 4: Transform Pattern
For each global variable that's modified in vertex shader:

1. **Remove from global declarations** in both stages
2. **Add as `out` in vertex shader**:
   ```glsl
   out float v_TUBE_MASK;
   ```
3. **Add as `in` in fragment shader**:
   ```glsl
   in float v_TUBE_MASK;
   ```
4. **Replace all references**:
   - Vertex: `TUBE_MASK` → `v_TUBE_MASK`
   - Fragment: `TUBE_MASK` → `v_TUBE_MASK`

### Step 5: Handle WebGL 1 Compatibility
For WebGL 1, use `varying` instead of `in`/`out`:
```glsl
// Both stages
varying float v_TUBE_MASK;
```

## Implementation Algorithm

```typescript
convertGlobalsToVaryings(source: string, stage: 'vertex' | 'fragment', globals: GlobalDefinitions) {
  // 1. Parse globals.inc to get all global variable declarations
  const globalVars = this.parseGlobalVariables(globals.globals);

  // 2. Identify which are modified (have assignments) in vertex shader
  const modifiedInVertex = new Set<string>();
  for (const varName of globalVars) {
    // Look for patterns like "TUBE_MASK = " or "SCREEN_ASPECT ="
    if (vertexSource.match(new RegExp(`\\b${varName}\\s*=`))) {
      modifiedInVertex.add(varName);
    }
  }

  // 3. Generate varying declarations
  const varyingDecls: string[] = [];
  for (const varName of modifiedInVertex) {
    const varType = this.getVariableType(varName, globals);
    const varyingName = `v_${varName}`;

    if (webgl2) {
      if (stage === 'vertex') {
        varyingDecls.push(`out ${varType} ${varyingName};`);
      } else {
        varyingDecls.push(`in ${varType} ${varyingName};`);
      }
    } else {
      varyingDecls.push(`varying ${varType} ${varyingName};`);
    }
  }

  // 4. Replace all references
  let output = source;
  for (const varName of modifiedInVertex) {
    // Replace "TUBE_MASK" with "v_TUBE_MASK"
    output = output.replace(
      new RegExp(`\\b${varName}\\b`, 'g'),
      `v_${varName}`
    );
  }

  // 5. Inject varying declarations after precision
  output = this.injectAfterPrecision(output, varyingDecls.join('\n'));

  // 6. Remove global variable declarations for converted vars
  for (const varName of modifiedInVertex) {
    output = output.replace(
      new RegExp(`^\\s*(float|vec\\d|mat\\d)\\s+${varName}\\s*=.*?;`, 'gm'),
      ''
    );
  }

  return output;
}
```

## Test Strategy

1. **Start with one variable** (e.g., `TUBE_MASK`)
2. **Verify it works** in both stages
3. **Then convert all ~100 variables**

## Success Criteria

When complete:
- ✅ No more "undeclared identifier" errors
- ✅ Shaders compile successfully
- ✅ Mega Bezel effects render properly
- ✅ CRT screen curvature visible
- ✅ Bezel reflection effects work

## Files to Modify

1. **Create**: `src/shaders/GlobalToVaryingConverter.ts`
2. **Modify**: `src/shaders/SlangShaderCompiler.ts` (integrate converter at line ~1295)
3. **Read**: `public/shaders/mega-bezel/shaders/base/common/globals.inc` (source of globals)

## Important Notes

- **DO NOT** modify the texture regex fix in SlangShaderCompiler.ts (lines 3630-3662)
- **DO NOT** modify the duplicate uniform detection (lines 3059-3076)
- **PRESERVE** all existing fixes from previous work
- **TEST** incrementally - convert a few variables at a time

## Current Error Examples

These are the actual errors that need to be fixed:
```
ERROR: 0:176: 'TUBE_MASK' : undeclared identifier
ERROR: 0:176: 'TUBE_DIFFUSE_ASPECT' : undeclared identifier
ERROR: 0:187: 'SCREEN_ASPECT' : undeclared identifier
ERROR: 0:188: 'TUBE_DIFFUSE_COORD' : undeclared identifier
ERROR: 0:188: 'HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE' : undeclared identifier
ERROR: 0:188: 'TUBE_DIFFUSE_SCALE' : undeclared identifier
ERROR: 0:188: 'TUBE_SCALE' : undeclared identifier
```

## Complexity Warning

This is a complex refactor involving:
- ~100 global variables
- Pattern matching and AST transformation
- Careful preservation of shader logic
- WebGL 1 vs WebGL 2 compatibility

Estimate: 2-3 hours of careful implementation and testing

## Alternative Quick Fix (Not Recommended)

If the full refactor is too complex, you could try making all globals into **uniforms** instead of varyings, but this would:
- Break the shader logic (values wouldn't update per vertex)
- Not accurately reproduce the Mega Bezel effects
- Still require significant refactoring

The proper solution is the varying conversion described above.