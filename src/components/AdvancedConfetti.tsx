import React, { useEffect, useRef } from 'react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  friction: number;
  color: string;
  size: number;
  shape: 'square' | 'circle' | 'triangle';
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
}

interface AdvancedConfettiProps {
  isActive: boolean;
  onComplete?: () => void;
}

const AdvancedConfetti: React.FC<AdvancedConfettiProps> = ({ isActive, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  const { isRaspberryPi, isPerformanceMode, isLowEnd } = usePerformanceMode();

  // Check if confetti should be completely disabled (user preference)
  const confettiDisabled = localStorage.getItem('disable-confetti') === 'true';
  const shouldDisableConfetti = confettiDisabled || (isRaspberryPi && localStorage.getItem('pi-confetti-enabled') !== 'true');

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF9F43', '#10AC84'];
  const shapes: ('square' | 'circle' | 'triangle')[] = ['square', 'circle', 'triangle'];

  // Performance settings based on device capabilities
  const getPerformanceSettings = () => {
    if (isRaspberryPi) {
      return {
        maxParticles: 15,
        particlesPerFrame: 1,
        targetFPS: 15,
        enableRotation: false,
        enableWind: false,
        enableComplexShapes: false
      };
    } else if (isPerformanceMode || isLowEnd) {
      return {
        maxParticles: 30,
        particlesPerFrame: 2,
        targetFPS: 30,
        enableRotation: false,
        enableWind: false,
        enableComplexShapes: false
      };
    } else {
      return {
        maxParticles: 100,
        particlesPerFrame: 3,
        targetFPS: 60,
        enableRotation: true,
        enableWind: true,
        enableComplexShapes: true
      };
    }
  };

  const perfSettings = getPerformanceSettings();

  // Log performance optimizations for debugging
  if (isRaspberryPi) {
    console.log('🎊 Pi-optimized confetti:', {
      maxParticles: perfSettings.maxParticles,
      targetFPS: perfSettings.targetFPS,
      particlesPerFrame: perfSettings.particlesPerFrame,
      rotation: perfSettings.enableRotation,
      wind: perfSettings.enableWind,
      complexShapes: perfSettings.enableComplexShapes
    });
  }

  const createParticle = (canvas: HTMLCanvasElement): ConfettiParticle => {
    return {
      x: Math.random() * canvas.width,
      y: -50,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      gravity: 0.1 + Math.random() * 0.1,
      friction: 0.99,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      shape: perfSettings.enableComplexShapes ? shapes[Math.floor(Math.random() * shapes.length)] : 'square',
      rotation: perfSettings.enableRotation ? Math.random() * Math.PI * 2 : 0,
      rotationSpeed: perfSettings.enableRotation ? (Math.random() - 0.5) * 0.2 : 0,
      life: 0,
      maxLife: isRaspberryPi ? 150 + Math.random() * 100 : 300 + Math.random() * 200
    };
  };

  const updateParticle = (particle: ConfettiParticle, canvas: HTMLCanvasElement): boolean => {
    // Apply gravity
    particle.vy += particle.gravity;

    // Apply air resistance (simplified for performance)
    if (!isRaspberryPi) {
      particle.vx *= particle.friction;
      particle.vy *= particle.friction;
    }

    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;

    // Update rotation only if enabled
    if (perfSettings.enableRotation) {
      particle.rotation += particle.rotationSpeed;
    }

    // Update life
    particle.life++;

    // Add wind effect only if enabled and not on Pi
    if (perfSettings.enableWind && !isRaspberryPi) {
      particle.vx += Math.sin(particle.life * 0.01) * 0.02;
    }

    // Check if particle is still alive and on screen
    return particle.life < particle.maxLife && particle.y < canvas.height + 50;
  };

  const drawParticle = (ctx: CanvasRenderingContext2D, particle: ConfettiParticle) => {
    ctx.save();
    ctx.translate(particle.x, particle.y);

    // Only rotate if enabled
    if (perfSettings.enableRotation) {
      ctx.rotate(particle.rotation);
    }

    const alpha = Math.max(0, 1 - particle.life / particle.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;

    // Simplified drawing for Pi performance
    if (isRaspberryPi || !perfSettings.enableComplexShapes) {
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    } else {
      switch (particle.shape) {
        case 'square':
          ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -particle.size / 2);
          ctx.lineTo(-particle.size / 2, particle.size / 2);
          ctx.lineTo(particle.size / 2, particle.size / 2);
          ctx.closePath();
          ctx.fill();
          break;
      }
    }

    ctx.restore();
  };

  const animate = (currentTime: number = performance.now()) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Frame rate limiting for Pi devices
    const frameInterval = 1000 / perfSettings.targetFPS;
    if (currentTime - lastFrameTimeRef.current < frameInterval) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    lastFrameTimeRef.current = currentTime;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create new particles (fewer for Pi)
    if (particlesRef.current.length < perfSettings.maxParticles) {
      for (let i = 0; i < perfSettings.particlesPerFrame; i++) {
        particlesRef.current.push(createParticle(canvas));
      }
    }

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter(particle => {
      const isAlive = updateParticle(particle, canvas);
      if (isAlive) {
        drawParticle(ctx, particle);
      }
      return isAlive;
    });

    // Continue animation if there are particles or we're still active
    if (particlesRef.current.length > 0 || isActive) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    if (isActive) {
      particlesRef.current = [];
      animate();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  // Handle disabled confetti case with useEffect (after all hooks)
  useEffect(() => {
    if (shouldDisableConfetti && isActive && onComplete) {
      const timeout = setTimeout(onComplete, 2000);
      return () => clearTimeout(timeout);
    }
  }, [shouldDisableConfetti, isActive, onComplete]);

  // Return null if disabled or not active
  if (!isActive || shouldDisableConfetti) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 55
      }}
    />
  );
};

export default AdvancedConfetti;
