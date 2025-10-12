#version 450

layout(push_constant) uniform Push {
    vec4 SourceSize;
    vec4 OutputSize;
    uint FrameCount;
} params;

layout(std140, set = 0, binding = 0) uniform UBO {
    mat4 MVP;
} global;

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

void main() {
    gl_Position = global.MVP * Position;
    vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;
layout(set = 0, binding = 2) uniform sampler2D Source;

void main() {
    vec2 uv = vTexCoord;

    // 1. CRT Barrel Distortion (subtle default)
    vec2 cc = uv - 0.5;
    float dist = dot(cc, cc);
    uv = uv + cc * dist * 0.10; // Subtle curvature

    // Check bounds after curvature
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // 2. Sample game texture
    vec3 col = texture(Source, uv).rgb;

    // 3. Scanlines (subtle default - every other line)
    float scanline = sin(uv.y * params.OutputSize.y * 3.14159) * 0.08; // Subtle scanlines
    col *= 1.0 - scanline;

    // 4. Screen mask (very subtle RGB pattern)
    float x = mod(gl_FragCoord.x, 3.0);
    float mask = 1.0;
    if (x < 1.0) mask = 0.98;  // Very subtle
    else if (x < 2.0) mask = 1.0;
    else mask = 0.97;
    col *= mix(1.0, mask, 0.15); // Even more subtle

    // 5. Vignette (subtle default)
    float vignette = 1.0 - dot(cc, cc) * 0.5; // Subtle vignette
    col *= vignette;

    // 6. Slight glow/bloom
    col = pow(col, vec3(0.95));

    // 7. Gamma adjustment
    col = pow(col, vec3(1.0 / 2.2)); // sRGB gamma

    FragColor = vec4(col, 1.0);
}
