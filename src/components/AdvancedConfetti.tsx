import React, { useEffect, useRef } from 'react';

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

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF9F43', '#10AC84'];
  const shapes: ('square' | 'circle' | 'triangle')[] = ['square', 'circle', 'triangle'];

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
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      life: 0,
      maxLife: 300 + Math.random() * 200
    };
  };

  const updateParticle = (particle: ConfettiParticle, canvas: HTMLCanvasElement): boolean => {
    // Apply gravity
    particle.vy += particle.gravity;
    
    // Apply air resistance
    particle.vx *= particle.friction;
    particle.vy *= particle.friction;
    
    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;
    
    // Update rotation
    particle.rotation += particle.rotationSpeed;
    
    // Update life
    particle.life++;
    
    // Add some wind effect
    particle.vx += Math.sin(particle.life * 0.01) * 0.02;
    
    // Check if particle is still alive and on screen
    return particle.life < particle.maxLife && particle.y < canvas.height + 50;
  };

  const drawParticle = (ctx: CanvasRenderingContext2D, particle: ConfettiParticle) => {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    
    const alpha = Math.max(0, 1 - particle.life / particle.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    
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
    
    ctx.restore();
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create new particles
    if (particlesRef.current.length < 100) {
      for (let i = 0; i < 3; i++) {
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

  if (!isActive) return null;

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
