import React, { useRef, useEffect } from 'react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';
import { useTheme } from '@/contexts/ThemeContext';

const HyperspaceEffect = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { enableAnimations, particleCount, isRaspberryPi } = usePerformanceMode();
  const { theme } = useTheme();
  const disabled = theme === 'tron';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Configuration - Adaptive based on device capability
    const PARTICLE_NUM = particleCount; // Dynamic based on device performance
    const PARTICLE_BASE_RADIUS = isRaspberryPi ? 0.8 : 0.6; // Larger particles on Pi for better visibility
    const FL = 50;
    const DEFAULT_SPEED = isRaspberryPi ? 1 : 2; // Slower on Pi to reduce CPU load
    const BOOST_SPEED = isRaspberryPi ? 6 : 12;

    let canvasWidth = window.innerWidth;
    let canvasHeight = window.innerHeight;
    let centerX = canvasWidth * 0.5;
    let centerY = canvasHeight * 0.5;
    let speed = DEFAULT_SPEED;

    const particles: Array<{
      x: number;
      y: number;
      z: number;
      pastZ: number;
    }> = [];

    // Resize handler
    const resize = () => {
      canvasWidth = window.innerWidth;
      canvasHeight = window.innerHeight;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      centerX = canvasWidth * 0.5;
      centerY = canvasHeight * 0.5;
      context.fillStyle = 'rgb(255, 255, 255)';
    };

    // Initialize particles to emit from center
    const randomizeParticle = (p: any) => {
      // Create particles in a circle around the center                                                   
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 100 + 50; // Random distance from center                           
      p.x = centerX + Math.cos(angle) * distance;
      p.y = centerY + Math.sin(angle) * distance;
      p.z = Math.random() * 1500 + 500;
      return p;
    };

    // Create particles
    for (let i = 0; i < PARTICLE_NUM; i++) {
      particles[i] = randomizeParticle({
        x: 0,
        y: 0,
        z: 0,
        pastZ: 0
      });
    }

    // Animation loop
    const loop = () => {
      // Clear canvas with black background
      context.save();
      context.fillStyle = 'rgb(0, 0, 0)';
      context.fillRect(0, 0, canvasWidth, canvasHeight);                                                  
      context.restore();

      const halfPi = Math.PI * 0.5;
      const atan2 = Math.atan2;
      const cos = Math.cos;
      const sin = Math.sin;

      // Made brighter: increased opacity from 0.3 to 0.6
      context.fillStyle = 'rgba(255, 255, 255, 0.6)'; 
      context.beginPath();

      for (let i = 0; i < PARTICLE_NUM; i++) {
        const p = particles[i];
        p.pastZ = p.z;
        p.z -= speed;

        if (p.z <= 0) {
          randomizeParticle(p);
          continue;
        }

        // Use fixed center point (no mouse parallax)
        const cx = centerX;
        const cy = centerY;

        const rx = p.x - cx;
        const ry = p.y - cy;

        // Current position
        const f = FL / p.z;
        const x = cx + rx * f;
        const y = cy + ry * f;
        const r = PARTICLE_BASE_RADIUS * f;

        // Previous position for trail effect
        const pf = FL / p.pastZ;
        const px = cx + rx * pf;
        const py = cy + ry * pf;
        const pr = PARTICLE_BASE_RADIUS * pf;

        // Create trail from previous to current position                                                 
        const a = atan2(py - y, px - x);
        const a1 = a + halfPi;
        const a2 = a - halfPi;

        context.moveTo(px + pr * cos(a1), py + pr * sin(a1));                                             
        context.arc(px, py, pr, a1, a2, true);
        context.lineTo(x + r * cos(a2), y + r * sin(a2));                                                 
        context.arc(x, y, r, a2, a1, true);
        context.closePath();
      }

      context.fill();
    };

    // Initialize
    resize();
    
    // Add resize listener
    window.addEventListener('resize', resize);

    // Start animation - Adaptive frame rate for device capability
    let animationId: number;
    let lastFrameTime = 0;
    const targetFPS = isRaspberryPi ? 24 : 60; // Lower FPS for Pi
    const frameInterval = 1000 / targetFPS;
    
    const animate = (currentTime: number) => {
      if (currentTime - lastFrameTime >= frameInterval) {
        if (!disabled && enableAnimations) {
          loop();
        } else {
          // Clear frame when disabled
          context.save();
          context.fillStyle = 'rgb(0, 0, 0)';
          context.fillRect(0, 0, canvasWidth, canvasHeight);
          context.restore();
        }
        lastFrameTime = currentTime;
      }
      animationId = requestAnimationFrame(animate);
    };

    if (enableAnimations || disabled) {
      animationId = requestAnimationFrame(animate);
    }

    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      window.removeEventListener('resize', resize);
    };
  }, [enableAnimations, particleCount, isRaspberryPi, disabled]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1, display: disabled ? 'none' : 'block' }}
    />
  );
};

export default HyperspaceEffect;
