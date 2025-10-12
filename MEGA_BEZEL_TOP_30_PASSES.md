# Mega Bezel - Top 30 Most Useful Shader Passes

**Status Key:**
- ✅ = Tested and working
- ❓ = Untested
- ❌ = Known compilation issues

---

## 🎯 CORE RENDERING (Essential)

### 1. hsm-drez-g-sharp_resampler.slang ✅
**Purpose**: De-resolution with G-sharp resampling
**What it does**: Reduces resolution before processing, then upscales with high quality
**Performance**: Medium
**Use case**: Essential first pass for performance optimization

### 2. hsm-fetch-drez-output.slang ✅
**Purpose**: Fetch derez output
**What it does**: Retrieves the de-rezed image for further processing
**Performance**: Fast
**Use case**: Required after drez pass

### 3. hsm-drez-none.slang ❓
**Purpose**: No de-resolution
**What it does**: Skips de-rez step, processes at full resolution
**Performance**: Slow (processes at native resolution)
**Use case**: When you want maximum quality and have GPU power

---

## 🖥️ CRT SIMULATION (Choose ONE)

### 4. hsm-crt-guest-advanced-potato.slang ❓
**Purpose**: Lightweight CRT simulation
**What it does**: Scanlines, phosphor glow, mask patterns (optimized)
**Performance**: Medium-Fast
**Use case**: Best balance of quality and performance

### 5. hsm-crt-guest-advanced.slang ❓
**Purpose**: Full quality CRT simulation
**What it does**: Complete CRT emulation with all effects
**Performance**: Medium-Slow
**Use case**: When you want maximum CRT accuracy

### 6. hsm-crt-dariusg-gdv-mini-potato.slang ❓
**Purpose**: Alternative CRT engine (DariusG)
**What it does**: Different CRT algorithm, unique look
**Performance**: Medium-Fast
**Use case**: If you prefer DariusG's CRT style

### 7. crt-sony-megatron-potato.slang ❓
**Purpose**: Sony Trinitron CRT emulation
**What it does**: Accurate Trinitron phosphor and mask simulation
**Performance**: Medium
**Use case**: For authentic Sony CRT look

### 8. hsm-lcd-grid-v2-potato.slang ❓
**Purpose**: LCD/handheld simulation
**What it does**: LCD grid and pixel structure
**Performance**: Fast
**Use case**: For Game Boy, GBA, PSP style displays

---

## 🎨 IMAGE ENHANCEMENT

### 9. fxaa.slang ✅
**Purpose**: Anti-aliasing
**What it does**: Removes jaggies and shimmering
**Performance**: Fast
**Use case**: Always recommended for smoother image

### 10. hsm-custom-fast-sharpen.slang ❌
**Purpose**: Image sharpening
**What it does**: Enhances edge definition
**Performance**: Fast
**Use case**: Make image crisper (currently blocked by macro issue)

### 11. hsm-grade.slang ❓
**Purpose**: Color grading
**What it does**: Professional color correction (hue, saturation, contrast)
**Performance**: Fast
**Use case**: Fine-tune color balance

---

## ✨ VISUAL EFFECTS

### 12. reflection.slang ❌
**Purpose**: Screen reflection effect
**What it does**: Creates realistic bezel reflection of screen content
**Performance**: Medium
**Use case**: THE MAIN EFFECT YOU WANT (currently blocked)

### 13. hsm-bloom_horizontal.slang ❓
**Purpose**: Horizontal bloom pass
**What it does**: Light bleeding/glow (horizontal)
**Performance**: Medium
**Use case**: Combine with vertical for full bloom

### 14. hsm-bloom_vertical.slang ❓
**Purpose**: Vertical bloom pass
**What it does**: Light bleeding/glow (vertical)
**Performance**: Medium
**Use case**: Combine with horizontal for full bloom

### 15. hsm-afterglow0.slang ❓
**Purpose**: Phosphor persistence
**What it does**: CRT trail/ghosting effect
**Performance**: Medium
**Use case**: Authentic CRT motion blur

### 16. hsm-deconvergence-potato.slang ❓
**Purpose**: RGB separation effect
**What it does**: Mimics CRT color fringing at edges
**Performance**: Fast
**Use case**: Adds authenticity to CRT simulation

---

## 🖼️ BEZEL & FRAME

### 17. bezel-images-over-crt.slang ❓
**Purpose**: Bezel overlay
**What it does**: Draws decorative frame/bezel on top of screen
**Performance**: Fast
**Use case**: Add arcade cabinet bezel artwork

### 18. bezel-images-under-crt.slang ❓
**Purpose**: Bezel underlay
**What it does**: Draws bezel behind screen
**Performance**: Fast
**Use case**: Different layering approach for bezels

---

## 🔄 COLOR SPACE

### 19. linearize.slang ❌
**Purpose**: Gamma correction (sRGB → Linear)
**What it does**: Converts to linear color space for proper blending
**Performance**: Fast
**Use case**: Essential for accurate color math (currently blocked)

### 20. delinearize.slang ❓
**Purpose**: Gamma correction (Linear → sRGB)
**What it does**: Converts back to gamma-encoded for display
**Performance**: Fast
**Use case**: Final stage after linear color processing

---

## 🎮 RETRO EFFECTS

