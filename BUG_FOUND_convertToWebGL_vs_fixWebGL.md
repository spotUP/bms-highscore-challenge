# CRITICAL BUG FOUND - Parameters Lost Between convertToWebGL and fixWebGLIncompatibilities

## THE SMOKING GUN

Function parameters disappear BETWEEN these two method calls:

```javascript
// Line 141 in compile()
const fragmentShader = this.convertToWebGL(...); // Returns function WITH all 3 params

// Line 145 in compile()
const fixedFragment = this.fixWebGLIncompatibilities(fragmentShader); // Receives function with ONLY 1 param!
```

## Evidence

### Checkpoint 1-4 (Inside convertToWebGL): ALL PARAMETERS PRESENT ✅
```
[convertToWebGL CHECKPOINT 1] RIGHT AFTER global defs injection: float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
[convertToWebGL CHECKPOINT 2] BEFORE swizzle replacements: float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
[convertToWebGL CHECKPOINT 3] AFTER swizzle replacements: float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
[convertToWebGL CHECKPOINT 4] BEFORE return: float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
```

### Inside fixWebGLIncompatibilities: PARAMETERS MISSING ❌
```
[convertStorageQualifiers] Processing HHLP line: float HHLP_GetMaskCenteredOnValue(float in_value)
```

## The Mystery

There is NO CODE between these two method calls! The function leaves `convertToWebGL()` with all parameters, but arrives at `fixWebGLIncompatibilities()` with only 1 parameter.

## Possible Causes

1. **String encoding issue** - Unicode or special characters causing truncation
2. **Hidden transformation** - Some preprocessing we're not seeing
3. **Bug in logging** - Maybe the function IS corrupted earlier but our logging is wrong
4. **Multiple shader compilations** - Maybe we're seeing logs from DIFFERENT shader compilations mixed together

## Next Step

Add logging at the VERY START of `fixWebGLIncompatibilities()` (line 3611-3618) to see if the function arrives there with all parameters or not.

If it arrives with all parameters, the bug is in one of the early regex replacements.
If it arrives with only 1 parameter, then either:
- Our earlier logging was wrong
- OR there's string corruption happening during the function call/return

## Code Added

Already added logging at start of `fixWebGLIncompatibilities()` - restart server and test to see result.

## Test Command

```bash
killall -9 node && sleep 2 && npm run dev
sleep 12 && timeout 20s node -e "..." | grep "AT START OF METHOD"
```

This will show if the function has all parameters when entering fixWebGLIncompatibilities.
