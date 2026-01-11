import React from 'react';

interface SpaceBlazersLogoProps {
  className?: string;
}

const SpaceBlazersLogo: React.FC<SpaceBlazersLogoProps> = ({ className = "" }) => {
  return (
    <div className={`flex justify-center ${className}`}>
      <svg
        width="400"
        height="120"
        viewBox="0 0 400 120"
        className="w-full max-w-md"
        xmlns="http://www.w3.org/2000/svg"
        style={{ background: 'rgba(0,0,0,0.3)', border: '2px solid #00ffff' }}
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="spaceBlazersNeonBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ffff" />
            <stop offset="50%" stopColor="#0080ff" />
            <stop offset="100%" stopColor="#4040ff" />
          </linearGradient>
          <linearGradient id="spaceBlazersNeonPink" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff00ff" />
            <stop offset="50%" stopColor="#ff4080" />
            <stop offset="100%" stopColor="#ff8040" />
          </linearGradient>
          <filter id="spaceBlazersGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background grid pattern */}
        <g opacity="0.3">
          {Array.from({ length: 20 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={i * 20}
              y1="0"
              x2={i * 20}
              y2="120"
              stroke="url(#spaceBlazersNeonBlue)"
              strokeWidth="0.5"
              opacity="0.3"
            />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={i * 20}
              x2="400"
              y2={i * 20}
              stroke="url(#spaceBlazersNeonBlue)"
              strokeWidth="0.5"
              opacity="0.3"
            />
          ))}
        </g>

        {/* SPACE text */}
        <g>
          {/* S */}
          <path
            d="M15 25 L35 25 M35 25 L35 40 M35 40 L15 40 M15 40 L15 55 M15 55 L35 55"
            stroke="#00ffff"
            strokeWidth="3"
            fill="none"
          />

          {/* P */}
          <path
            d="M45 25 L45 55 M45 25 L60 25 M60 25 L60 40 M60 40 L45 40"
            stroke="#00ffff"
            strokeWidth="3"
            fill="none"
          />

          {/* A */}
          <path
            d="M70 55 L77.5 25 L85 55 M72.5 42.5 L82.5 42.5"
            stroke="#00ffff"
            strokeWidth="3"
            fill="none"
          />

          {/* C */}
          <path
            d="M105 25 L95 25 L95 55 L105 55"
            stroke="#00ffff"
            strokeWidth="3"
            fill="none"
          />

          {/* E */}
          <path
            d="M115 25 L115 55 M115 25 L130 25 M115 40 L125 40 M115 55 L130 55"
            stroke="#00ffff"
            strokeWidth="3"
            fill="none"
          />
        </g>

        {/* Blazers text */}
        <g>
          {/* B */}
          <path
            d="M15 75 L15 105 M15 75 L30 75 M30 75 L30 90 M30 90 L15 90 M30 90 L30 105 M30 105 L15 105"
            stroke="#ff00ff"
            strokeWidth="3"
            fill="none"
          />

          {/* L */}
          <path
            d="M40 75 L40 105 M40 105 L55 105"
            stroke="#ff00ff"
            strokeWidth="3"
            fill="none"
          />

          {/* A */}
          <path
            d="M65 105 L72.5 75 L80 105 M67.5 92.5 L77.5 92.5"
            stroke="#ff00ff"
            strokeWidth="3"
            fill="none"
          />

          {/* Z */}
          <path
            d="M90 75 L105 75 L90 105 L105 105"
            stroke="#ff00ff"
            strokeWidth="3"
            fill="none"
          />

          {/* E */}
          <path
            d="M115 75 L115 105 M115 75 L130 75 M115 90 L125 90 M115 105 L130 105"
            stroke="#ff00ff"
            strokeWidth="3"
            fill="none"
          />

          {/* R */}
          <path
            d="M140 75 L140 105 M140 75 L155 75 M155 75 L155 90 M155 90 L140 90 M140 90 L155 105"
            stroke="#ff00ff"
            strokeWidth="3"
            fill="none"
          />

          {/* S */}
          <path
            d="M165 75 L180 75 M180 75 L180 90 M180 90 L165 90 M165 90 L165 105 M165 105 L180 105"
            stroke="#ff00ff"
            strokeWidth="3"
            fill="none"
          />
        </g>

        {/* Futuristic decorative elements */}
        <g opacity="0.7">
          {/* Left side accent lines */}
          <line x1="5" y1="15" x2="25" y2="15" stroke="url(#spaceBlazersNeonBlue)" strokeWidth="2" />
          <line x1="5" y1="18" x2="20" y2="18" stroke="url(#spaceBlazersNeonBlue)" strokeWidth="1" />
          <line x1="5" y1="65" x2="25" y2="65" stroke="url(#spaceBlazersNeonPink)" strokeWidth="2" />
          <line x1="5" y1="68" x2="20" y2="68" stroke="url(#spaceBlazersNeonPink)" strokeWidth="1" />

          {/* Right side accent lines */}
          <line x1="375" y1="15" x2="395" y2="15" stroke="url(#spaceBlazersNeonBlue)" strokeWidth="2" />
          <line x1="380" y1="18" x2="395" y2="18" stroke="url(#spaceBlazersNeonBlue)" strokeWidth="1" />
          <line x1="375" y1="65" x2="395" y2="65" stroke="url(#spaceBlazersNeonPink)" strokeWidth="2" />
          <line x1="380" y1="68" x2="395" y2="68" stroke="url(#spaceBlazersNeonPink)" strokeWidth="1" />

          {/* Corner brackets */}
          <path d="M0 0 L20 0 L20 5 M0 0 L0 20 L5 20" stroke="url(#spaceBlazersNeonBlue)" strokeWidth="2" fill="none" />
          <path d="M400 0 L380 0 L380 5 M400 0 L400 20 L395 20" stroke="url(#spaceBlazersNeonBlue)" strokeWidth="2" fill="none" />
          <path d="M0 120 L20 120 L20 115 M0 120 L0 100 L5 100" stroke="url(#spaceBlazersNeonPink)" strokeWidth="2" fill="none" />
          <path d="M400 120 L380 120 L380 115 M400 120 L400 100 L395 100" stroke="url(#spaceBlazersNeonPink)" strokeWidth="2" fill="none" />
        </g>

        {/* Central energy burst */}
        <g className="animate-pulse" style={{ animationDuration: '1.5s' }}>
          <circle cx="200" cy="40" r="3" fill="url(#spaceBlazersNeonBlue)" opacity="0.8">
            <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="200" cy="90" r="3" fill="url(#spaceBlazersNeonPink)" opacity="0.8">
            <animate attributeName="r" values="3;6;3" dur="2.5s" repeatCount="indefinite" />
          </circle>

          {/* Radiating lines from central points */}
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i * 45) * (Math.PI / 180);
            const startX = 200 + Math.cos(angle) * 15;
            const startY = 40 + Math.sin(angle) * 15;
            const endX = 200 + Math.cos(angle) * 30;
            const endY = 40 + Math.sin(angle) * 30;

            return (
              <line
                key={`burst1-${i}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="url(#spaceBlazersNeonBlue)"
                strokeWidth="1"
                opacity="0.6"
                className="animate-pulse"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            );
          })}

          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i * 45 + 22.5) * (Math.PI / 180);
            const startX = 200 + Math.cos(angle) * 15;
            const startY = 90 + Math.sin(angle) * 15;
            const endX = 200 + Math.cos(angle) * 30;
            const endY = 90 + Math.sin(angle) * 30;

            return (
              <line
                key={`burst2-${i}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="url(#spaceBlazersNeonPink)"
                strokeWidth="1"
                opacity="0.6"
                className="animate-pulse"
                style={{ animationDelay: `${i * 0.1 + 0.5}s` }}
              />
            );
          })}
        </g>

        {/* Scanning line effect */}
        <line x1="0" y1="60" x2="400" y2="60" stroke="cyan" strokeWidth="1" opacity="0.3">
          <animate attributeName="y1" values="0;120;0" dur="3s" repeatCount="indefinite" />
          <animate attributeName="y2" values="0;120;0" dur="3s" repeatCount="indefinite" />
        </line>
      </svg>
    </div>
  );
};

export default SpaceBlazersLogo;