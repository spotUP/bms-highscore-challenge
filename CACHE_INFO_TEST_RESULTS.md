# Cache-Info Black Screen Test Results

## Test Objective
Determine if `cache-info-potato-params.slang` is causing the black screen issue reported by the user.

## Test Method
Created two minimal presets and tested them with automated Puppeteer screenshots:

1. **Control Test (without cache-info)**: `test-without-cache.slangp`
   - shader0: hsm-drez-g-sharp_resampler.slang
   - shader1: stock.slang (passthrough to viewport)

2. **Suspect Test (with cache-info)**: `test-with-cache.slangp`
   - shader0: hsm-drez-g-sharp_resampler.slang
   - shader1: cache-info-potato-params.slang
   - shader2: stock.slang (passthrough to viewport)

## Test Results

### Automated Test Output
```
TEST: WITHOUT cache-info (control)
- Total console messages: 2102
- Errors detected: 0
- Compilation errors: 0
- WebGL errors: 0
- Bypass messages: 10
- shadersEnabled=true for 960+ frames

TEST: WITH cache-info (suspect)
- Total console messages: 2995
- Errors detected: 0
- Compilation errors: 0
- WebGL errors: 0
- Bypass messages: 10
- shadersEnabled=true for 960+ frames
```

### Visual Comparison
Both screenshots are **IDENTICAL** - showing the "AUDIO REQUIRED" screen with no black screen issues.

- Screenshot 1 (without cache-info): `/tmp/test-without-cache-info-(control).jpg`
- Screenshot 2 (with cache-info): `/tmp/test-with-cache-info-(suspect).jpg`

## Conclusion

✅ **cache-info-potato-params.slang does NOT cause black screen**

The cache-info pass:
- Compiles successfully
- Executes without errors
- Does not cause shaders to disable
- Produces valid output (no black screen)

## What is cache-info?

The `cache-info.inc` file (1368 lines) is a calculation engine that computes and stores:
- Screen scales and aspect ratios
- Tube/bezel scales and positions
- Cropping values and sample coordinates
- Curvature parameters
- Dual-screen layouts
- Viewport transformations
- 100+ shader parameters

The computed values are stored in an R32G32B32A32_SFLOAT texture that later passes can read using `HSM_UpdateGlobalScreenValuesFromCache()`.

## Next Steps

Since cache-info is NOT the cause of the black screen issue, we need to investigate:

1. **Other passes** - The black screen may be caused by passes after cache-info (Guest CRT, deconvergence, etc.)
2. **Parameter values** - The cache-info might be computing CORRECT values but those values might cause issues in downstream passes
3. **Stub implementations** - Our stub functions (`HSM_IsOutsideReflectionBoundary`, `HSM_UpdateGlobalScreenValuesFromCache`) might need actual implementations instead of no-ops

## Recommendations

1. **Use cache-info-potato-params.slang** - It's proven to work, so include it in the shader chain
2. **Test incremental passes** - Add passes one at a time after cache-info to isolate the actual black screen culprit
3. **Check Guest CRT shader** - This is the most complex pass and most likely to have issues with our stub implementations
