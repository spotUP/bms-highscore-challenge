import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { BracketMatch, BracketParticipant } from '@/contexts/BracketContext';

interface BracketViewProps {
  matches: BracketMatch[];
  participants: Record<string, BracketParticipant>;
  adminMode?: boolean;
  onReport?: (matchId: string, winnerParticipantId: string) => void;
  onPlayerClick?: (matchId: string, participantId: string, participantName: string) => void;
}

// Simple SVG-based bracket view with pan/zoom
// Optional highlightTarget triggers a boing animation on a specific next-round match
interface BracketViewPropsExtra extends BracketViewProps {
  highlightTarget?: { round: number; position: number } | null;
  // Tournament selection props
  tournaments?: any[];
  selectedTournament?: any;
  onTournamentChange?: (tournament: any) => void;
  bracketType?: string | null;
  isPublic?: boolean;
  isCompleted?: boolean;
  matchCount?: number;
  tournamentTitle?: string;
  // Admin view props
  disableKeyboardNavigation?: boolean;
  forceAutoFit?: boolean;
}

const BracketView: React.FC<BracketViewPropsExtra> = ({ matches, participants, adminMode = false, onReport, onPlayerClick, highlightTarget, tournaments, selectedTournament, onTournamentChange, bracketType, isPublic, isCompleted, matchCount, tournamentTitle, disableKeyboardNavigation = false, forceAutoFit = false }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(true);
  const restoredRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const matchHeight = 78;
  const colWidth = 300; // horizontal distance between rounds

  // Build rounds and create position-based layout, split winners/losers/grand final
  const { winnersRounds, losersRounds, grandRounds, matchPositions } = useMemo(() => {
    const byRound = new Map<number, BracketMatch[]>();
    matches.forEach(m => {
      const arr = byRound.get(m.round) || [];
      arr.push(m);
      byRound.set(m.round, arr);
    });
    const allRounds = Array.from(byRound.entries()).sort((a, b) => a[0] - b[0]);

    const winners = allRounds.filter(([r]) => r > 0 && r < 100);
    const losers = allRounds.filter(([r]) => r >= 100 && r < 1000);
    const grand = allRounds.filter(([r]) => r >= 1000);

    const positions = new Map<string, { x: number; y: number; centerY: number }>();

    const layoutSection = (roundsArr: [number, BracketMatch[]][], sectionOffsetX: number) => {
      roundsArr.forEach(([round, matchList], colIdx) => {
        const sortedMatches = matchList.slice().sort((a, b) => a.position - b.position);
        const baseSpacing = Math.max(120, matchHeight + 40);
        
        if (colIdx === 0) {
          // First round: use regular spacing
          const roundSpacing = baseSpacing;
          sortedMatches.forEach((match, index) => {
            const x = sectionOffsetX + colIdx * colWidth;
            const y = index * roundSpacing;
            const centerY = y + (matchHeight / 2);
            positions.set(match.id, { x, y, centerY });
          });
        } else {
          // Subsequent rounds: center between parent matches
          const prevRound = roundsArr[colIdx - 1];
          if (prevRound) {
            const [, prevMatches] = prevRound;
            sortedMatches.forEach((match, index) => {
              const x = sectionOffsetX + colIdx * colWidth;
              
              // Find the two parent matches that feed into this match
              const parentMatch1Position = (match.position - 1) * 2 + 1;
              const parentMatch2Position = (match.position - 1) * 2 + 2;
              
              const parent1 = prevMatches.find(m => m.position === parentMatch1Position);
              const parent2 = prevMatches.find(m => m.position === parentMatch2Position);
              
              let y: number;
              if (parent1 && parent2) {
                // Center between the two parent matches
                const parent1Pos = positions.get(parent1.id);
                const parent2Pos = positions.get(parent2.id);
                if (parent1Pos && parent2Pos) {
                  y = (parent1Pos.centerY + parent2Pos.centerY) / 2 - (matchHeight / 2);
                } else {
                  // Fallback to exponential spacing
                  const roundSpacing = baseSpacing * Math.pow(2, Math.max(0, (round % 100) - 1));
                  y = index * roundSpacing;
                }
              } else if (parent1) {
                // Only one parent (odd number of matches in previous round)
                const parent1Pos = positions.get(parent1.id);
                if (parent1Pos) {
                  y = parent1Pos.centerY - (matchHeight / 2);
                } else {
                  const roundSpacing = baseSpacing * Math.pow(2, Math.max(0, (round % 100) - 1));
                  y = index * roundSpacing;
                }
              } else {
                // No parents found, use exponential spacing as fallback
                const roundSpacing = baseSpacing * Math.pow(2, Math.max(0, (round % 100) - 1));
                y = index * roundSpacing;
              }
              
              const centerY = y + (matchHeight / 2);
              positions.set(match.id, { x, y, centerY });
            });
          } else {
            // Fallback to exponential spacing
            const roundSpacing = baseSpacing * Math.pow(2, Math.max(0, (round % 100) - 1));
            sortedMatches.forEach((match, index) => {
              const x = sectionOffsetX + colIdx * colWidth;
              const y = index * roundSpacing;
              const centerY = y + (matchHeight / 2);
              positions.set(match.id, { x, y, centerY });
            });
          }
        }
      });
    };

    const winnersCols = winners.length;
    layoutSection(winners, 0);
    layoutSection(losers, winnersCols * colWidth + 200); // gap between sections
    layoutSection(grand, (winnersCols + losers.length) * colWidth + 400);

    return { winnersRounds: winners, losersRounds: losers, grandRounds: grand, matchPositions: positions };
  }, [matches, matchHeight]);

  // Zoom controls (component scope)
  const zoomIn = () => setScale(s => Math.min(3, s * 1.1));
  const zoomOut = () => setScale(s => Math.max(0.3, s / 1.1));

  // Keyboard shortcuts: arrows to pan, +/- to zoom, 0 to fit, L to toggle legend
  useEffect(() => {
    if (disableKeyboardNavigation) return;

    const handler = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 60 : 30;
      if (e.key === 'ArrowLeft') { setOffset(o => ({ ...o, x: o.x + step })); }
      else if (e.key === 'ArrowRight') { setOffset(o => ({ ...o, x: o.x - step })); }
      else if (e.key === 'ArrowUp') { setOffset(o => ({ ...o, y: o.y + step })); }
      else if (e.key === 'ArrowDown') { setOffset(o => ({ ...o, y: o.y - step })); }
      else if (e.key === '+' || e.key === '=') { setScale(s => Math.min(3, s * 1.06)); }
      else if (e.key === '-') { setScale(s => Math.max(0.3, s / 1.06)); }
      else if (e.key === '0') { zoomToFit(); }
      else if (e.key.toLowerCase() === 'l') { setShowLegend(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disableKeyboardNavigation]);

  // Persist/restore view state per competition
  const compId = useMemo(() => (matches && matches[0] ? (matches[0] as any).competition_id : null), [matches]);
  useEffect(() => {
    if (!compId || forceAutoFit) return;
    try {
      const raw = localStorage.getItem(`bracketView:${compId}`);
      if (raw) {
        const v = JSON.parse(raw);
        const haveMatches = Array.isArray(matches) && matches.length > 0;
        // Only restore scale/offset if we don't have matches (to allow auto-fit) or if initial fit is already done
        if (!haveMatches || initialFitDoneRef.current) {
          if (typeof v.scale === 'number') setScale(v.scale);
          if (v.offset && typeof v.offset.x === 'number' && typeof v.offset.y === 'number') setOffset(v.offset);
        }
        if (typeof v.showLegend === 'boolean') setShowLegend(v.showLegend);
        restoredRef.current = true;
      }
    } catch {}
  }, [compId, matches, forceAutoFit]);
  useEffect(() => {
    if (!compId) return;
    try {
      localStorage.setItem(`bracketView:${compId}` , JSON.stringify({ scale, offset, showLegend }));
    } catch {}
  }, [compId, scale, offset, showLegend]);

  // Auto-fit on load and whenever matches change
  useEffect(() => {
    const haveMatches = Array.isArray(matches) && matches.length > 0;
    if (!haveMatches) return;
    // Always center and fit to view when entering competition page or when forceAutoFit is enabled
    // Allow layout to settle over three frames before fitting
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        const id3 = requestAnimationFrame(() => {
          zoomToFit();
          initialFitDoneRef.current = true;
        });
        (window as any).__bfid = id3;
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      if ((window as any).__bfid) cancelAnimationFrame((window as any).__bfid);
    };
  }, [matches]);

  // Separate auto-fit for admin mode with forceAutoFit
  useEffect(() => {
    if (!forceAutoFit) return;
    const haveMatches = Array.isArray(matches) && matches.length > 0;
    if (!haveMatches) return;

    // Run auto-fit when matches or participants change in admin mode
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          zoomToFit();
        });
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [forceAutoFit, matches, participants]); // Include both matches and participants for admin mode

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    const delta = -e.deltaY;
    // Gentle zoom factor for smoother control
    const factor = delta > 0 ? 1.03 : 0.97;
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

  // Precompute section offsets for connectors and quick-jump
  const winnersOffsetX = 0;
  const losersOffsetX = winnersRounds.length * colWidth + 200;
  const grandOffsetX = losersOffsetX + losersRounds.length * colWidth + 400;

  // Compute section heights and total width for zoom-to-fit and backgrounds
  const baseSpacing = Math.max(120, matchHeight + 40);
  const computeSectionHeight = (roundsArr: [number, BracketMatch[]][]) => {
    if (roundsArr.length === 0) return 100;
    let maxHeight = 0;
    roundsArr.forEach(([round, matches]) => {
      const roundSpacing = baseSpacing * Math.pow(2, Math.max(0, (round % 100) - 1));
      const sectionHeight = matches.length * roundSpacing + matchHeight;
      maxHeight = Math.max(maxHeight, sectionHeight);
    });
    return maxHeight + 80; // padding
  };
  const winnersHeight = computeSectionHeight(winnersRounds);
  const losersHeight = computeSectionHeight(losersRounds);
  const grandHeight = computeSectionHeight(grandRounds);
  const contentHeight = Math.max(winnersHeight, losersHeight, grandHeight);
  const winnersWidth = Math.max(1, winnersRounds.length) * colWidth;
  const losersWidth = losersRounds.length > 0 ? (200 + losersRounds.length * colWidth) : 0;
  const grandWidth = grandRounds.length > 0 ? (400 + colWidth) : 0;
  const contentWidth = winnersWidth + losersWidth + grandWidth;

  const zoomToFit = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const w = svg.clientWidth || 800;
    const h = svg.clientHeight || 600;
    const marginX = 90;
    const marginY = 90;
    const sx = (w - marginX) / Math.max(1, contentWidth);
    const sy = (h - marginY) / Math.max(1, contentHeight);
    const newScale = Math.max(0.3, Math.min(3, Math.min(sx, sy) * 0.85));
    setScale(newScale);
    const contentWScaled = contentWidth * newScale;
    const contentHScaled = contentHeight * newScale;
    setOffset({
      x: Math.round((w - contentWScaled) / 2),
      y: Math.round((h - contentHScaled) / 2)
    });
  };

  // Zoom to section utility
  const zoomToRect = (rectX: number, rectWidth: number, rectHeight: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const w = svg.clientWidth || 800;
    const h = svg.clientHeight || 600;
    const marginX = 100;
    const marginY = 120;
    const sx = (w - marginX) / Math.max(1, rectWidth);
    const sy = (h - marginY) / Math.max(1, rectHeight);
    const newScale = Math.max(0.3, Math.min(3, Math.min(sx, sy)));
    setScale(newScale);
    const scaledWidth = rectWidth * newScale;
    const scaledHeight = rectHeight * newScale;
    setOffset({
      x: Math.round((w - scaledWidth) / 2) - Math.round(rectX * newScale),
      y: Math.round((h - scaledHeight) / 2) - Math.round(20 * newScale) // align with section top y=20
    });
  };

  const zoomToWinners = () => zoomToRect(winnersOffsetX - 20, winnersWidth + 40, winnersHeight);
  const zoomToLosers = () => {
    if (losersRounds.length === 0) return;
    zoomToRect(losersOffsetX - 20, losersRounds.length * colWidth + 40, losersHeight);
  };
  const zoomToGrand = () => {
    if (grandRounds.length === 0) return;
    zoomToRect(grandOffsetX - 20, colWidth + 40, grandHeight);
  };
  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  // Refit on window resize to keep everything in view
  useEffect(() => {
    const onResize = () => {
      // Defer to allow layout to settle
      requestAnimationFrame(zoomToFit);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [contentWidth, contentHeight]);

  const handlePlayerClick = (matchId: string, participantId: string, participantName: string) => {
    if (onPlayerClick) {
      onPlayerClick(matchId, participantId, participantName);
    }
  };

  const handleMatchClick = (match: any, participantId: string) => {
    console.log('Match clicked:', { match, participantId, adminMode, onReport });
    
    // If we have an onReport handler and we're in admin mode, use that
    if (onReport && adminMode) {
      console.log('Calling onReport with:', match.id, participantId);
      onReport(match.id, participantId);
    } 
    // Otherwise, use the player click handler if available
    else if (onPlayerClick) {
      const participant = participants[participantId];
      if (participant) {
        console.log('Calling onPlayerClick with:', match.id, participantId, participant.name);
        onPlayerClick(match.id, participantId, participant.name);
      }
    }
  };

  return (
    <div className="w-full h-full relative">
      {/* Tournament Selector */}
      {tournaments && selectedTournament && onTournamentChange && (
        <div className="absolute top-4 left-4 z-10">
          <select
            value={selectedTournament.id}
            onChange={(e) => {
              const tournament = tournaments.find(t => t.id === e.target.value);
              if (tournament) onTournamentChange(tournament);
            }}
            className="bg-black/60 border border-gray-600 text-white rounded px-3 py-2 text-sm"
          >
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name} - {tournament.status === 'completed' ? '✓ Complete' : 
                 tournament.status === 'active' ? '▶ Active' : '○ Draft'}
              </option>
            ))}
          </select>
        </div>
      )}
      <svg
        ref={svgRef}
        className="w-full h-full bg-black/25 rounded-md border border-white/10 cursor-grab"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', touchAction: 'none', overflow: 'hidden' } as React.CSSProperties}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <g transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
          {/* Section backgrounds */}
          <rect x={winnersOffsetX - 20} y={20} width={winnersWidth + 40} height={winnersHeight} fill="none" stroke="none" />
          {losersRounds.length > 0 && (
            <rect x={losersOffsetX - 20} y={20} width={losersRounds.length * colWidth + 40} height={losersHeight} fill="none" stroke="none" />
          )}
          {grandRounds.length > 0 && (
            <rect x={grandOffsetX - 20} y={20} width={colWidth + 40} height={grandHeight} fill="none" stroke="none" />
          )}
          {/* Winners Section */}
          {winnersRounds.map(([round, list], colIdx) => (
            <g key={`w-${round}`}>
              <text x={colIdx * colWidth} y={20} fill="#7CFFB2" fontSize={14} fontWeight={700}>{`Winners R${round}`}</text>
              {list
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((m) => {
                  const pos = matchPositions.get(m.id);
                  if (!pos) return null;
                  
                  const p1 = m.participant1_id ? participants[m.participant1_id] : undefined;
                  const p2 = m.participant2_id ? participants[m.participant2_id] : undefined;
                  const winner = m.winner_participant_id ? participants[m.winner_participant_id] : undefined;
                  const loserColor = "#ff4d4d";
                  let p1Color = "#fff";
                  let p2Color = "#fff";
                  if (winner) {
                    if (p1 && winner.id === p2?.id) p1Color = loserColor; // p1 lost
                    if (p2 && winner.id === p1?.id) p2Color = loserColor; // p2 lost
                  }
                  
                  // Inner padding for content inside the match box
                  const padX = 24;
                  const padY = 12; // top padding
                  const nameFontSize = 20;
                  const lineHeight = 30; // vertical distance between name baselines for extra bottom padding

                  const isHighlighted = !!highlightTarget && highlightTarget.round === m.round && highlightTarget.position === m.position;
                  const isNewMatch = !m.participant1_id && !m.participant2_id; // Empty match is "new"
                  const isWalkover = m.participant1_id && !m.participant2_id || !m.participant1_id && m.participant2_id;
                  return (
                    <g key={m.id} transform={`translate(${pos.x}, ${pos.y + 40})`}>
                      <g>
                        {/* Filled card */}
                        <rect x={0} y={0} width={200} height={matchHeight} rx={6} ry={6} fill="rgba(16,16,16,0.8)" className={isHighlighted ? 'boing' : ''} />
                        {/* Outline draw animation */}
                        <rect x={0} y={0} width={200} height={matchHeight} rx={6} ry={6}
                          fill="none" stroke="#60a5fa" strokeWidth="2"
                          strokeDasharray="100" strokeDashoffset="100" pathLength={100}>
                          <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.2s" begin={`${colIdx * 0.2}s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                        </rect>
                        <text x={padX} y={padY + nameFontSize - 2} fill={p1Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>{p1 ? p1.display_name : '—'}</text>
                        <text x={padX} y={padY + nameFontSize - 2 + lineHeight} fill={p2Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>{p2 ? p2.display_name : '—'}</text>
                        {winner && (
                          <g>
                            <title>Winner</title>
                            <rect x={146} y={padY + nameFontSize - 22} width={44} height={16} rx={4} ry={4} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" />
                          </g>
                        )}
                        {isWalkover && (
                          <g>
                            <title>Walkover</title>
                            <rect x={160} y={padY + nameFontSize + 6} width={28} height={16} rx={4} ry={4} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" />
                            <text x={174} y={padY + nameFontSize + 18} fill="#cccccc" fontSize={10} textAnchor="middle" style={{ pointerEvents: 'none' }}>WO</text>
                          </g>
                        )}
                        {/* Admin click zones */}
                        {adminMode && onPlayerClick && (
                          <g>
                            {p1 && (
                              <rect x={padX - 6} y={padY - 8} width={200 - (padX - 6) * 2} height={lineHeight} 
                                fill="transparent" style={{ cursor: 'pointer' }}
                                onClick={() => handleMatchClick(m, p1.id)} />
                            )}
                            {p2 && (
                              <rect x={padX - 6} y={padY - 8 + lineHeight} width={200 - (padX - 6) * 2} height={lineHeight} 
                                fill="transparent" style={{ cursor: 'pointer' }}
                                onClick={() => handleMatchClick(m, p2.id)} />
                            )}
                          </g>
                        )}
                      </g>
                    </g>
                  );
                })}
            </g>
          ))}

          {/* Losers Section */}
          {losersRounds.map(([round, list], colIdx) => (
            <g key={`l-${round}`}>
              <text x={(winnersRounds.length * colWidth) + 200 + colIdx * colWidth} y={20} fill="#FFB27C" fontSize={14} fontWeight={700}>{`Losers R${round - 99}`}</text>
              {list
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((m) => {
                  const pos = matchPositions.get(m.id);
                  if (!pos) return null;
                  
                  const p1 = m.participant1_id ? participants[m.participant1_id] : undefined;
                  const p2 = m.participant2_id ? participants[m.participant2_id] : undefined;
                  const winner = m.winner_participant_id ? participants[m.winner_participant_id] : undefined;
                  const loserColor = "#ff4d4d";
                  let p1Color = "#fff";
                  let p2Color = "#fff";
                  if (winner) {
                    if (p1 && winner.id === p2?.id) p1Color = loserColor;
                    if (p2 && winner.id === p1?.id) p2Color = loserColor;
                  }
                  const padX = 24;
                  const padY = 12;
                  const nameFontSize = 20;
                  const lineHeight = 30;
                  const isHighlighted = !!highlightTarget && highlightTarget.round === m.round && highlightTarget.position === m.position;
                  const isWalkover = m.participant1_id && !m.participant2_id || !m.participant1_id && m.participant2_id;
                  return (
                    <g key={m.id} transform={`translate(${pos.x}, ${pos.y + 40})`}>
                      <g>
                        {/* Filled card */}
                        <rect x={0} y={0} width={200} height={matchHeight} rx={6} ry={6} fill="rgba(16,16,16,0.8)" className={isHighlighted ? 'boing' : ''} />
                        {/* Outline draw animation */}
                        <rect x={0} y={0} width={200} height={matchHeight} rx={6} ry={6}
                          fill="none" stroke="#e879f9" strokeWidth="2"
                          strokeDasharray="100" strokeDashoffset="100" pathLength={100}>
                          <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.2s" begin={`${colIdx * 0.2}s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                        </rect>
                        <text x={padX} y={padY + nameFontSize - 2} fill={p1Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>{p1 ? p1.display_name : '—'}</text>
                        <text x={padX} y={padY + nameFontSize - 2 + lineHeight} fill={p2Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>{p2 ? p2.display_name : '—'}</text>
                        {winner && (
                          <g>
                            <title>Winner</title>
                            <rect x={146} y={padY + nameFontSize - 22} width={44} height={16} rx={4} ry={4} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" />
                          </g>
                        )}
                        {isWalkover && (
                          <g>
                            <title>Walkover</title>
                            <rect x={160} y={padY + nameFontSize + 6} width={28} height={16} rx={4} ry={4} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" />
                            <text x={174} y={padY + nameFontSize + 18} fill="#cccccc" fontSize={10} textAnchor="middle" style={{ pointerEvents: 'none' }}>WO</text>
                          </g>
                        )}
                        {adminMode && onPlayerClick && (
                          <g>
                            {p1 && (<rect x={padX - 6} y={padY - 8} width={200 - (padX - 6) * 2} height={lineHeight} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => handleMatchClick(m, p1.id)} />)}
                            {p2 && (<rect x={padX - 6} y={padY - 8 + lineHeight} width={200 - (padX - 6) * 2} height={lineHeight} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => handleMatchClick(m, p2.id)} />)}
                          </g>
                        )}
                      </g>
                    </g>
                  );
                })}
            </g>
          ))}

          {/* Grand Final Section */}
          {grandRounds.map(([round, list]) => (
            <g key={`g-${round}`}>
              <text x={(winnersRounds.length * colWidth) + 200 + (losersRounds.length * colWidth) + 400} y={20} fill="#FFD700" fontSize={16} fontWeight={800}>Grand Final</text>
              {list.map((m) => {
                const pos = matchPositions.get(m.id);
                if (!pos) return null;
                const p1 = m.participant1_id ? participants[m.participant1_id] : undefined;
                const p2 = m.participant2_id ? participants[m.participant2_id] : undefined;
                const winner = m.winner_participant_id ? participants[m.winner_participant_id] : undefined;
                const loserColor = "#ff4d4d";
                let p1Color = "#fff";
                let p2Color = "#fff";
                if (winner) {
                  if (p1 && winner.id === p2?.id) p1Color = loserColor; // p1 lost
                  if (p2 && winner.id === p1?.id) p2Color = loserColor; // p2 lost
                }
                const padX = 24; const padY = 12; const nameFontSize = 20; const lineHeight = 30;
                const isWalkover = false; // Grand Final should never be a walkover - it's populated with both champions
                return (
                  <g key={m.id} transform={`translate(${pos.x}, ${pos.y + 40})`}>
                    <g>
                      {/* Filled card */}
                      <rect x={0} y={0} width={220} height={matchHeight} rx={8} ry={8} fill="rgba(16,16,0,0.9)" />
                      {/* Outline draw animation */}
                      <rect x={0} y={0} width={220} height={matchHeight} rx={8} ry={8}
                        fill="none" stroke="#FFD700" strokeWidth="2"
                        strokeDasharray="100" strokeDashoffset="100" pathLength={100}>
                        <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.4s" begin={`0s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                      </rect>
                      <text x={padX} y={padY + nameFontSize - 2} fill={p1Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>{p1 ? p1.display_name : '—'}</text>
                      <text x={padX} y={padY + nameFontSize - 2 + lineHeight} fill={p2Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>{p2 ? p2.display_name : '—'}</text>
                      {winner && (
                        <g>
                          <title>Winner</title>
                          <rect x={166} y={padY + nameFontSize - 22} width={44} height={16} rx={4} ry={4} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" />
                        </g>
                      )}
                      {isWalkover && (
                        <g>
                          <title>Walkover</title>
                          <rect x={180} y={padY + nameFontSize + 6} width={28} height={16} rx={4} ry={4} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" />
                          <text x={194} y={padY + nameFontSize + 18} fill="#cccccc" fontSize={10} textAnchor="middle" style={{ pointerEvents: 'none' }}>WO</text>
                        </g>
                      )}
                      {/* Admin click zones */}
                      {adminMode && onPlayerClick && m.status !== 'completed' && (
                        <g>
                          {p1 && (
                            <rect x={padX - 6} y={padY - 8} width={220 - (padX - 6) * 2} height={lineHeight} 
                              fill="transparent" style={{ cursor: 'pointer' }}
                              onClick={() => handleMatchClick(m, p1.id)} />
                          )}
                          {p2 && (
                            <rect x={padX - 6} y={padY - 8 + lineHeight} width={220 - (padX - 6) * 2} height={lineHeight} 
                              fill="transparent" style={{ cursor: 'pointer' }}
                              onClick={() => handleMatchClick(m, p2.id)} />
                          )}
                        </g>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          ))}
          {/* Winners connectors */}
          {winnersRounds.map(([round, list], colIdx) => {
            const nextRound = winnersRounds[colIdx + 1];
            if (!nextRound) return null;
            
            return (
              <g key={`connectors-${round}`}>
                {list.map((match) => {
                  const currentPos = matchPositions.get(match.id);
                  if (!currentPos) return null;
                  
                  // Find the target match in next round
                  const targetPosition = Math.ceil(match.position / 2);
                  const targetMatch = nextRound[1].find(m => m.position === targetPosition);
                  
                  if (!targetMatch) return null;
                  const targetPos = matchPositions.get(targetMatch.id);
                  if (!targetPos) return null;
                  
                  // Draw connector from current match center to target match center
                  const x1 = winnersOffsetX + colIdx * colWidth + 200; // Right edge of current match
                  const y1 = currentPos.centerY + 40; // Current match center (accounting for round offset)
                  const x2 = winnersOffsetX + (colIdx + 1) * colWidth; // Left edge of next match
                  const y2 = targetPos.centerY + 40; // Target match center (accounting for round offset)
                  
                  // Create L-shaped connector
                  const midX = x1 + 40; // Horizontal segment length
                  const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
                  
                  return (
                    <path
                      key={`${match.id}-connector`}
                      d={path}
                      stroke="#60a5fa"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="100" strokeDashoffset="100" pathLength={100}
                    >
                      <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.2s" begin={`${colIdx * 0.2 + 0.6}s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                    </path>
                  );
                })}
              </g>
            );
          })}

          {/* Losers connectors */}
          {losersRounds.map(([round, list], colIdx) => {
            const nextRound = losersRounds[colIdx + 1];
            if (!nextRound) return null;

            return (
              <g key={`l-connectors-${round}`}>
                {list.map((match) => {
                  const currentPos = matchPositions.get(match.id);
                  if (!currentPos) return null;

                  const targetPosition = Math.ceil(match.position / 2);
                  const targetMatch = nextRound[1].find(m => m.position === targetPosition);
                  if (!targetMatch) return null;
                  const targetPos = matchPositions.get(targetMatch.id);
                  if (!targetPos) return null;

                  const x1 = losersOffsetX + colIdx * colWidth + 200;
                  const y1 = currentPos.centerY + 40;
                  const x2 = losersOffsetX + (colIdx + 1) * colWidth;
                  const y2 = targetPos.centerY + 40;
                  const midX = x1 + 40;
                  const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

                  return (
                    <path
                      key={`${match.id}-l-connector`}
                      d={path}
                      stroke="#e879f9"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="100" strokeDashoffset="100" pathLength={100}
                    >
                      <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.2s" begin={`${colIdx * 0.2 + 0.6}s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                    </path>
                  );
                })}
              </g>
            );
          })}

          {/* Losers champion to Grand Final connector (from last losers round) */}
          {losersRounds.length > 0 && grandRounds.length > 0 && (
            (() => {
              const lastLosers = losersRounds[losersRounds.length - 1][1];
              if (!lastLosers || lastLosers.length === 0) return null;
              // Assume single match in last losers round
              const lm = lastLosers[0];
              const lPos = matchPositions.get(lm.id);
              // Assume first grand final match
              const gfList = grandRounds[0][1];
              const gf = gfList && gfList[0];
              if (!lPos || !gf) return null;
              const gfPos = matchPositions.get(gf.id);
              if (!gfPos) return null;
              
              // Only show connector if losers champion exists (last losers match is completed)
              // and Grand Final has at least one participant
              const losersChampExists = lm.status === 'completed' && lm.winner_participant_id;
              const grandFinalHasParticipant = gf.participant1_id || gf.participant2_id;
              
              if (!losersChampExists && !grandFinalHasParticipant) return null;
              
              const x1 = losersOffsetX + (losersRounds.length - 1) * colWidth + 200;
              const y1 = lPos.centerY + 40;
              const x2 = grandOffsetX; // left edge of GF
              const y2 = gfPos.centerY + 40;
              const midX = x1 + 60;
              const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
              return (
                <path
                  key={`losers-to-gf`}
                  d={path}
                  stroke="#e879f9"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="100" strokeDashoffset="100" pathLength={100}
                >
                  <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.4s" begin={`0.8s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                </path>
              );
            })()
          )}
        </g>

        {/* In-canvas Title/Status HUD (not scaled or panned) */}
        {(tournamentTitle || bracketType || typeof isPublic === 'boolean' || typeof isCompleted === 'boolean' || typeof matchCount === 'number') && (
          <g style={{ pointerEvents: 'none' } as any}>
            {/* Tournament Title */}
            {tournamentTitle && (
              <g transform={`translate(16, 45)`}>
                <text x={0} y={0} fill="url(#tournamentGradient)" fontSize={40} fontWeight="bold">{tournamentTitle}</text>
                <defs>
                  <linearGradient id="tournamentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ff00ff">
                      <animate attributeName="stop-color" values="#ff00ff;#00ffff;#ffff00;#ff00ff" dur="4s" repeatCount="indefinite"/>
                    </stop>
                    <stop offset="33%" stopColor="#00ffff">
                      <animate attributeName="stop-color" values="#00ffff;#ffff00;#ff00ff;#00ffff" dur="4s" repeatCount="indefinite"/>
                    </stop>
                    <stop offset="66%" stopColor="#ffff00">
                      <animate attributeName="stop-color" values="#ffff00;#ff00ff;#00ffff;#ffff00" dur="4s" repeatCount="indefinite"/>
                    </stop>
                    <stop offset="100%" stopColor="#ff00ff">
                      <animate attributeName="stop-color" values="#ff00ff;#00ffff;#ffff00;#ff00ff" dur="4s" repeatCount="indefinite"/>
                    </stop>
                  </linearGradient>
                </defs>
              </g>
            )}
            {/* Badges row */}
            <g transform={`translate(16, ${tournamentTitle ? 75 : 60})`}>
              {bracketType && (
                <>
                  <rect x={0} y={-12} rx={6} ry={6} width={150} height={20} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" />
                  <text x={8} y={3} fill="#ddd" fontSize={12}>{`${bracketType}-elimination`}</text>
                </>
              )}
              {typeof isPublic === 'boolean' && (
                <g transform={`translate(${bracketType ? 160 : 0}, 0)`}>
                  <rect x={0} y={-12} rx={6} ry={6} width={70} height={20} fill={isPublic ? 'rgba(16,185,129,0.15)' : 'rgba(120,120,120,0.25)'} stroke={isPublic ? 'rgba(52,211,153,0.4)' : 'rgba(150,150,150,0.4)'} />
                  <text x={8} y={3} fill={isPublic ? '#7CFFB2' : '#ddd'} fontSize={12}>{isPublic ? 'Public' : 'Private'}</text>
                </g>
              )}
              {typeof isCompleted === 'boolean' && (
                <g transform={`translate(${(bracketType ? 160 : 0) + (typeof isPublic === 'boolean' ? 80 : 0)}, 0)`}>
                  <rect x={0} y={-12} rx={6} ry={6} width={90} height={20} fill={isCompleted ? 'rgba(255,20,147,0.15)' : 'rgba(56,189,248,0.15)'} stroke={isCompleted ? 'rgba(255,20,147,0.4)' : 'rgba(125,211,252,0.4)'} />
                  <text x={8} y={3} fill={isCompleted ? '#ff63c3' : '#bfe9ff'} fontSize={12}>{isCompleted ? 'Completed' : 'In Progress'}</text>
                </g>
              )}
              {typeof matchCount === 'number' && (
                <g transform={`translate(${(bracketType ? 160 : 0) + (typeof isPublic === 'boolean' ? 80 : 0) + (typeof isCompleted === 'boolean' ? 100 : 0)}, 0)`}>
                  <rect x={0} y={-12} rx={6} ry={6} width={110} height={20} fill={'rgba(255,255,255,0.06)'} stroke={'rgba(255,255,255,0.15)'} />
                  <text x={8} y={3} fill={'#ddd'} fontSize={12}>{`${matchCount} matches`}</text>
                </g>
              )}
            </g>
          </g>
        )}
      </svg>
      {/* HUD */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-2">
        <span title="Current zoom">Zoom: {(scale * 100).toFixed(0)}%</span>
        <button title="Zoom out" className="px-2 py-1 bg-white/10 border border-white/20 rounded" onClick={zoomOut}>−</button>
        <button title="Zoom in" className="px-2 py-1 bg-white/10 border border-white/20 rounded" onClick={zoomIn}>+</button>
        <button title="Fit to screen" className="px-2 py-1 bg-white/10 border border-white/20 rounded" onClick={zoomToFit}>Fit</button>
        <button title="Reset view" className="px-2 py-1 bg-white/10 border border-white/20 rounded" onClick={resetView}>Reset</button>
      </div>
    </div>
  );
}
;

export default BracketView;
