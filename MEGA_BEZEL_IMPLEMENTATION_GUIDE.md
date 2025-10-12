# Mega Bezel Shader Implementation Guide - Priority Order

## Overview
This guide provides a step-by-step implementation strategy for Mega Bezel shader passes, prioritized by visual impact. We'll focus on the most visible elements first to achieve a working bezel display quickly, then add refinements.

## Priority Tiers

### 🔴 TIER 1 - CRITICAL (Most Visible - Implement First)
These passes create the core visual experience - without them, you won't see the bezel at all.

### 🟡 TIER 2 - IMPORTANT (Highly Visible - Implement Second)
These passes significantly enhance the visual quality and create the "premium CRT monitor" look.

### 🟢 TIER 3 - REFINEMENTS (Subtle - Implement Last)
These passes add polish but aren't immediately noticeable to most users.

---

## 🔴 TIER 1 - CRITICAL PASSES (Days 1-3)

### 1. **bezel-and-image-layers.slang** (Pass 15)
**Visual Impact: 100% - THE BEZEL FRAME**
- **What it does**: Renders the actual monitor bezel/frame graphic
- **Why critical**: Without this, there's no visible frame at all
- **Implementation Steps**:
  1. Fix PassFeedback sampler declaration issues
  2. Fix float/int type comparisons (add explicit casts)
  3. Ensure all MASK_MODE_*, CUTOUT_MODE_*, FOLLOW_LAYER_* constants are defined
  4. Add texture samplers for bezel images (BR_MirrorLED, BackgroundImage, etc.)
  5. Implement HSM_GetBezelCoords() function
  6. Test with a simple bezel PNG texture

### 2. **cache-info-all-params.slang** (Pass 1)
**Visual Impact: 90% - COORDINATES & SCALING**
- **What it does**: Calculates screen geometry, bezel coordinates, tube curves
- **Why critical**: Bezel won't align with screen without proper coordinates
- **Implementation Steps**:
  1. Ensure all HSM parameters are available as uniforms
  2. Implement coordinate calculation functions
  3. Store calculated values in InfoCachePass texture
  4. Verify coordinate data can be read by subsequent passes

### 3. **br-layers-under-crt.slang** (Pass 33)
**Visual Impact: 85% - BACKGROUND & UNDER-LAYERS**
- **What it does**: Renders background images and layers behind the CRT screen
- **Why critical**: Creates depth - the CRT screen appears "inside" the monitor
- **Implementation Steps**:
  1. Read coordinate data from InfoCachePass
  2. Sample and blend background textures
  3. Apply proper layer ordering (background → device → decal)
  4. Implement layer opacity and blend modes

---

## 🟡 TIER 2 - IMPORTANT PASSES (Days 4-7)

### 4. **reflection.slang** (Pass 34)
**Visual Impact: 80% - SCREEN REFLECTIONS**
- **What it does**: Creates realistic reflections on the screen glass
- **Why important**: Major "wow factor" - makes it look like real glass
- **Implementation Steps**:
  1. Sample the game screen texture
  2. Apply blur based on distance from screen
  3. Implement reflection mask (where reflections appear)
  4. Add environment mapping for realistic reflections
  5. Blend with appropriate opacity (usually 10-30%)

### 5. **linearize-crt.slang** (Pass 26)
**Visual Impact: 70% - REFLECTION PREP**
- **What it does**: Prepares CRT image for reflection processing
- **Why important**: Makes reflections look physically correct
- **Implementation Steps**:
  1. Convert CRT output to linear color space
  2. Apply gamma correction
  3. Prepare for blur passes

### 6. **blur-outside-tube-vert.slang** / **blur-outside-tube-horiz.slang** (Passes 27-28)
**Visual Impact: 65% - REFLECTION BLUR**
- **What it does**: Creates depth-of-field effect for reflections
- **Why important**: Reflections look unrealistic without proper blur
- **Implementation Steps**:
  1. Implement separable Gaussian blur
  2. Apply vertical blur first, then horizontal
  3. Use tube mask to only blur outside screen area
  4. Vary blur strength based on distance from tube

### 7. **br-layers-over-crt.slang** (Pass 35)
**Visual Impact: 60% - TOP LAYERS**
- **What it does**: Renders overlays like LED lights, glass reflections, decals
- **Why important**: Adds final "physical" details to the monitor
- **Implementation Steps**:
  1. Sample LED texture for power indicator
  2. Add glass/cabinet overlay effects
  3. Implement proper blend modes for each layer
  4. Apply opacity masks

---

## 🟢 TIER 3 - REFINEMENTS (Days 8-10)

