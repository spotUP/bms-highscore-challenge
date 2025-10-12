# Mega Bezel Shader Catalog - Complete Pass Reference

**Status Key:**
- ✅ = Tested and working
- ❓ = Untested
- ❌ = Known to fail compilation

---

## 🎯 CORE CRT SIMULATION

### Guest.r Advanced CRT
The main CRT simulation engine - creates scanlines, phosphor glow, mask patterns.

- `hsm-crt-guest-advanced.slang` ❓ - Full CRT simulation (standard)
- `hsm-crt-guest-advanced-no-reflect.slang` ❓ - CRT without reflection support
- `hsm-crt-guest-advanced-potato.slang` ❓ - Lightweight CRT for performance
- `hsm-crt-guest-advanced-ntsc-pass1.slang` ❓ - CRT with NTSC artifacts (pass 1)
- `hsm-crt-guest-advanced-ntsc-pass2.slang` ❓ - CRT with NTSC artifacts (pass 2)
- `hsm-crt-guest-advanced-ntsc-pass2-potato.slang` ❓ - Lightweight NTSC CRT

### Guest DariusG GDV Mini
Alternative CRT simulation with different characteristics.

- `hsm-crt-dariusg-gdv-mini.slang` ❓ - Full version
- `hsm-crt-dariusg-gdv-mini-potato.slang` ❓ - Lightweight version

### Sony Megatron CRT
Accurate Sony Trinitron CRT simulation.

- `crt-sony-megatron.slang` ❓ - Full Megatron CRT
- `crt-sony-megatron-no-reflect.slang` ❓ - Without reflections
- `crt-sony-megatron-potato.slang` ❓ - Lightweight version
- `crt-sony-megatron-source-pass.slang` ❓ - Source preparation pass
- `crt-sony-megatron-hdr-pass.slang` ❓ - HDR output support

### LCD/GBA Simulation
For handheld console effects.

- `hsm-lcd-grid-v2.slang` ❓ - LCD grid effect
- `hsm-lcd-grid-v2-no-reflect.slang` ❓ - LCD without reflections
- `hsm-lcd-grid-v2-potato.slang` ❓ - Lightweight LCD
- `hsm-gba-color.slang` ❓ - Game Boy Advance color correction

### EasyMode CRT
Simpler, faster CRT simulation.

- `hsm-crt-easymode-threshold.slang` ❓ - Brightness threshold
- `hsm-crt-easymode-halation.slang` ❓ - Glow/halation effect
- `hsm-crt-easymode-blur_horiz.slang` ❓ - Horizontal blur
- `hsm-crt-easymode-blur_vert.slang` ❓ - Vertical blur
- `hsm-crt-easymode-halation-basic-border.slang` ❓ - With border halation

---

## 🔧 PREPROCESSING & SCALING

### Resolution Handling (De-rez)
Reduces resolution before processing for performance, then upscales with quality.

- `hsm-drez-g-sharp_resampler.slang` ✅ **WORKING** - G-sharp resampling (high quality)
- `hsm-drez-none.slang` ❓ - No de-rez (full resolution processing)
- `hsm-drez-b-spline-x.slang` ❓ - B-spline horizontal
- `hsm-drez-b-spline-y.slang` ❓ - B-spline vertical
- `hsm-fetch-drez-output.slang` ✅ **WORKING** - Fetches de-rez output

### Screen Scaling
Final upscaling to viewport with CRT effects.

- `hsm-screen-scale-g-sharp_resampler.slang` ❓ - Full quality scaling
- `hsm-screen-scale-g-sharp_resampler-no-reflect.slang` ❓ - Without reflections
- `hsm-screen-scale-g-sharp_resampler-potato.slang` ❓ - Lightweight scaling

### Other Resamplers
- `hsm-g-sharp_resampler.slang` ❓ - Standalone G-sharp resampler
- `hsm-sharpsmoother.slang` ❓ - Sharp smoothing filter

---

