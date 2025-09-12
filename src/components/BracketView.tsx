import React, { useMemo, useRef, useState } from 'react';
import type { BracketMatch, BracketParticipant } from '@/contexts/BracketContext';

interface BracketViewProps {
  matches: BracketMatch[];
  participants: Record<string, BracketParticipant>;
}

// Simple SVG-based bracket view with pan/zoom
const BracketView: React.FC<BracketViewProps> = ({ matches, participants }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const rounds = useMemo(() => {
    const byRound = new Map<number, BracketMatch[]>();
    matches.forEach(m => {
      const arr = byRound.get(m.round) || [];
      arr.push(m);
      byRound.set(m.round, arr);
    });
    return Array.from(byRound.entries()).sort((a, b) => a[0] - b[0]);
  }, [matches]);

  const laneHeight = 60;
  const colWidth = 260;

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    setScale(prev => Math.min(3, Math.max(0.3, prev * factor)));
  };

  const onMouseDown: React.MouseEventHandler<SVGSVGElement> = (e) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const onMouseUp = () => { dragging.current = false; };
  const onMouseLeave = () => { dragging.current = false; };

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        className="w-full h-full bg-black/25 rounded-md border border-white/10 cursor-grab"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <g transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
          {rounds.map(([round, list], colIdx) => {
            return (
              <g key={round} transform={`translate(${colIdx * colWidth}, 20)`}>
                <text x={0} y={-8} fill="#fff" fontSize={14} fontWeight={700}>{`Round ${round}`}</text>
                {list
                  .sort((a, b) => a.position - b.position)
                  .map((m, i) => {
                    const y = i * laneHeight * (round === 1 ? 1 : 2);
                    const p1 = m.participant1_id ? participants[m.participant1_id] : undefined;
                    const p2 = m.participant2_id ? participants[m.participant2_id] : undefined;
                    const winner = m.winner_participant_id ? participants[m.winner_participant_id] : undefined;
                    return (
                      <g key={m.id} transform={`translate(0, ${y})`}>
                        {/* Match box */}
                        <rect x={0} y={0} width={220} height={40} rx={6} ry={6} fill="#101010" stroke="#555" />
                        <text x={10} y={16} fill="#fff" fontSize={12}>{p1 ? p1.display_name : '—'}</text>
                        <text x={10} y={32} fill="#fff" fontSize={12}>{p2 ? p2.display_name : '—'}</text>
                        {winner && (
                          <text x={180} y={24} fill="#00e0a4" fontSize={12}>Winner</text>
                        )}
                        {/* Connector to next round visually */}
                        <line x1={220} y1={20} x2={240} y2={round === 1 ? 20 : (i % 2 === 0 ? laneHeight : -laneHeight)} stroke="#888" />
                      </g>
                    );
                  })}
                {/* Vertical rails between pairs for visual structure (basic) */}
                {round > 1 && (
                  <g>
                    {Array.from({ length: Math.ceil(list.length / 2) }).map((_, idx) => (
                      <line key={idx} x1={240} y1={idx * laneHeight * 2 - laneHeight + 20} x2={240} y2={idx * laneHeight * 2 + laneHeight + 20} stroke="#666" />
                    ))}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {/* HUD */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
        Zoom: {(scale * 100).toFixed(0)}%
      </div>
    </div>
  );
};

export default BracketView;
