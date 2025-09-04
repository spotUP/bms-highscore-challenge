import React from 'react';

const HyperspaceEffect = () => {
  console.log('HyperspaceEffect rendering...');
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ backgroundColor: 'black', zIndex: -1 }}>
      <div className="hyperspace-container">
        {/* Create radial streaming lines */}
        {Array.from({ length: 150 }, (_, i) => {
          const angle = (i / 150) * 360;
          const radius = 50 + (i % 3) * 30; // Vary starting radius
          const length = 200 + (i % 4) * 100; // Vary line lengths
          
          return (
            <div
              key={i}
              className="hyperspace-line"
              style={{
                transform: `rotate(${angle}deg)`,
                animationDelay: `${(i * 0.02)}s`,
                animationDuration: `${0.8 + (i % 3) * 0.4}s`
              }}
            >
              <div 
                className="line-segment"
                style={{
                  width: `${length}px`,
                  left: `${radius}px`
                }}
              />
            </div>
          );
        })}
        
        {/* Central bright core */}
        <div className="hyperspace-core" />
      </div>
    </div>
  );
};

export default HyperspaceEffect;