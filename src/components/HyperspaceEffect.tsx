import React from 'react';

const HyperspaceEffect = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black">
      <div className="scene">
        <div className="wrap">
          {/* Create multiple tunnel segments */}
          {Array.from({ length: 20 }, (_, i) => (
            <div 
              key={i} 
              className="wall" 
              style={{
                animationDelay: `${i * 0.5}s`
              }}
            >
              <div className="wall-left"></div>
              <div className="wall-right"></div>
              <div className="wall-top"></div>
              <div className="wall-bottom"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HyperspaceEffect;