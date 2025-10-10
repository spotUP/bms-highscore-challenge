/**
 * WebGL2Canvas Test Page
 *
 * Simple test page to verify WebGL2Canvas produces identical output to Canvas2D
 */

import { useEffect, useRef } from 'react';
import { WebGL2D } from '../utils/WebGL2D';

export default function WebGLTest() {
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const webglRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas2d = canvas2dRef.current;
    const webglCanvas = webglRef.current;

    if (!canvas2d || !webglCanvas) return;

    // Canvas2D rendering
    const ctx2d = canvas2d.getContext('2d');
    if (!ctx2d) return;

    // WebGL2D rendering
    const webglCtx = new WebGL2D(webglCanvas);

    // Draw identical content on both canvases
    const draw = (ctx: CanvasRenderingContext2D | WebGL2D) => {
      // Clear background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 800, 600);

      // Draw white rectangle
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(50, 50, 200, 100);

      // Draw red rectangle with transparency
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(100, 75, 200, 100);
      ctx.globalAlpha = 1.0;

      // Draw green border
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 4;
      ctx.strokeRect(150, 100, 200, 100);

      // Draw blue circle
      ctx.strokeStyle = '#0000ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(400, 300, 50, 0, Math.PI * 2);
      ctx.stroke();

      // Draw text
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 32px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WebGL2Canvas Test', 400, 450);

      // Draw lines
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(50, 500);
      ctx.lineTo(200, 520);
      ctx.lineTo(350, 480);
      ctx.lineTo(500, 550);
      ctx.stroke();
    };

    // Draw on both canvases
    draw(ctx2d);
    draw(webglCtx);

  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      padding: '20px',
      backgroundColor: '#111'
    }}>
      <h1 style={{ color: '#fff', fontFamily: 'monospace' }}>
        WebGL2D Comparison Test
      </h1>

      <div style={{ display: 'flex', gap: '40px' }}>
        <div>
          <h2 style={{ color: '#fff', fontFamily: 'monospace', fontSize: '16px', marginBottom: '10px' }}>
            Canvas2D (Reference)
          </h2>
          <canvas
            ref={canvas2dRef}
            width={800}
            height={600}
            style={{ border: '2px solid #00ff00', display: 'block' }}
          />
        </div>

        <div>
          <h2 style={{ color: '#fff', fontFamily: 'monospace', fontSize: '16px', marginBottom: '10px' }}>
            WebGL2D (Test)
          </h2>
          <canvas
            ref={webglRef}
            width={800}
            height={600}
            style={{ border: '2px solid #00ff00', display: 'block' }}
          />
        </div>
      </div>

      <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px', maxWidth: '800px' }}>
        <p>↑ Both canvases should look IDENTICAL</p>
        <p>If there are differences, the WebGL2D wrapper needs fixes before porting the game.</p>
      </div>
    </div>
  );
}