### 8. **hsm-drez-g-sharp_resampler.slang** (Pass 0)
**Visual Impact: 40% - RESOLUTION HANDLING**
- **What it does**: Intelligent downsampling for pixel-perfect scaling
- **Why subtle**: Only noticeable with integer scaling issues
- **Implementation**: Basic bilinear sampling is often sufficient

### 9. **interlace-and-linearize.slang** (Pass 2)
**Visual Impact: 30% - INTERLACING**
- **What it does**: Simulates interlaced video
- **Why subtle**: Most content isn't interlaced
- **Implementation**: Can skip initially

### 10. **color-correction.slang** (Pass 24)
**Visual Impact: 25% - COLOR GRADING**
- **What it does**: Fine-tunes colors
- **Why subtle**: Minor adjustments
- **Implementation**: Simple color matrix multiplication

### 11. **do-nothing.slang** (Pass 3, 31-32)
**Visual Impact: 0% - UTILITY**
- **What it does**: Data unpacking, format conversion
- **Implementation**: Simple passthrough with format change

---

## Implementation Order Strategy

### Week 1: Get Basic Bezel Working
1. **Day 1**: Fix bezel-and-image-layers.slang compilation errors
2. **Day 2**: Implement cache-info-all-params.slang coordinate system
3. **Day 3**: Get basic bezel rendering with proper alignment

### Week 2: Add Visual Polish
4. **Day 4**: Implement reflection.slang for glass effect
5. **Day 5**: Add blur passes for reflection depth
6. **Day 6**: Implement under/over CRT layers
7. **Day 7**: Testing and optimization

### Week 3: Refinements (Optional)
8. **Days 8-10**: Add remaining passes based on performance budget

---

## Testing Checkpoints

### After Tier 1:
✓ Bezel frame visible around game screen
✓ Frame properly aligned with screen content
✓ Basic background visible behind monitor

### After Tier 2:
✓ Glass reflections visible on screen
✓ Reflections have proper blur/depth
✓ LED lights and overlays rendering
✓ Monitor looks like physical CRT

### After Tier 3:
✓ Perfect pixel scaling
✓ Color accuracy
✓ All effects properly integrated

---

## Performance Optimization Tips

1. **Start with lower resolution** for InfoCachePass (256x256 instead of 800x600)
2. **Disable unused layers** in bezel shader (TopImage, DecalImage if not needed)
3. **Reduce blur passes** - use 5-tap instead of 9-tap Gaussian
4. **Skip interlacing** if not needed for your content
5. **Use simpler reflection** - environment map instead of full scene reflection

---

## Common Implementation Pitfalls

1. **Wrong coordinate spaces** - Ensure all passes use same coordinate system
2. **Missing texture samplers** - Each layer needs its sampler defined
3. **Float/int mismatches** - WebGL is strict about types
4. **PassFeedback loops** - Ensure proper texture binding order
5. **Alpha blending order** - Render back-to-front for proper transparency

---

## Minimal Viable Product (MVP)

If you need something working FAST, implement only:
1. cache-info-all-params.slang (coordinates)
2. bezel-and-image-layers.slang (the frame)
3. Simple reflection.slang (basic glass effect)

This gives you 80% of the visual impact with 20% of the work.

---

## Debugging Tools

Create these helper functions for debugging:
```glsl
// Visualize coordinates as colors
vec3 debugCoords(vec2 coord) {
    return vec3(coord.x, coord.y, 0.5);
}

// Show texture sampling areas
vec3 debugMask(float mask) {
    return vec3(mask, mask * 0.5, 1.0 - mask);
}

// Verify InfoCachePass data
vec3 debugCache(sampler2D cache, vec2 coord) {
    vec4 data = texture(cache, coord);
    return data.rgb; // Visualize as color
}
```

---

## Success Metrics

You know implementation is working when:
1. ✅ Bezel frame appears at correct size/position
2. ✅ Game screen fits properly within bezel opening
3. ✅ Reflections appear on screen surface only
4. ✅ Background layers show proper depth
5. ✅ No z-fighting or render order issues
6. ✅ Performance remains above 60 FPS

---

## Quick Start Commands

```bash
# Test basic bezel
npm run dev
open http://localhost:8080/404

# Check shader compilation
grep "ERROR:" console.log

# Monitor performance
# In browser console:
performance.mark('frame-start');
// ... render ...
performance.mark('frame-end');
performance.measure('frame', 'frame-start', 'frame-end');
```

---

## Final Notes

- **Focus on Tier 1 first** - Get something visible before optimizing
- **Test incrementally** - Add one pass at a time
- **Use simple textures** initially - Complex graphics can come later
- **Profile early** - Know your performance budget
- **Document shader modifications** - You'll need to maintain this

The goal is to have a working bezel with reflections in 3-5 days, with polish added over the following week.