## 🎨 IMAGE ENHANCEMENT

### Sharpening
- `hsm-custom-fast-sharpen.slang` ❓ - Fast sharpening filter
- `hsm-custom-fast-sharpen-ntsc.slang` ❓ - Sharpening for NTSC
- `custom-resolve.slang` ❓ - Super-xbr resolve pass

### Anti-Aliasing
- `fxaa.slang` ❓ - Fast Approximate Anti-Aliasing (removes jaggies)

### Color Correction
- `hsm-grade.slang` ❓ - Professional color grading
- `grade_orig.slang` ❓ - Original color grading

### Blur Effects
- `blur-outside-screen-horiz.slang` ❓ - Blur outside screen (horizontal)
- `blur-outside-screen-vert.slang` ❓ - Blur outside screen (vertical)
- `hsm-gaussian_horizontal.slang` ❓ - Gaussian blur horizontal
- `hsm-gaussian_vertical.slang` ❓ - Gaussian blur vertical

---

## 🌟 SPECIAL EFFECTS

### Reflection System **⭐ YOU WANT THIS**
Creates realistic screen reflections (bezel reflecting game image).

- `reflection.slang` ❓ **TARGET** - Standard reflection
- `reflection-glass.slang` ❓ - Glass-style reflection
- `reflection-glass-hdr.slang` ❓ - HDR glass reflection

### Bloom & Glow
Adds light bleeding and glow around bright areas.

- `hsm-bloom_horizontal.slang` ❓ - Horizontal bloom pass
- `hsm-bloom_vertical.slang` ❓ - Vertical bloom pass
- `hsm-avg-lum.slang` ❓ - Average luminance calculation

### Afterglow & Persistence
Phosphor persistence (CRT trails).

- `hsm-afterglow0.slang` ❓ - Afterglow effect
- `hsm-pre-shaders-afterglow.slang` ❓ - Pre-shader afterglow
- `phosphor-persistence.slang` ❓ - Phosphor trail persistence

### Deconvergence
RGB separation effect (mimics CRT color fringing).

- `hsm-deconvergence.slang` ❓ - Standard deconvergence
- `hsm-deconvergence-no-reflect.slang` ❓ - Without reflections
- `hsm-deconvergence-potato.slang` ❓ - Lightweight version
- `hsm-deconvergence-ntsc_orig.slang` ❓ - NTSC variant

---

## 🖼️ BEZEL & FRAME

### Bezel Image Layers
Adds decorative bezels/frames around the screen.

- `bezel-images-over-crt.slang` ❓ - Bezel drawn over CRT
- `bezel-images-under-crt.slang` ❓ - Bezel drawn under CRT

### Text Overlays
On-screen text/info display.

- `text-std.slang` ❓ - Standard text
- `text-std-glass.slang` ❓ - Text for glass preset
- `text-std-no-reflect.slang` ❓ - Text without reflections
- `text-adv.slang` ❓ - Advanced text
- `text-adv-glass.slang` ❓ - Advanced text for glass
- `text-adv-no-reflect.slang` ❓ - Advanced text without reflections
- `text-potato.slang` ❓ - Lightweight text

---

## 🔄 COLOR SPACE & GAMMA

### Linearization (sRGB → Linear)
Converts from gamma-encoded sRGB to linear color space for proper blending.

- `linearize.slang` ❌ **BLOCKED** - Standard linearization (fragment shader issue)
- `linearize-crt.slang` ❓ - Linearize for CRT pass
- `linearize-crt-hdr.slang` ❓ - Linearize for HDR
- `hsm-linearize_orig.slang` ❓ - Original Guest.r linearize
- `hsm-linearize-ntsc_orig.slang` ❓ - NTSC linearization
- `hsm-interlace-and-linearize.slang` ❓ - Combined interlace + linearize

### Delinearization (Linear → sRGB)
Converts back to gamma-encoded sRGB for display.

- `delinearize.slang` ❓ - Standard delinearization