### 21. hsm-ntsc-pass1.slang ❓
**Purpose**: NTSC artifacts (pass 1)
**What it does**: Composite video artifacts (color bleeding)
**Performance**: Medium
**Use case**: Authentic NTSC console look

### 22. hsm-ntsc-pass2.slang ❓
**Purpose**: NTSC artifacts (pass 2)
**What it does**: Dot crawl and color fringing
**Performance**: Medium
**Use case**: Complete NTSC effect (use after pass1)

### 23. hsm-interlace.slang ❓
**Purpose**: Interlacing effect
**What it does**: CRT interlace scanline flicker
**Performance**: Fast
**Use case**: Authentic CRT temporal artifacts

### 24. checkerboard-dedither-pass1.slang ❓
**Purpose**: Dithering removal
**What it does**: Removes dithering patterns from old games
**Performance**: Medium
**Use case**: Clean up dithered graphics (needs all 3 passes)

---

## 🔧 SCALING & UPSCALING

### 25. hsm-screen-scale-g-sharp_resampler-potato.slang ❓
**Purpose**: Final screen scaling
**What it does**: Upscales to viewport with CRT effects applied
**Performance**: Medium
**Use case**: Essential final pass after CRT simulation

### 26. super-xbr-pass0.slang ❓
**Purpose**: Super-xBR upscaling (part 1 of 3)
**What it does**: Advanced edge-directed upscaling
**Performance**: Slow
**Use case**: High-quality pixel art upscaling

### 27. hsm-scalefx-pass0.slang ❓
**Purpose**: ScaleFX upscaling (part 1 of 5)
**What it does**: Pixel art scaling algorithm
**Performance**: Medium-Slow
**Use case**: Alternative to super-xBR

---

## 🎬 OUTPUT & COMPOSITING

### 28. post-crt-prep-potato.slang ❓
**Purpose**: Post-CRT preparation
**What it does**: Prepares CRT output for final compositing
**Performance**: Fast
**Use case**: Use before reflection/bezel passes

### 29. combine-passes.slang ❓
**Purpose**: Multi-pass combination
**What it does**: Merges multiple render passes into final image
**Performance**: Fast
**Use case**: Final compositing stage

### 30. output-sdr.slang ❓
**Purpose**: SDR output
**What it does**: Final color output for standard displays
**Performance**: Fast
**Use case**: Last pass in chain

---

## 🎯 RECOMMENDED PRESET CHAINS

### Minimal (Fast)
```
1. hsm-drez-g-sharp_resampler.slang ✅
2. hsm-fetch-drez-output.slang ✅
3. fxaa.slang ✅
```
**Status**: All working!

### Quality CRT (Medium)
```
1. hsm-drez-g-sharp_resampler.slang ✅
2. hsm-fetch-drez-output.slang ✅
3. fxaa.slang ✅
4. hsm-crt-guest-advanced-potato.slang ❓
5. hsm-screen-scale-g-sharp_resampler-potato.slang ❓
```

### CRT + Reflection (Your Goal)
```
1. hsm-drez-g-sharp_resampler.slang ✅
2. hsm-fetch-drez-output.slang ✅
3. fxaa.slang ✅
4. hsm-crt-guest-advanced-potato.slang ❓
5. reflection.slang ❌ (BLOCKED)
6. post-crt-prep-potato.slang ❓
```

### Full Quality (Slow)
```
1. hsm-drez-g-sharp_resampler.slang ✅
2. hsm-fetch-drez-output.slang ✅
3. fxaa.slang ✅
4. hsm-grade.slang ❓ (color correction)
5. hsm-bloom_horizontal.slang ❓
6. hsm-bloom_vertical.slang ❓
7. hsm-crt-guest-advanced.slang ❓ (full quality CRT)
8. reflection.slang ❌ (BLOCKED)
9. bezel-images-over-crt.slang ❓
10. output-sdr.slang ❓
```

---

## 📊 TESTING PRIORITY

If you want me to test more passes, here's the priority order:

**High Priority** (Most likely to work):
1. hsm-crt-guest-advanced-potato.slang - Main CRT effect
2. hsm-screen-scale-g-sharp_resampler-potato.slang - Final scaling
3. post-crt-prep-potato.slang - Prep for effects
4. hsm-grade.slang - Color grading
5. hsm-bloom_horizontal/vertical.slang - Glow effects

**Medium Priority** (May have issues):
6. bezel-images-over-crt.slang - Bezel overlay
7. hsm-afterglow0.slang - Phosphor trails
8. hsm-deconvergence-potato.slang - RGB fringing
9. hsm-interlace.slang - Interlacing

**Low Priority** (Complex/Slow):
10. super-xbr-pass0/1/2.slang - Advanced upscaling
11. hsm-ntsc-pass1/2.slang - NTSC effects

**Blocked** (Need fixes):
- reflection.slang ❌ - Function body parsing issue
- linearize.slang ❌ - Fragment shader function issue
- hsm-custom-fast-sharpen.slang ❌ - Macro redefinition

---

## 🔍 WHAT TO TEST NEXT

Pick any of these and I'll create a preset and test it:

1. **CRT Only** - Just add CRT simulation to working passes
2. **CRT + Bloom** - Add glow effects
3. **CRT + Bezel** - Add decorative frames
4. **Full Chain** - Try entire recommended pipeline
5. **Fix Reflection** - Debug and fix reflection.slang (10-20 hours estimated)

Which would you like me to try?

