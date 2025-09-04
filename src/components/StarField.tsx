import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarFieldProps {
  count?: number;
}

const Stars = ({ count = 5000 }: StarFieldProps) => {
  const mesh = useRef<THREE.Points>(null!);
  
  const particles = useMemo(() => {
    const temp = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      temp[i3] = (Math.random() - 0.5) * 2000;
      temp[i3 + 1] = (Math.random() - 0.5) * 2000;
      temp[i3 + 2] = (Math.random() - 0.5) * 2000;
    }
    return temp;
  }, [count]);

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.x -= delta / 10;
      mesh.current.rotation.y -= delta / 15;
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
        </bufferGeometry>
        <pointsMaterial
          size={3}
          sizeAttenuation={true}
          color="#ffffff"
          transparent={false}
          opacity={1}
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