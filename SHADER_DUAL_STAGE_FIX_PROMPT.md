# Fix Mega Bezel Shader Visual Effects - Dual-Stage Variable Modification Pattern

## Current Situation

The game renders but without visual shader effects (CRT curvature, bezels, reflections). The GlobalToVaryingConverter successfully fixed cross-stage communication for single-stage modified variables, but ~70-85 variables are modified in BOTH vertex AND fragment shaders, which WebGL doesn't support.

## The Core Problem

### Mega Bezel's Expectation (Slang/Vulkan pattern):
```glsl
// globals.inc - shared mutable state
float TUBE_MASK = 0;

// Vertex shader
TUBE_MASK = calculateInitialMask();  // Sets value

// Fragment shader
TUBE_MASK = refineWithFragmentData(); // Modifies same variable
color *= TUBE_MASK;                   // Uses final value
```

### WebGL Reality:
- Vertex and fragment shaders are separate compilation units
- Cannot share mutable variables between stages
- Varyings are read-only in fragment shader
- Each stage needs its own variable scope

## Current Implementation Status

**GlobalToVaryingConverter.ts** currently:
1. ✅ Detects dual-stage modified variables
2. ✅ Logs "Skipping X (modified in both stages - needs local handling)"
3. ❌ Doesn't generate the local handling code
4. ❌ Leaves these variables as globals (causing them to not work)

**Result**: Variables like `TUBE_MASK`, `SCREEN_ASPECT`, `TUBE_DIFFUSE_COORD` remain broken, preventing visual effects.

## Required Solution: Local Variable Transformation

### Transform dual-stage variables into a three-part system:

1. **Global declaration** (for initial value)
2. **Varying** (for vertex→fragment communication)
3. **Local variable** in fragment (for modifications)

### Transformation Pattern:

```glsl
// BEFORE (Slang pattern - doesn't work in WebGL):
// Vertex shader:
TUBE_MASK = calculateInVertex();

// Fragment shader:
TUBE_MASK = refineInFragment();
color *= TUBE_MASK;

// AFTER (WebGL-compatible):
// Vertex shader:
out float v_TUBE_MASK;
v_TUBE_MASK = calculateInVertex();

// Fragment shader:
in float v_TUBE_MASK;
float TUBE_MASK = v_TUBE_MASK;  // Create local with same name
TUBE_MASK = refineInFragment(); // Now modifies local
color *= TUBE_MASK;              // Uses local
```

## Implementation Steps

### Step 1: Update GlobalToVaryingConverter.ts

Modify the converter to handle dual-stage variables:

```typescript
private processDualStageVariables(
  vertexSource: string,
  fragmentSource: string,
  dualStageVars: Set<string>,
  globalVars: GlobalVariable[]
): { vertex: string; fragment: string } {

  let processedVertex = vertexSource;
  let processedFragment = fragmentSource;

  for (const varName of dualStageVars) {
    const varType = this.getVariableType(varName, globalVars);

    // 1. In vertex: Convert to varying output
    // Replace "TUBE_MASK = value" with "v_TUBE_MASK = value"
    processedVertex = this.convertToVaryingOutput(processedVertex, varName, varType);

    // 2. In fragment:
    // a) Add varying input declaration
    // b) Add local variable initialization from varying
    // c) Keep modifications using local name
    processedFragment = this.addLocalVariableSystem(processedFragment, varName, varType);
  }

  return { vertex: processedVertex, fragment: processedFragment };
}

private convertToVaryingOutput(source: string, varName: string, varType: string): string {
  // Add varying output declaration
  const varyingDecl = this.generateVaryingDecl(varName, varType, 'vertex');
  source = this.injectVaryingDeclaration(source, varyingDecl);

  // Replace assignments: "TUBE_MASK = x" → "v_TUBE_MASK = x"
  const assignPattern = new RegExp(`\\b${varName}\\s*=`, 'g');
  source = source.replace(assignPattern, `v_${varName} =`);

  // Replace reads: "x = TUBE_MASK" → "x = v_TUBE_MASK"
  const readPattern = new RegExp(`\\b${varName}\\b(?!\\s*=)`, 'g');
  source = source.replace(readPattern, `v_${varName}`);

  // Remove global declaration
  source = this.removeGlobalDeclaration(source, varName, varType);

  return source;
}

private addLocalVariableSystem(source: string, varName: string, varType: string): string {
  // Add varying input declaration
  const varyingDecl = this.generateVaryingDecl(varName, varType, 'fragment');
  source = this.injectVaryingDeclaration(source, varyingDecl);

  // Find main() function and inject local variable initialization
  const mainPattern = /void\s+main\s*\(\s*\)\s*{/;
  const mainMatch = source.match(mainPattern);

  if (mainMatch && mainMatch.index !== undefined) {
    const insertPos = mainMatch.index + mainMatch[0].length;
    const localDecl = `\n  ${varType} ${varName} = v_${varName}; // Local copy from varying\n`;
    source = source.slice(0, insertPos) + localDecl + source.slice(insertPos);
  }

  // Remove global declaration (local variable now handles it)
  source = this.removeGlobalDeclaration(source, varName, varType);

  return source;
}
```

### Step 2: Update the main conversion function

In `convertGlobalsToVaryings()`, add handling for dual-stage variables:

```typescript
// After identifying varying candidates...
const dualStageModified = new Set<string>();

