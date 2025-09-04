import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface HyperspaceLineProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

const HyperspaceTunnel = () => {
  const linesRef = useRef<THREE.Group>(null!);
  
  const lines = useMemo(() => {
    const lineGeometries: HyperspaceLineProps[] = [];
    const numLines = 200;
    
    for (let i = 0; i < numLines; i++) {
      // Create lines radiating outward from center
      const angle = (i / numLines) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 2;
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      // Lines start at various Z positions and extend towards viewer
      const startZ = -50 - Math.random() * 100;
      const endZ = 50;
      
      lineGeometries.push({
        start: new THREE.Vector3(x, y, startZ),
        end: new THREE.Vector3(x * 0.1, y * 0.1, endZ)
      });
    }
    
    return lineGeometries;
  }, []);

  useFrame((state, delta) => {
    if (linesRef.current) {
      // Move the entire group forward to create tunnel effect
      linesRef.current.position.z += delta * 30;
      
      // Reset position when lines get too close
      if (linesRef.current.position.z > 50) {
        linesRef.current.position.z = -50;
      }
    }
  });

  return (
    <group ref={linesRef}>
      {lines.map((line, index) => {
        const points = [line.start, line.end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        return (
          <primitive 
            key={index} 
            object={new THREE.Line(
              geometry,
              new THREE.LineBasicMaterial({ 
                color: "#00ffff", 
                transparent: true, 
                opacity: 0.6 
              })
            )}
          />
        );
      })}
    </group>
  );
};

const HyperspaceEffect = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ 
          position: [0, 0, 0], 
          fov: 75,
          near: 0.1,
          far: 200
        }}
        style={{ 
          background: 'transparent'
        }}
      >
        <fog attach="fog" args={['#000011', 30, 100]} />
        <HyperspaceTunnel />
        
        {/* Multiple tunnel layers for depth */}
        <group position={[0, 0, -30]}>
          <HyperspaceTunnel />
        </group>
        <group position={[0, 0, -60]}>
          <HyperspaceTunnel />
        </group>
        
        {/* Central bright core */}
        <mesh position={[0, 0, -20]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial 
            color="#ffffff" 
            transparent={true} 
            opacity={0.1}
          />
        </mesh>
      </Canvas>
    </div>
  );
};

export default HyperspaceEffect;