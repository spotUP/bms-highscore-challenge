/**
 * Pure WebGL2 Shader Test - NO THREE.JS
 *
 * Direct WebGL2 rendering to prove the concept
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PureWebGL2MultiPassRenderer } from '../shaders/PureWebGL2MultiPassRenderer';

export default function PureWebGL2Test() {
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const rendererRef = useRef<PureWebGL2MultiPassRenderer | null>(null);
  const initStartedRef = useRef(false);
  const animationIdRef = useRef<number | null>(null);

  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || initStartedRef.current) {
      return;
    }

    initStartedRef.current = true;
    setStatus('Creating Pure WebGL2 renderer...');

    const init = async () => {
      try {
        // Create pure WebGL2 renderer - NO THREE.JS!
        const renderer = new PureWebGL2MultiPassRenderer(canvas, 800, 600);
        rendererRef.current = renderer;

        setStatus('Renderer created ✅');

        // Test: Load a simple shader
        setStatus('Loading test shader...');

        const success = await renderer.loadShaderPass(
          'test-shader',
          '/shaders/mega-bezel/shaders/guest/extras/hsm-drez-g-sharp_resampler.slang'
        );

        if (success) {
          setStatus('✅ Shader compiled successfully! Creating test texture...');

          // Create a test input texture with a pattern
          const gl = renderer.getContext();
          const width = 800;
          const height = 600;

          // Create test pattern (red/green gradient)
          const data = new Uint8Array(width * height * 4);
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = (y * width + x) * 4;
              data[i + 0] = (x / width) * 255;       // R
              data[i + 1] = (y / height) * 255;      // G
              data[i + 2] = 128;                      // B
              data[i + 3] = 255;                      // A
            }
          }

          // Create and upload texture
          const texture = gl.createTexture();
          if (!texture) {
            throw new Error('Failed to create texture');
          }

          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

          // Register texture with renderer
          const pureRenderer = (renderer as any).renderer;  // Access internal renderer
          pureRenderer.registerTexture('test_input', texture);

          console.log('[PureWebGL2Test] Created test pattern texture');

          setStatus('✅ Shader compiled successfully with PURE WEBGL2! Rendering...');
          setIsRendering(true);

        } else {
          setStatus('❌ Shader compilation failed');
          setError('Check console for WebGL errors');
        }

      } catch (err) {
        console.error('[PureWebGL2Test] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('❌ Initialization failed');
      }
    };

    init();
  }, []);

  // Separate effect for render loop
  useEffect(() => {
    if (!isRendering || !rendererRef.current) return;

    console.log('[PureWebGL2Test] Starting render loop...');

    const renderLoop = () => {
      try {
        rendererRef.current!.render('test_input');
        animationIdRef.current = requestAnimationFrame(renderLoop);
      } catch (err) {
        console.error('[PureWebGL2Test] Render error:', err);
        setError(err instanceof Error ? err.message : 'Render error');
        setIsRendering(false);
      }
    };

    renderLoop();

    // Cleanup on unmount
    return () => {
      if (animationIdRef.current) {
        console.log('[PureWebGL2Test] Stopping render loop');
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [isRendering]);

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">🚀 Pure WebGL2 Test</h1>
        <p className="text-xl mb-8">NO THREE.JS - Direct WebGL2 API</p>

        <div className="mb-4 p-4 bg-gray-900 border border-green-400 rounded">
          <div className="text-sm">Status: <span className="font-bold">{status}</span></div>
          {error && (
            <div className="mt-2 text-red-400">Error: {error}</div>
          )}
        </div>

        <div className="mb-4 p-4 bg-gray-900 border border-green-400 rounded">
          <h2 className="text-xl font-bold mb-2">What's Happening:</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Creating WebGL2 context (no Three.js)</li>
            <li>Compiling shaders with SlangShaderCompiler</li>
            <li>Using direct gl.createProgram(), gl.compileShader()</li>
            <li>If you see ✅ above, Pure WebGL2 is working!</li>
          </ul>
        </div>

        <div className="border border-green-400 rounded overflow-hidden">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full bg-black"
          />
        </div>

        <div className="mt-4 p-4 bg-gray-900 border border-green-400 rounded">
          <h2 className="text-xl font-bold mb-2">Benefits:</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>✅ No Three.js dependency (600KB saved)</li>
            <li>✅ No glslVersion confusion</li>
            <li>✅ Direct shader error messages</li>
            <li>✅ WebGL2 GLSL ES 3.0 by default</li>
            <li>✅ texture() function works natively</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
