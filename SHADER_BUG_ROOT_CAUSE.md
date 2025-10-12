# Mega Bezel "Invisible Shader" Bug - Root Cause Analysis

## Summary

The Mega Bezel CRT shaders compile and execute without errors, but produce output **identical** to the input (passthrough behavior). This makes the game appear unshaded even though shaders are active.

## Root Cause

**All Mega Bezel shaders have bypass logic that checks parameter values. When parameters are missing or set to 0, shaders default to passthrough mode.**

### Evidence

1. **Pixel Analysis**: Before and after shader application show identical RGB values
   - Before: `rgb(28, 11, 61)`  
   - After: `rgb(28, 11, 61)`
   - Difference: 0 (should be > 5 for working shaders)

2. **Shader Source Code** (`hsm-custom-fast-sharpen.slang:93-97`):
   ```glsl
   if ( SHARPEN_ON < 0.5 )  // Parameter defaults to 0
   {
       FragColor = texture(Source, vTexCoord);  // PASSTHROUGH!
       return;
   }
   ```

3. **All 7 passes bypass**: FXAA, sharpen, grade, derez, fetch, etc. - every shader has similar bypass checks

## The Fix

### Step 1: Parse Parameters from Preset ✅ DONE

Modified `PureWebGL2MultiPassRenderer.ts:130-184` to extract parameters from `.slangp` files:

```typescript
// Parse parameters - any line with "key = value" pattern
for (const line of lines) {
  const paramMatch = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*([0-9.]+)/);
  if (paramMatch) {
    parameters[paramMatch[1]] = parseFloat(paramMatch[2]);
  }
}
```

### Step 2: Pass Parameters to Shaders ✅ DONE  

Modified render method to merge preset parameters with frame uniforms:

```typescript
this.renderer.executePass(
  passName,
  { Source: currentInput },
  outputTarget,
  { ...this.presetParameters, FrameCount: this.frameCount }  // Merge parameters!
);
```

### Step 3: Verify Parameters Reach Shaders ⏳ IN PROGRESS

Need to confirm parameters are:
1. Being parsed from `.slangp` file
2. Passed to `executePass()` 
3. Set as uniforms in the shader program

## Expected Outcome

Once parameters are correctly passed, shader bypass conditions will evaluate to false and effects will apply:

```glsl
// With SHARPEN_ON = 1 from preset:
if ( SHARPEN_ON < 0.5 )  // 1 < 0.5 = false!
{
    // Bypass NOT taken
}
// Sharpen logic executes instead
```

## Testing

To verify the fix works:
1. Check console for `[PresetParser] Parameter: SHARPEN_ON = 1`
2. Check for RGB difference: Before ≠ After
3. Visual confirmation: game should have visible shader effects

## Files Modified

- `/src/shaders/PureWebGL2MultiPassRenderer.ts` - Parameter parsing and passing
- `/public/shaders/mega-bezel/potato-working-7-pass-no-linearize.slangp` - Enable effects