---

## 🎬 FINAL OUTPUT & COMPOSITING

### Post-CRT Preparation
Prepares CRT output for final compositing.

- `post-crt-prep.slang` ❓ - Standard post-CRT prep
- `post-crt-prep-potato.slang` ❓ - Lightweight version
- `post-crt-prep-potato-megatron.slang` ❓ - Megatron variant
- `post-crt-prep-no-reflect.slang` ❓ - Without reflections
- `post-crt-prep-glass.slang` ❓ - Glass preset
- `post-crt-prep-image-layers.slang` ❓ - With image layers
- `post-crt-prep-minimum-std.slang` ❓ - Minimal standard
- `post-crt-prep-minimum-glass.slang` ❓ - Minimal glass
- `post-crt-prep-minimum-no-reflect.slang` ❓ - Minimal no-reflect

### Combine Passes
Merges multiple render passes into final image.

- `combine-passes.slang` ❓ - Standard combine
- `combine-passes-hdr.slang` ❓ - HDR combine
- `combine-passes-no-reflect.slang` ❓ - Without reflections
- `combine-passes-no-reflect-hdr.slang` ❓ - No-reflect HDR

### Output
Final screen output.

- `output-sdr.slang` ❓ - Standard Dynamic Range output
- `output-hdr.slang` ❓ - High Dynamic Range output
- `hdr10.slang` ❓ - HDR10 format
- `inverse_tonemap.slang` ❓ - HDR tone mapping

---

## 📊 CACHE & PARAMETERS

### Info Cache
Caches shader parameters and screen info for performance.

- `cache-info-potato-params.slang` ❌ **BLOCKED** - Lightweight (100+ undeclared identifiers)
- `cache-info-all-params.slang` ❓ - Full parameter set
- `cache-info-glass-params.slang` ❓ - Glass preset params
- `cache-info-no-reflect-params.slang` ❓ - No-reflect params
- `cache-info-screen-scale-params.slang` ❓ - Screen scale params

### Parameter Addition
Adds parameter blocks for different preset levels.

- `add-params-potato.slang` ❓ - Lightweight params
- `add-params-all.slang` ❓ - Full params
- `add-params-glass.slang` ❓ - Glass params
- `add-params-no-reflect.slang` ❓ - No-reflect params

---

## 🎮 RETRO CONSOLE EFFECTS

### NTSC Artifacts
Simulates NTSC composite video artifacts (color bleeding, dot crawl).

- `hsm-ntsc-pass1.slang` ❓ - NTSC pass 1
- `hsm-ntsc-pass2.slang` ❓ - NTSC pass 2
- `hsm-ntsc-pass3.slang` ❓ - NTSC pass 3

### Interlacing
CRT interlacing effects.

- `hsm-interlace.slang` ❓ - Interlacing effect
- `hsm-interlace-and-linearize.slang` ❓ - Combined with linearization

### Dithering Removal
Removes dithering patterns from old games.

- `checkerboard-dedither-pass1.slang` ❓ - Dedither pass 1
- `checkerboard-dedither-pass2.slang` ❓ - Dedither pass 2
- `checkerboard-dedither-pass3.slang` ❓ - Dedither pass 3
- `hsm-PS1-Undither-BoxBlur.slang` ❓ - PlayStation 1 undithering

### Edge Detection & Smoothing
- `hsm-mdapt-pass0.slang` through `hsm-mdapt-pass4.slang` ❓ - MDAPT edge-directed smoothing (5 passes)

---

## 🔬 UPSCALING ALGORITHMS

### Super-xBR
Advanced edge-directed upscaling.

- `super-xbr-pass0.slang` through `super-xbr-pass2.slang` ❓ - Super-xBR algorithm (3 passes)
- `custom-bicubic-x.slang` ❓ - Bicubic horizontal
- `custom-bicubic-y.slang` ❓ - Bicubic vertical
- `threshold.slang` ❓ - Edge threshold

