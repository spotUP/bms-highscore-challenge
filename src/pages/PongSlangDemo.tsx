/**
 * Pong with Slang Shader System Demo
 *
 * Demonstrates the complete Slang shader pipeline integrated with the Pong game.
 * Uses the game's WebGL render target as input to the Slang shader system.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MegaBezelCompiler } from '../shaders/MegaBezelCompiler';
import { MultiPassRenderer } from '../shaders/MultiPassRenderer';
import { ParameterManager } from '../shaders/ParameterManager';

function PongSlangDemo() {
  console.log('[Slang Demo] Component mounting...');

  const [slangSystem, setSlangSystem] = useState<{
    multipass: MultiPassRenderer;
    paramManager: ParameterManager;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Three.js refs
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gameSceneRef = useRef<THREE.Scene | null>(null);
  const gameCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const gameRenderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);

  // Simple Pong game objects
  const ballRef = useRef<THREE.Mesh | null>(null);
  const leftPaddleRef = useRef<THREE.Mesh | null>(null);
  const rightPaddleRef = useRef<THREE.Mesh | null>(null);

  // Game state
  const ballVelocity = useRef({ x: 3, y: 3 });
  const initStartedRef = useRef(false);

  // Callback ref for canvas - fires when canvas is mounted
  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || initStartedRef.current) {
      return;
    }

    console.log('[Slang Demo] Canvas mounted, starting initialization...');
    initStartedRef.current = true;

    const init = async () => {
      console.log('[Slang Demo] Inside init function');
      try {
        // Create renderer
        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false
        });
        renderer.setSize(800, 800);
        renderer.autoClear = false; // Don't auto-clear - we manage clearing manually
        rendererRef.current = renderer;

        // Create game scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); // Black background
        gameSceneRef.current = scene;

        // Create orthographic camera (800x800 playfield)
        // Standard orthographic: centered at origin, symmetric frustum
        const camera = new THREE.OrthographicCamera(-400, 400, 400, -400, 0.1, 1000);
        camera.position.set(0, 0, 10); // Position camera looking down Z axis
        camera.lookAt(0, 0, 0); // Look at origin
        camera.updateProjectionMatrix();
        gameCameraRef.current = camera;

        // Create render target for game (this will be the input to Slang shaders)
        const gameRenderTarget = new THREE.WebGLRenderTarget(800, 800, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat
        });
        // Flip texture Y to match WebGL coordinate system
        gameRenderTarget.texture.flipY = false;
        gameRenderTargetRef.current = gameRenderTarget;

        // Create simple Pong game objects
        createGameObjects(scene);

        // Load Slang shader preset
        // const presetPath = '/shaders/pong-crt.slangp'; // Simple CRT shader
        // const presetPath = '/shaders/passthrough.slangp'; // Simple passthrough test
        // const presetPath = '/shaders/mega-bezel/potato-test1.slangp'; // Mega Bezel Test (3 passes)
        // const presetPath = '/shaders/mega-bezel/potato.slangp'; // Mega Bezel POTATO
        const presetPath = '/shaders/mega-bezel/potato-test1.slangp?v=' + Math.random(); // Full working preset
        console.log('[Slang Demo] Fetching preset from:', presetPath);

        const response = await fetch(presetPath);
        console.log('[Slang Demo] Preset response status:', response.status);

        if (!response.ok) {
          throw new Error(`Failed to load preset (${response.status}): ${response.statusText}`);
        }

        const presetContent = await response.text();
        console.log('[Slang Demo] Preset content length:', presetContent.length);

        // Compile preset using MegaBezelCompiler
        console.log('[Slang Demo] Starting preset compilation...');
        const compiler = new MegaBezelCompiler();
        const preset = await compiler.compilePreset(presetPath, {
          webgl2: true,
          debug: false,
          maxPasses: 16
        });

        console.log('[Slang Demo] Preset loaded:', preset);
        console.log('[Slang Demo] Passes:', preset.passes.length);
        console.log('[Slang Demo] Parameters:', Object.keys(preset.parameters));
        console.log('[Slang Demo] Textures:', Object.keys(preset.textures));

        // Create MultiPassRenderer with preset
        const multipass = new MultiPassRenderer(renderer, undefined, undefined, undefined, preset);

        // Load shaders (now handles #include preprocessing automatically)
        console.log('[Slang Demo] Loading shaders...');
        await multipass.loadShaders();

        console.log('[Slang Demo] All shaders loaded successfully');

        // Set game render target as input
        multipass.setInputTexture(gameRenderTarget.texture);

        // Create parameter manager for UI
        const paramManager = new ParameterManager();

        // Note: In the new system, parameters are managed differently
        // The MultiPassRenderer handles its own parameters internally

        // Log parameters
        console.log('[Slang Demo] Parameters:', paramManager.getAllValues());

        setSlangSystem({ multipass, paramManager });
        setLoading(false);

        console.log('[Slang Demo] Slang shader system initialized successfully');
      } catch (err) {
        console.error('[Slang Demo] Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    init();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[Slang Demo] Cleanup...');
      if (slangSystem) {
        slangSystem.multipass.dispose();
        // ParameterManager doesn't have dispose in new API
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (gameRenderTargetRef.current) {
        gameRenderTargetRef.current.dispose();
      }
    };
  }, [slangSystem]);

  // Create simple game objects
  function createGameObjects(scene: THREE.Scene) {
    // Ball (centered coordinate system: -400 to 400)
    const ballGeometry = new THREE.PlaneGeometry(12, 12);
    const ballMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(0, 0, 0); // Center of playfield
    scene.add(ball);
    ballRef.current = ball;

    // Left paddle (RED) - centered coords
    const paddleGeometry = new THREE.PlaneGeometry(12, 140);
    const leftPaddleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
    const leftPaddle = new THREE.Mesh(paddleGeometry, leftPaddleMaterial);
    leftPaddle.position.set(-360, 0, 0); // 40 from left edge in centered coords = -400 + 40 = -360
    scene.add(leftPaddle);
    leftPaddleRef.current = leftPaddle;

    // Right paddle (GREEN) - centered coords
    const rightPaddleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    const rightPaddle = new THREE.Mesh(paddleGeometry, rightPaddleMaterial);
    rightPaddle.position.set(360, 0, 0); // 760 in screen coords = 360 in centered coords
    scene.add(rightPaddle);
    rightPaddleRef.current = rightPaddle;

    console.log('[Slang Demo] Game objects created:',{
      ball: ball.position,
      leftPaddle: leftPaddle.position,
      rightPaddle: rightPaddle.position
    });
  }

  // Keyboard controls for parameters
  useEffect(() => {
    if (!slangSystem) return;

    const handleKey = (e: KeyboardEvent) => {
      const { paramManager } = slangSystem;

      if (e.key === '1') {
        // Decrease scanline intensity
        const current = paramManager.getValue('scanlineIntensity') || 0.25;
        paramManager.setValue('scanlineIntensity', current - 0.05);
        console.log('[Slang Demo] Scanline intensity:', paramManager.getValue('scanlineIntensity'));
      } else if (e.key === '2') {
        // Increase scanline intensity
        const current = paramManager.getValue('scanlineIntensity') || 0.25;
        paramManager.setValue('scanlineIntensity', current + 0.05);
        console.log('[Slang Demo] Scanline intensity:', paramManager.getValue('scanlineIntensity'));
      } else if (e.key === '3') {
        // Decrease curvature
        const current = paramManager.getValue('curvature') || 0.05;
        paramManager.setValue('curvature', current - 0.01);
        console.log('[Slang Demo] Curvature:', paramManager.getValue('curvature'));
      } else if (e.key === '4') {
        // Increase curvature
        const current = paramManager.getValue('curvature') || 0.05;
        paramManager.setValue('curvature', current + 0.01);
        console.log('[Slang Demo] Curvature:', paramManager.getValue('curvature'));
      } else if (e.key === '0') {
        // Reset to defaults
        paramManager.resetToDefaults();
        console.log('[Slang Demo] Parameters reset to defaults');
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [slangSystem]);

  // Game loop
  useEffect(() => {
    if (!slangSystem || !gameSceneRef.current || !gameCameraRef.current || !gameRenderTargetRef.current) {
      return;
    }

    let animationId: number;

    let frameCount = 0;
    const animate = () => {
      // Update game physics
      updateGame();

      // Render game to render target
      rendererRef.current!.setRenderTarget(gameRenderTargetRef.current);
      rendererRef.current!.clear(); // Manually clear the render target
      rendererRef.current!.render(gameSceneRef.current!, gameCameraRef.current!);

      // Update the input texture (this is critical!)
      slangSystem.multipass.setInputTexture(gameRenderTargetRef.current!.texture);

      // Render through Slang shader pipeline to screen
      rendererRef.current!.setRenderTarget(null);
      try {
        if (frameCount < 3) {
          console.log('[PongSlangDemo] About to call multipass.render(), frameCount:', frameCount);
        }
        slangSystem.multipass.render();
        if (frameCount < 3) {
          console.log('[PongSlangDemo] multipass.render() completed');
        }
      } catch (error) {
        console.error('[PongSlangDemo] Shader pipeline failed, falling back to direct render:', error);
        // Fallback: render game directly to screen
        rendererRef.current!.setRenderTarget(null);
        rendererRef.current!.clear();
        rendererRef.current!.render(gameSceneRef.current!, gameCameraRef.current!);
      }

      frameCount++;

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [slangSystem]);

  // Simple game physics (centered coordinates: -400 to 400)
  function updateGame() {
    if (!ballRef.current || !leftPaddleRef.current || !rightPaddleRef.current) return;

    const ball = ballRef.current;
    const leftPaddle = leftPaddleRef.current;
    const rightPaddle = rightPaddleRef.current;

    // Move ball
    ball.position.x += ballVelocity.current.x;
    ball.position.y += ballVelocity.current.y;

    // Bounce off top/bottom (centered coords: -400 to 400)
    if (ball.position.y <= -394 || ball.position.y >= 394) {
      ballVelocity.current.y *= -1;
    }

    // Bounce off paddles
    // Left paddle at x=-360, right paddle at x=360
    if (ball.position.x <= -348 && Math.abs(ball.position.y - leftPaddle.position.y) < 70) {
      ballVelocity.current.x *= -1;
    }
    if (ball.position.x >= 348 && Math.abs(ball.position.y - rightPaddle.position.y) < 70) {
      ballVelocity.current.x *= -1;
    }

    // Reset if ball goes out
    if (ball.position.x < -400 || ball.position.x > 400) {
      ball.position.set(0, 0, 0);
      ballVelocity.current = { x: 3 * (Math.random() > 0.5 ? 1 : -1), y: 3 * (Math.random() > 0.5 ? 1 : -1) };
    }

    // Simple AI for paddles
    leftPaddle.position.y += (ball.position.y - leftPaddle.position.y) * 0.1;
    rightPaddle.position.y += (ball.position.y - rightPaddle.position.y) * 0.1;

    // Clamp paddles (centered coords: -330 to 330 to keep within bounds)
    leftPaddle.position.y = Math.max(-330, Math.min(330, leftPaddle.position.y));
    rightPaddle.position.y = Math.max(-330, Math.min(330, rightPaddle.position.y));
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      backgroundColor: '#1a1a1a',
      minHeight: '100vh',
      color: 'white'
    }}>
      <h1>Pong + Slang Shader System Demo</h1>

      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h3>Keyboard Controls</h3>
        <p>1 / 2 - Decrease / Increase Scanline Intensity</p>
        <p>3 / 4 - Decrease / Increase Curvature</p>
        <p>0 - Reset to Defaults</p>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, left: 10, color: 'red', background: 'white', padding: '5px', zIndex: 1000 }}>
          Debug: Check console for logs
        </div>
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          style={{
            border: '2px solid #333',
            imageRendering: 'pixelated',
            backgroundColor: 'magenta' // Obvious color to see if canvas is transparent
          }}
        />

        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: '20px',
            borderRadius: '8px'
          }}>
            Loading Slang shaders...
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(128, 0, 0, 0.9)',
            padding: '20px',
            borderRadius: '8px',
            color: 'white'
          }}>
            Error: {error}
          </div>
        )}
      </div>

      {slangSystem && (
        <div style={{ marginTop: '20px', width: '800px' }}>
          <h3>Current Parameters</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {Object.entries(slangSystem.paramManager.getAllValues()).map(([name, value]) => {
              const param = slangSystem.paramManager.getParameter(name);
              return (
                <div key={name} style={{
                  padding: '10px',
                  backgroundColor: '#2a2a2a',
                  borderRadius: '4px'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{param?.displayName || name}</div>
                  <div style={{ color: '#888', fontSize: '0.9em' }}>
                    Value: {value.toFixed(2)} (range: {param?.min || 0} - {param?.max || 1})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default PongSlangDemo;
