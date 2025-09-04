import React from 'react';

const HyperspaceEffect = () => {
  console.log('HyperspaceEffect rendering...');
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ backgroundColor: 'black', zIndex: -1 }}>
      {/* Debug: Add a visible border to see if the container is there */}
      <div 
        className="scene" 
        style={{ 
          border: '2px solid red',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '200px',
          height: '200px'
        }}
      >
        <div className="wrap">
          {/* Create multiple tunnel segments */}
          {Array.from({ length: 20 }, (_, i) => (
            <div 
              key={i} 
              className="wall" 
              style={{
                animationDelay: `${i * 0.5}s`,
                backgroundColor: 'rgba(0, 255, 255, 0.1)' // Debug: make walls slightly visible
              }}
            >
              <div className="wall-left" style={{ backgroundColor: 'rgba(255, 0, 0, 0.3)' }}></div>
              <div className="wall-right" style={{ backgroundColor: 'rgba(0, 255, 0, 0.3)' }}></div>
              <div className="wall-top" style={{ backgroundColor: 'rgba(0, 0, 255, 0.3)' }}></div>
              <div className="wall-bottom" style={{ backgroundColor: 'rgba(255, 255, 0, 0.3)' }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HyperspaceEffect;