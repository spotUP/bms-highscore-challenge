# Mega Bezel Shader Controls

## Keyboard Controls

### S Key - Toggle Shaders On/Off
- **OFF**: Direct rendering (no shaders, best performance)
- **ON**: Shader post-processing enabled

### M Key - Toggle Shader Mode
- **Simple CRT**: Built-in scanlines, curvature, vignette (fast, always works)
- **Mega Bezel**: Full potato preset with 9-pass shader pipeline (advanced effects)

## Testing Instructions

### Step 1: Test Simple CRT (Current State)
1. Press **S** to enable shaders
2. You should see scanlines and curvature (already working!)
3. Press **S** again to disable

### Step 2: Test Mega Bezel Preset
1. Make sure shaders are enabled (press **S** if needed)
2. Press **M** to switch to Mega Bezel mode
3. Watch console for loading messages
4. Check for any errors or black screen

## What to Expect

### Simple CRT Mode (Default)
- Horizontal scanlines
- Subtle screen curvature
- Vignette (dark edges)
- Fast, lightweight

### Mega Bezel Mode (Full Preset)
- All of the above PLUS:
- Advanced CRT phosphor emulation
- Screen reflections
- Color grading
- Anti-aliasing (FXAA)
- Enhanced sharpening
- Multi-pass effects pipeline

## Troubleshooting

### Black Screen After Pressing M
- Check browser console for errors
- Shader compilation may have failed
- Press **S** to disable shaders (returns to working state)
- Press **M** again to switch back to Simple CRT

### Console Logs to Watch For

**Success**:
```
[MEGA BEZEL] FULL PRESET - Context will be recreated
[INIT] Preset: /shaders/mega-bezel/potato.slangp
[WebGL2DWithShaders] Loading shader preset
[PureWebGL2MultiPass] Loading preset
[PureWebGL2MultiPass] Preset has 9 passes
✅ Shader preset loaded successfully
```

**Errors**:
```
❌ Failed to load shader preset
❌ Multi-pass rendering failed
```

## Current Status

- ✅ Simple CRT: **WORKING**
- 🔄 Mega Bezel: **TESTING NOW**

## Performance

- Simple CRT: ~60 FPS (minimal overhead)
- Mega Bezel: May be slower due to 9 shader passes
  - If FPS drops, stick with Simple CRT mode

---

**Ready to test!** Press **M** while shaders are enabled (S key) to try the full Mega Bezel preset.
