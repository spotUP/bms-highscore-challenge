import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarFieldProps {
  count?: number;
}

// Create a circular texture for round stars
const createCircularTexture = () => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = 32;
  canvas.height = 32;
  
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  
  return new THREE.CanvasTexture(canvas);
};

const Stars = ({ count = 5000 }: StarFieldProps) => {
  const mesh = useRef<THREE.Points>(null!);
  
  const [particles, sizes] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const starSizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 2000;
      positions[i3 + 1] = (Math.random() - 0.5) * 2000;
      positions[i3 + 2] = (Math.random() - 0.5) * 2000;
      
      // Vary star sizes with most being small
      starSizes[i] = Math.random() * 0.8 + 0.2; // Size between 0.2 and 1.0
    }
    return [positions, starSizes];
  }, [count]);

  const texture = useMemo(() => createCircularTexture(), []);

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.x -= delta / 20;
      mesh.current.rotation.y -= delta / 30;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <points ref={mesh}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particles.length / 3}
            array={particles}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={sizes.length}
            array={sizes}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={1.5}
          sizeAttenuation={true}
          color="#ffffff"
          transparent={true}
          opacity={0.9}
          map={texture}
          vertexColors={false}
        />
      </points>
    </group>
  );
};

const StarField = ({ count }: StarFieldProps) => {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ 
          position: [0, 0, 1], 
          fov: 100, 
          near: 0.1, 
          far: 2000 
        }}
        style={{ 
          background: 'transparent',
          pointerEvents: 'none'
        }}
      >
        <Stars count={count} />
      </Canvas>
    </div>
  );
};

export default StarField;