for (const globalVar of globalVars) {
  const inVertex = modifiedInVertex.has(globalVar.name);
  const inFragment = modifiedInFragment.has(globalVar.name);

  if (inVertex && inFragment && !this.isActuallyConstant(...)) {
    dualStageModified.add(globalVar.name);
  }
}

// Process dual-stage variables separately
if (dualStageModified.size > 0) {
  console.log(`[GlobalToVaryingConverter] Processing ${dualStageModified.size} dual-stage variables`);
  const dualProcessed = this.processDualStageVariables(
    processedVertex,
    processedFragment,
    dualStageModified,
    globalVars
  );
  processedVertex = dualProcessed.vertex;
  processedFragment = dualProcessed.fragment;
}
```

### Step 3: Handle Special Cases

Some variables need special handling:

1. **Bool types**: Convert bool→int in varyings, add proper casting
2. **Arrays**: Can't be varyings, need alternative approach
3. **Complex initializations**: May need to preserve initialization logic

```typescript
private getLocalInitialization(varName: string, varType: string): string {
  // Special handling for bool types
  if (varType === 'bool') {
    return `bool ${varName} = bool(v_${varName});`;
  }

  // Special handling for variables with complex initialization
  const complexInits = ['DEFAULT_SCREEN_SCALE', 'DEFAULT_BEZEL_SCALE'];
  if (complexInits.includes(varName)) {
    // Preserve original initialization
    return `${varType} ${varName} = v_${varName}; // TODO: May need original init logic`;
  }

  return `${varType} ${varName} = v_${varName};`;
}
```

## Testing Strategy

1. **Start with critical variables** that affect visual output:
   - `TUBE_MASK` - Controls CRT tube masking
   - `SCREEN_ASPECT` - Screen aspect ratio
   - `TUBE_DIFFUSE_COORD` - Diffuse texture coordinates
   - `SCREEN_COORD` - Screen space coordinates
   - `BEZEL_MASK` - Bezel visibility

2. **Verify each transformation**:
   ```javascript
   // Add debug logging in the converter
   console.log(`[DualStage] Converting ${varName}:`);
   console.log(`  Vertex: assignments ${vertexAssignCount}, reads ${vertexReadCount}`);
   console.log(`  Fragment: assignments ${fragAssignCount}, reads ${fragReadCount}`);
   ```

3. **Check browser console** for:
   - Compilation success messages
   - No "undeclared identifier" errors
   - No "can't modify an input" errors

## Expected Outcome

When implemented correctly:
1. ✅ Dual-stage variables will work properly
2. ✅ Visual shader effects will render (CRT curvature, bezels, reflections)
3. ✅ No WebGL compilation errors
4. ✅ Maintains the shader's original logic flow

## Edge Cases to Handle

1. **Nested assignments**: `TUBE_MASK = SCREEN_MASK = calculateMask()`
2. **Conditional assignments**: `if (condition) TUBE_MASK = value`
3. **Function parameters**: `doSomething(TUBE_MASK)`
4. **Struct members**: Variables that are part of structs
5. **Array elements**: `SOME_ARRAY[i] = value`

## Files to Modify

1. **Primary**: `src/shaders/GlobalToVaryingConverter.ts`
   - Add `processDualStageVariables()` method
   - Add `convertToVaryingOutput()` method
   - Add `addLocalVariableSystem()` method
   - Update main conversion logic

2. **No changes needed**: `src/shaders/SlangShaderCompiler.ts` (already integrated)

## Success Criteria

✅ Visual shader effects render properly
✅ Browser console shows successful compilation
✅ No regression in existing working shaders
✅ Performance remains acceptable

## Alternative Approach (If Above Fails)

If the local variable approach proves too complex, consider a "shadow variable" system:

```glsl
// Fragment shader
in float v_TUBE_MASK;
float TUBE_MASK_LOCAL = v_TUBE_MASK;
// Replace all TUBE_MASK references with TUBE_MASK_LOCAL
```

This requires more extensive regex replacement but might be simpler to implement.

## Complexity Estimate

- Core implementation: 2-3 hours
- Testing and refinement: 1-2 hours
- Edge case handling: 1 hour

Total: 4-6 hours for complete solution

## Final Note

The key insight is that dual-stage variables need THREE representations:
1. Varying output in vertex (v_NAME)
2. Varying input in fragment (v_NAME)
3. Local variable in fragment (NAME)

This preserves the original shader logic while conforming to WebGL's architectural constraints.