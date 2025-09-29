import React, { useState, useEffect } from 'react';

interface MusicPiece {
  id: string;
  title: string;
  mood: string;
}

interface MusicState {
  currentPieceId: string | null;
  isPlaying: boolean;
  volume: number;
}

const MusicSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [musicState, setMusicState] = useState<MusicState>({
    currentPieceId: null,
    isPlaying: false,
    volume: 0.6,
  });
  const [selectedMood, setSelectedMood] = useState<string>('all');

  // Add custom scrollbar styling
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .music-list-scroll::-webkit-scrollbar {
        width: 10px;
      }
      .music-list-scroll::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.5);
        border-radius: 5px;
      }
      .music-list-scroll::-webkit-scrollbar-thumb {
        background: #00ff00;
        border-radius: 5px;
      }
      .music-list-scroll::-webkit-scrollbar-thumb:hover {
        background: #00cc00;
      }
      .music-list-scroll {
        scrollbar-width: thin;
        scrollbar-color: #00ff00 rgba(0, 0, 0, 0.5);
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Available moods for filtering
  const moods = [
    'all', 'peaceful', 'ambient', 'nature', 'meditative', 'atmospheric',
    'cinematic', 'focus', 'dreamy', 'space', 'organic', 'flowing'
  ];

  // Get available pieces from global music system
  const availablePieces: MusicPiece[] = (window as any).generativeMusic?.availablePieces || [];

  // Debug logging
  useEffect(() => {
    console.log('MusicSelector mounted. window.generativeMusic:', (window as any).generativeMusic);
    console.log('Available pieces:', availablePieces.length);
  }, [availablePieces.length]);

  // Filter pieces by selected mood
  const filteredPieces = selectedMood === 'all'
    ? availablePieces
    : availablePieces.filter(piece => piece.mood === selectedMood);

  // Debug: log filtered pieces count
  useEffect(() => {
    console.log(`Filtered pieces count: ${filteredPieces.length}`);
  }, [filteredPieces.length]);

  // Update state when global music state changes
  useEffect(() => {
    const updateState = () => {
      const globalState = (window as any).generativeMusic?.currentState;
      if (globalState) {
        setMusicState(globalState);
      }
    };

    const interval = setInterval(updateState, 1000); // Check every second
    return () => clearInterval(interval);
  }, []);

  const startPiece = (pieceId: string) => {
    console.log('Trying to start piece:', pieceId);
    console.log('generativeMusic object:', (window as any).generativeMusic);
    if ((window as any).generativeMusic) {
      console.log('Calling startPiece...');
      (window as any).generativeMusic.startPiece(pieceId);
    } else {
      console.error('generativeMusic object not found on window');
    }
  };

  const stopMusic = () => {
    if ((window as any).generativeMusic) {
      (window as any).generativeMusic.stopCurrentPiece();
    }
  };

  const setVolume = (volume: number) => {
    if ((window as any).generativeMusic) {
      (window as any).generativeMusic.setVolume(volume);
    }
  };

  const getRandomPiece = () => {
    if ((window as any).generativeMusic) {
      const randomPiece = (window as any).generativeMusic.getRandomPiece();
      if (randomPiece) {
        startPiece(randomPiece.id);
      }
    }
  };

  // Always render to debug - remove this check temporarily
  // if (!availablePieces.length) {
  //   return null; // Don't render if music system isn't ready
  // }

  return (
    <>
      {/* Music Control Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: '2px solid #00ff00',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: '#00ff00',
          fontSize: '20px',
          cursor: 'pointer',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          fontFamily: 'monospace'
        }}
        title="Music Controls"
      >
        ♫
      </button>

      {/* Music Selector Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            width: '350px',
            maxHeight: '80vh',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            border: '2px solid #00ff00',
            borderRadius: '10px',
            padding: '15px',
            zIndex: 1000,
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#00ff00',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(0, 255, 0, 0.3)'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px',
            borderBottom: '1px solid #00ff00',
            paddingBottom: '10px',
            flexShrink: 0
          }}>
            <h3 style={{ margin: 0, color: '#00ff00' }}>🎵 Generative Music</h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: '1px solid #00ff00',
                color: '#00ff00',
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: '3px'
              }}
            >
              ×
            </button>
          </div>

          {/* Current Playing */}
          <div style={{ marginBottom: '15px', padding: '8px', backgroundColor: 'rgba(0, 255, 0, 0.1)', borderRadius: '5px', flexShrink: 0 }}>
            <div>Status: {musicState.isPlaying ? '▶️ Playing' : '⏹️ Stopped'}</div>
            {musicState.currentPieceId && (
              <div>Current: {availablePieces.find(p => p.id === musicState.currentPieceId)?.title || musicState.currentPieceId}</div>
            )}
          </div>

          {/* Volume Control */}
          <div style={{ marginBottom: '15px', flexShrink: 0 }}>
            <label>Volume: {Math.round(musicState.volume * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={musicState.volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{
                width: '100%',
                marginTop: '5px',
                accentColor: '#00ff00'
              }}
            />
          </div>

          {/* Quick Actions */}
          <div style={{ marginBottom: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
            <button
              onClick={() => startPiece('meditation')}
              style={{
                background: 'rgba(0, 255, 0, 0.2)',
                border: '1px solid #00ff00',
                color: '#00ff00',
                padding: '4px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              🧘 Meditation
            </button>
            <button
              onClick={() => {
                console.log('Test button clicked');
                console.log('window.generativeMusic:', (window as any).generativeMusic);
                if ((window as any).generativeMusic) {
                  console.log('Available pieces:', (window as any).generativeMusic.availablePieces?.length);
                }
              }}
              style={{
                background: 'rgba(255, 255, 0, 0.2)',
                border: '1px solid #ffff00',
                color: '#ffff00',
                padding: '4px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              🔍 Test
            </button>
            <button
              onClick={() => startPiece('drones')}
              style={{
                background: 'rgba(0, 255, 0, 0.2)',
                border: '1px solid #00ff00',
                color: '#00ff00',
                padding: '4px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              🌌 Drones
            </button>
            <button
              onClick={getRandomPiece}
              style={{
                background: 'rgba(0, 255, 0, 0.2)',
                border: '1px solid #00ff00',
                color: '#00ff00',
                padding: '4px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              🎲 Random
            </button>
            <button
              onClick={stopMusic}
              style={{
                background: 'rgba(255, 0, 0, 0.2)',
                border: '1px solid #ff0000',
                color: '#ff0000',
                padding: '4px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              ⏹️ Stop
            </button>
          </div>

          {/* Mood Filter */}
          <div style={{ marginBottom: '15px', flexShrink: 0 }}>
            <label>Filter by Mood:</label>
            <select
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              style={{
                width: '100%',
                marginTop: '5px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #00ff00',
                color: '#00ff00',
                padding: '4px',
                borderRadius: '3px',
                fontSize: '11px'
              }}
            >
              {moods.map(mood => (
                <option key={mood} value={mood} style={{ backgroundColor: 'black' }}>
                  {mood} {mood !== 'all' && `(${availablePieces.filter(p => p.mood === mood).length})`}
                </option>
              ))}
            </select>
          </div>

          {/* Music List */}
          <div style={{ marginBottom: '8px', fontWeight: 'bold', flexShrink: 0 }}>
            Available Tracks ({filteredPieces.length}):
          </div>
          <div
            className="music-list-scroll"
            onWheel={(e) => {
              e.stopPropagation();
              const target = e.currentTarget;
              target.scrollTop += e.deltaY;
            }}
            style={{
              height: '200px',
              overflowY: 'scroll',
              overflowX: 'hidden',
              border: '2px solid #00ff00',
              padding: '5px',
              borderRadius: '5px',
              flexShrink: 0,
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              backgroundColor: 'rgba(0, 0, 0, 0.5)'
            }}
          >
            {filteredPieces.map((piece) => (
              <div
                key={piece.id}
                onClick={() => startPiece(piece.id)}
                style={{
                  padding: '6px 8px',
                  margin: '2px 0',
                  border: `1px solid ${musicState.currentPieceId === piece.id ? '#ffff00' : '#00ff00'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: musicState.currentPieceId === piece.id
                    ? 'rgba(255, 255, 0, 0.1)'
                    : 'rgba(0, 255, 0, 0.05)',
                  transition: 'all 0.2s ease',
                  fontSize: '10px'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'rgba(0, 255, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = musicState.currentPieceId === piece.id
                    ? 'rgba(255, 255, 0, 0.1)'
                    : 'rgba(0, 255, 0, 0.05)';
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{piece.title}</div>
                <div style={{ color: '#888', fontSize: '9px' }}>
                  {piece.mood} • {piece.id}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            marginTop: '15px',
            paddingTop: '10px',
            borderTop: '1px solid #00ff00',
            fontSize: '9px',
            color: '#888',
            textAlign: 'center',
            flexShrink: 0
          }}>
            Alex Bainter Generative Music • {availablePieces.length} pieces
          </div>
        </div>
      )}
    </>
  );
};

export default MusicSelector;