### ScaleFX
Pixel art upscaling.

- `hsm-scalefx-pass0.slang` through `hsm-scalefx-pass4.slang` ❓ - ScaleFX algorithm (5 passes)
- `hsm-scalefx-pass4-hybrid.slang` ❓ - Hybrid variant

### SGENPT-Mix
Another pixel art scaler.

- `sgenpt-mix-pass1.slang` through `sgenpt-mix-pass5.slang` ❓ - SGENPT-Mix (5 passes)

### GTU
Alternative CRT upscaling.

- `hsm-gtu-pass1.slang` ❓ - GTU pass 1
- `hsm-gtu-pass2.slang` ❓ - GTU pass 2

### NewPixie
Unique CRT simulation approach.

- `hsm-newpixie-crt.slang` ❓ - NewPixie CRT
- `hsm-newpixie-accumulate.slang` ❓ - Accumulation pass
- `hsm-newpixie-blur-horiz.slang` ❓ - Horizontal blur
- `hsm-newpixie-blur-vert.slang` ❓ - Vertical blur

---

## 🛠️ UTILITY & SPECIAL

### Intro Screens
Mega Bezel branding/intro.

- `intro.slang` ❓ - Standard intro
- `intro-potato.slang` ❓ - Lightweight intro

### Crop & Border
- `add-negative-crop-area.slang` ❓ - Adds negative crop space

### Dedither/Gamma Prep
- `dedither-gamma-prep-1-before.slang` ❓ - Pre-dedither gamma
- `dedither-gamma-prep-2-after.slang` ❓ - Post-dedither gamma

### Testing & Debug
- `test-passthrough.slang` ❓ - Pass-through test
- `test-red.slang` ❓ - Solid red test
- `test-sample.slang` ❓ - Sample test
- `debug-solid-red.slang` ❓ - Debug red screen
- `stock.slang` ❓ - Stock/basic shader

---

## 🎯 RECOMMENDED PRESETS FOR YOUR NEEDS

### Option 1: Minimal Reflection (Simplest)
```
Pass 0: hsm-drez-g-sharp_resampler.slang ✅ WORKING
Pass 1: hsm-fetch-drez-output.slang ✅ WORKING
Pass 2: reflection.slang ❓ TEST THIS
```

### Option 2: Quality Reflection Chain
```
Pass 0: hsm-drez-g-sharp_resampler.slang ✅ WORKING
Pass 1: hsm-fetch-drez-output.slang ✅ WORKING
Pass 2: fxaa.slang ❓ (anti-aliasing)
Pass 3: hsm-custom-fast-sharpen.slang ❓ (sharpening)
Pass 4: reflection.slang ❓ (reflection)
Pass 5: post-crt-prep-potato.slang ❓ (final output)
```

### Option 3: Full CRT + Reflection
```
Pass 0: hsm-drez-g-sharp_resampler.slang ✅ WORKING
Pass 1: hsm-fetch-drez-output.slang ✅ WORKING
Pass 2: hsm-crt-guest-advanced-potato.slang ❓ (CRT simulation)
Pass 3: reflection.slang ❓ (reflection)
Pass 4: post-crt-prep-potato.slang ❓ (final output)
```

---

## 📝 SELECTION GUIDE

**Start with these passes:**
1. ✅ `hsm-drez-g-sharp_resampler.slang` (already working)
2. ✅ `hsm-fetch-drez-output.slang` (already working)
3. ❓ `reflection.slang` **← YOUR MAIN TARGET**

**Then optionally add:**
- `fxaa.slang` - If you want anti-aliasing
- `hsm-custom-fast-sharpen.slang` - If you want sharper image
- `hsm-grade.slang` - If you want color correction
- `hsm-bloom_horizontal.slang` + `hsm-bloom_vertical.slang` - If you want glow
- `post-crt-prep-potato.slang` - For final output preparation

---

**Which passes would you like to try?** I can create a custom preset with your selections.

