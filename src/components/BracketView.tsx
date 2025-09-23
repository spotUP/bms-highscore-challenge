import React, { useMemo, useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
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
  // Winner animation props
  showWinnerZoom?: boolean;
}

export interface BracketViewRef {
  centerBracket: () => void;
  centerOnFinal: () => void;
}

const BracketView = forwardRef<BracketViewRef, BracketViewPropsExtra>(({ matches, participants, adminMode = false, onReport, onPlayerClick, highlightTarget, tournaments, selectedTournament, onTournamentChange, bracketType, isPublic, isCompleted, matchCount, tournamentTitle, disableKeyboardNavigation = false, forceAutoFit = false, showWinnerZoom = false }, ref) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<0 | 1>(0);
  const restoredRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);

  const matchHeight = 78;
  const matchTotalHeight = matchHeight + 30; // Add space for choose winner badge
  const colWidth = 300; // horizontal distance between rounds

  // Build ordered match list for navigation
  const orderedMatches = useMemo(() => {
    const allMatches = matches.slice();
    // Sort by round (ascending) then by position within round
    allMatches.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.position - b.position;
    });
    return allMatches;
  }, [matches]);

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

    // Define consistent spacing values with better scaling for large tournaments
    const firstRoundMatchCount = Math.max(
      winners.length > 0 ? winners[0][1].length : 0,
      losers.length > 0 ? losers[0][1].length : 0
    );

    // Scale spacing based on tournament size - more matches need more space
    const scaleFactor = Math.max(1, Math.min(2.5, firstRoundMatchCount / 8));
    const baseSpacing = Math.max(140, (matchTotalHeight + 50) * scaleFactor);
    const minSectionGap = Math.max(100, 60 * scaleFactor); // Reduced gap between brackets

    // Winners bracket layout
    const winnersOffsetX = 40;
    const winnersOffsetY = 40;

    // Calculate winners bracket positions first
    let winnersMaxY = winnersOffsetY;
    winners.forEach(([round, list], colIdx) => {
      const sortedMatches = list.slice().sort((a, b) => a.position - b.position);

      if (colIdx === 0) {
        // First round: use the scaled base spacing for large tournaments
        sortedMatches.forEach((match, index) => {
          const x = winnersOffsetX + colIdx * colWidth;
          const y = winnersOffsetY + index * baseSpacing;
          const centerY = y + (matchHeight / 2);
          positions.set(match.id, { x, y, centerY });
          winnersMaxY = Math.max(winnersMaxY, y + matchTotalHeight);
        });
      } else {
        // Subsequent rounds: center between parent matches with better fallback spacing
        const prevRound = winners[colIdx - 1];
        if (prevRound) {
          const [, prevMatches] = prevRound;
          sortedMatches.forEach((match, index) => {
            const x = winnersOffsetX + colIdx * colWidth;

            // Find parent matches
            const parentMatch1Position = (match.position - 1) * 2 + 1;
            const parentMatch2Position = (match.position - 1) * 2 + 2;

            const parent1 = prevMatches.find(m => m.position === parentMatch1Position);
            const parent2 = prevMatches.find(m => m.position === parentMatch2Position);

            let y: number;
            if (parent1 && parent2) {
              const parent1Pos = positions.get(parent1.id);
              const parent2Pos = positions.get(parent2.id);
              if (parent1Pos && parent2Pos) {
                y = (parent1Pos.centerY + parent2Pos.centerY) / 2 - (matchHeight / 2);
              } else {
                // Better fallback: use adaptive spacing instead of exponential
                const adaptiveSpacing = baseSpacing * Math.min(4, Math.pow(1.8, colIdx));
                y = winnersOffsetY + index * adaptiveSpacing;
              }
            } else if (parent1) {
              const parent1Pos = positions.get(parent1.id);
              if (parent1Pos) {
                y = parent1Pos.centerY - (matchHeight / 2);
              } else {
                const adaptiveSpacing = baseSpacing * Math.min(4, Math.pow(1.8, colIdx));
                y = winnersOffsetY + index * adaptiveSpacing;
              }
            } else {
              // Better fallback: use adaptive spacing instead of exponential
              const adaptiveSpacing = baseSpacing * Math.min(4, Math.pow(1.8, colIdx));
              y = winnersOffsetY + index * adaptiveSpacing;
            }

            const centerY = y + (matchHeight / 2);
            positions.set(match.id, { x, y, centerY });
            winnersMaxY = Math.max(winnersMaxY, y + matchTotalHeight);
          });
        }
      }
    });

    // Calculate dynamic losers bracket position based on winners bracket height
    const losersOffsetX = 40;
    const losersOffsetY = winnersMaxY + minSectionGap; // Dynamic positioning based on actual winners height

    // Layout losers section with improved positioning
    losers.forEach(([round, list], colIdx) => {
      const sortedMatches = list.slice().sort((a, b) => a.position - b.position);

      if (colIdx === 0) {
        // First losers round: use the scaled base spacing for large tournaments
        sortedMatches.forEach((match, index) => {
          const x = losersOffsetX + colIdx * colWidth;
          const y = losersOffsetY + index * baseSpacing;
          const centerY = y + (matchHeight / 2);
          positions.set(match.id, { x, y, centerY });
        });
      } else {
        // Subsequent losers rounds: center between previous matches with better spacing
        const prevRound = losers[colIdx - 1];
        if (prevRound) {
          const [, prevMatches] = prevRound;
          sortedMatches.forEach((match, index) => {
            const x = losersOffsetX + colIdx * colWidth;

            // Losers bracket has more complex positioning due to mixed flow
            // Try to center between parent matches when possible
            let y: number;

            // For losers bracket, the parent finding logic is more complex
            // due to the mixed flow of losers from winners bracket and advancement
            if (prevMatches.length >= 2 && index * 2 + 1 < prevMatches.length) {
              const parent1 = prevMatches[index * 2];
              const parent2 = prevMatches[index * 2 + 1];

              if (parent1 && parent2) {
                const parent1Pos = positions.get(parent1.id);
                const parent2Pos = positions.get(parent2.id);
                if (parent1Pos && parent2Pos) {
                  y = (parent1Pos.centerY + parent2Pos.centerY) / 2 - (matchHeight / 2);
                } else {
                  // Better fallback: use adaptive spacing for losers bracket
                  const adaptiveSpacing = baseSpacing * Math.min(3, Math.pow(1.6, colIdx));
                  y = losersOffsetY + index * adaptiveSpacing;
                }
              } else {
                const adaptiveSpacing = baseSpacing * Math.min(3, Math.pow(1.6, colIdx));
                y = losersOffsetY + index * adaptiveSpacing;
              }
            } else if (prevMatches.length === 1) {
              // Single parent case
              const parentPos = positions.get(prevMatches[0].id);
              y = parentPos ? parentPos.centerY - (matchHeight / 2) : losersOffsetY + index * baseSpacing;
            } else {
              // Fallback to adaptive spacing
              const adaptiveSpacing = baseSpacing * Math.min(3, Math.pow(1.6, colIdx));
              y = losersOffsetY + index * adaptiveSpacing;
            }

            const centerY = y + (matchHeight / 2);
            positions.set(match.id, { x, y, centerY });
          });
        }
      }
    });

    // Grand finals positioning - center between winners and losers final positions
    if (grand.length > 0) {
      const maxCols = Math.max(winners.length, losers.length);
      const finalX = winnersOffsetX + maxCols * colWidth + 100;

      grand.forEach(([round, matchList]) => {
        matchList.forEach((match, index) => {
          // Position finals roughly in the middle vertically between winners and losers
          const finalY = winnersOffsetY + (winnersMaxY - winnersOffsetY) / 2;
          const centerY = finalY + (matchHeight / 2);
          positions.set(match.id, { x: finalX, y: finalY, centerY });
        });
      });
    }

    return { winnersRounds: winners, losersRounds: losers, grandRounds: grand, matchPositions: positions };
  }, [matches, matchHeight, matchTotalHeight]);

  // Zoom controls (component scope)
  const zoomIn = () => smoothZoomTo(Math.min(3, scale * 1.1));
  const zoomOut = () => smoothZoomTo(Math.max(0.3, scale / 1.1));

  // Smooth pan function with easing
  const smoothPanTo = (targetX: number, targetY: number, duration: number = 300) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();
    const startX = offset.x;
    const startY = offset.y;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;

    setIsAnimating(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const currentX = startX + deltaX * easeProgress;
      const currentY = startY + deltaY * easeProgress;

      setOffset({ x: currentX, y: currentY });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Smooth pan by delta (relative movement)
  const smoothPanBy = (deltaX: number, deltaY: number, duration: number = 300) => {
    smoothPanTo(offset.x + deltaX, offset.y + deltaY, duration);
  };

  // Smooth zoom function with easing
  const smoothZoomTo = (targetScale: number, duration: number = 200) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();
    const startScale = scale;
    const deltaScale = targetScale - startScale;

    setIsAnimating(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const currentScale = startScale + deltaScale * easeProgress;
      setScale(currentScale);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Keyboard shortcuts: arrows to pan, +/- to zoom, 0 to fit, L to toggle legend
  // Disabled when bracket navigation is active
  useEffect(() => {
    if (disableKeyboardNavigation || (adminMode && selectedMatchId)) return;

    const handler = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 60 : 30;
      if (e.key === 'ArrowLeft') { smoothPanBy(step, 0, 250); }
      else if (e.key === 'ArrowRight') { smoothPanBy(-step, 0, 250); }
      else if (e.key === 'ArrowUp') { smoothPanBy(0, step, 250); }
      else if (e.key === 'ArrowDown') { smoothPanBy(0, -step, 250); }
      else if (e.key === '+' || e.key === '=') { smoothZoomTo(Math.min(3, scale * 1.06)); }
      else if (e.key === '-') { smoothZoomTo(Math.max(0.3, scale / 1.06)); }
      else if (e.key === '0') { zoomToFit(); }
      else if (e.key.toLowerCase() === 'l') { setShowLegend(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disableKeyboardNavigation, adminMode, selectedMatchId, smoothPanBy, smoothZoomTo, scale]);

  // Center view on selected match
  const centerOnMatch = (matchId: string) => {
    const pos = matchPositions.get(matchId);
    if (!pos || !svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate target offset to center the match
    const targetX = centerX - (pos.x + 100) * scale; // 100 is half match width
    const targetY = centerY - (pos.centerY + 40) * scale; // 40 is round offset

    smoothPanTo(targetX, targetY, 300);
  };

  // Navigate between matches with arrow keys and enter to select winner
  useEffect(() => {
    if (disableKeyboardNavigation || !adminMode) return;

    const handler = (e: KeyboardEvent) => {
      // Don't interfere with existing pan/zoom controls
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
        const currentIndex = selectedMatchId ? orderedMatches.findIndex(m => m.id === selectedMatchId) : -1;

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          // Move to next match in order
          const nextIndex = currentIndex < orderedMatches.length - 1 ? currentIndex + 1 : 0;
          const nextMatch = orderedMatches[nextIndex];
          if (nextMatch) {
            setSelectedMatchId(nextMatch.id);
            setSelectedPlayerIndex(0);
            centerOnMatch(nextMatch.id);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          // Move to previous match in order
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : orderedMatches.length - 1;
          const prevMatch = orderedMatches[prevIndex];
          if (prevMatch) {
            setSelectedMatchId(prevMatch.id);
            setSelectedPlayerIndex(0);
            centerOnMatch(prevMatch.id);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          // Toggle between player 1 and player 2 in current match
          if (selectedMatchId) {
            setSelectedPlayerIndex(prev => prev === 0 ? 1 : 0);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          // Toggle between player 1 and player 2 in current match
          if (selectedMatchId) {
            setSelectedPlayerIndex(prev => prev === 0 ? 1 : 0);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          // Select winner for current match and selected player
          if (selectedMatchId && onReport) {
            const match = orderedMatches.find(m => m.id === selectedMatchId);
            if (match) {
              const participantId = selectedPlayerIndex === 0 ? match.participant1_id : match.participant2_id;
              if (participantId) {
                onReport(selectedMatchId, participantId);
              }
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disableKeyboardNavigation, adminMode, selectedMatchId, selectedPlayerIndex, orderedMatches, onReport, centerOnMatch]);

  // Auto-select first match if none selected
  useEffect(() => {
    if (adminMode && !selectedMatchId && orderedMatches.length > 0) {
      setSelectedMatchId(orderedMatches[0].id);
      setSelectedPlayerIndex(0);
    }
  }, [adminMode, selectedMatchId, orderedMatches]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

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

  // Auto-fit only on initial load, not when matches update
  useEffect(() => {
    const haveMatches = Array.isArray(matches) && matches.length > 0;
    if (!haveMatches) return;
    // Only auto-fit on initial load, not on updates
    if (initialFitDoneRef.current) return;

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
    e.preventDefault(); // Prevent page scrolling when zooming in bracket
    const delta = -e.deltaY;
    // Gentle zoom factor for smoother control
    const factor = delta > 0 ? 1.03 : 0.97;
    // Use immediate setScale for responsive wheel scrolling
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

  // Layout constants for traditional bracket (winners top, losers bottom)
  const winnersOffsetX = 40;
  const winnersOffsetY = 40;
  const losersOffsetX = 40;

  // Calculate dynamic losers offset based on actual winners bracket height
  let winnersMaxY = winnersOffsetY;
  winnersRounds.forEach(([round, list]) => {
    list.forEach(match => {
      const pos = matchPositions.get(match.id);
      if (pos) {
        winnersMaxY = Math.max(winnersMaxY, pos.y + matchTotalHeight);
      }
    });
  });

  // Recalculate scale factor for proper gap sizing
  const firstRoundMatchCountForGap = Math.max(
    winnersRounds.length > 0 ? winnersRounds[0][1].length : 0,
    losersRounds.length > 0 ? losersRounds[0][1].length : 0
  );
  const scaleFactorForGap = Math.max(1, Math.min(2.5, firstRoundMatchCountForGap / 8));
  const minSectionGap = Math.max(200, 120 * scaleFactorForGap);
  const losersOffsetY = winnersMaxY + minSectionGap;

  const maxCols = Math.max(winnersRounds.length, losersRounds.length);
  const finalX = winnersOffsetX + maxCols * colWidth + 100;

  // Compute section heights and total width for zoom-to-fit and backgrounds
  const baseSectionSpacing = Math.max(120, matchTotalHeight + 40);
  const computeSectionHeight = (roundsArr: [number, BracketMatch[]][]) => {
    if (roundsArr.length === 0) return 100;
    let maxHeight = 0;
    roundsArr.forEach(([round, matches]) => {
      const roundSpacing = baseSectionSpacing * Math.pow(2, Math.max(0, (round % 100) - 1));
      const sectionHeight = matches.length * roundSpacing + matchTotalHeight;
      maxHeight = Math.max(maxHeight, sectionHeight);
    });
    return maxHeight + 80; // padding
  };
  const winnersHeight = computeSectionHeight(winnersRounds);
  const losersHeight = computeSectionHeight(losersRounds);
  const grandHeight = computeSectionHeight(grandRounds);

  // Calculate actual content dimensions based on dynamic positioning
  let losersMaxY = losersOffsetY;
  losersRounds.forEach(([round, list]) => {
    list.forEach(match => {
      const pos = matchPositions.get(match.id);
      if (pos) {
        losersMaxY = Math.max(losersMaxY, pos.y + matchTotalHeight);
      }
    });
  });

  // Traditional layout: total height includes both sections with actual spacing
  const contentHeight = Math.max(losersMaxY - winnersOffsetY + 100, winnersHeight + losersHeight + minSectionGap);
  const contentWidth = finalX + colWidth + 100; // Includes final column width

  const zoomToFit = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const w = svg.clientWidth || 800;
    const h = svg.clientHeight || 600;
    const marginX = 90;
    const marginY = 90;

    // Calculate actual content bounds from match positions
    let minY = Infinity;
    let maxY = -Infinity;

    if (matchPositions.size > 0) {
      matchPositions.forEach((pos) => {
        const actualY = pos.y + 40; // Account for the 40px offset where matches are rendered
        minY = Math.min(minY, actualY);
        maxY = Math.max(maxY, actualY + matchTotalHeight);
      });
    } else {
      minY = 40;
      maxY = 40 + matchHeight;
    }

    const actualContentHeight = maxY - minY + 40; // Add some padding
    const actualContentWidth = contentWidth;

    const sx = (w - marginX) / Math.max(1, actualContentWidth);
    const sy = (h - marginY) / Math.max(1, actualContentHeight);
    const newScale = Math.max(0.3, Math.min(3, Math.min(sx, sy) * 0.85));

    const contentWScaled = actualContentWidth * newScale;
    const contentHScaled = actualContentHeight * newScale;
    const minYScaled = minY * newScale;

    // Create coordinated fit animation that handles both zoom and pan
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();
    const startScale = scale;
    const startX = offset.x;
    const startY = offset.y;
    const deltaScale = newScale - startScale;

    setIsAnimating(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / 500, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // Animate scale
      const currentScale = startScale + deltaScale * easeProgress;
      setScale(currentScale);

      // Calculate target position based on current scale
      const currentContentWScaled = actualContentWidth * currentScale;
      const currentContentHScaled = actualContentHeight * currentScale;
      const currentMinYScaled = minY * currentScale;

      const currentTargetX = Math.round((w - currentContentWScaled) / 2);
      const currentTargetY = Math.round((h - currentContentHScaled) / 2) - currentMinYScaled;

      // Animate position to current target
      const deltaX = currentTargetX - startX;
      const deltaY = currentTargetY - startY;
      const currentX = startX + deltaX * easeProgress;
      const currentY = startY + deltaY * easeProgress;

      setOffset({ x: currentX, y: currentY });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
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
    const scaledWidth = rectWidth * newScale;
    const scaledHeight = rectHeight * newScale;

    const targetX = Math.round((w - scaledWidth) / 2) - Math.round(rectX * newScale);
    const targetY = Math.round((h - scaledHeight) / 2) - Math.round(20 * newScale); // align with section top y=20

    // Use smooth transitions for both zoom and pan
    smoothZoomTo(newScale, 400);
    smoothPanTo(targetX, targetY, 400);
  };

  const zoomToWinners = () => zoomToRect(winnersOffsetX - 20, maxCols * colWidth + 40, winnersHeight);
  const zoomToLosers = () => {
    if (losersRounds.length === 0) return;
    zoomToRect(losersOffsetX - 20, maxCols * colWidth + 40, losersHeight);
  };
  const zoomToGrand = () => {
    if (grandRounds.length === 0) return;
    zoomToRect(finalX - 20, colWidth + 40, grandHeight);
  };
  const resetView = () => { smoothZoomTo(1, 400); smoothPanTo(0, 0, 400); };

  // Expose centerBracket and centerOnFinal functions via ref
  useImperativeHandle(ref, () => ({
    centerBracket: zoomToFit,
    centerOnFinal: zoomToGrand
  }), []);

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
      {/* Keyboard navigation help */}
      {adminMode && selectedMatchId && (
        <div className="absolute top-4 right-4 z-10 bg-black/80 border border-green-400 text-green-400 rounded px-3 py-2 text-sm">
          <div className="text-xs opacity-75 mb-1">Keyboard Navigation</div>
          <div className="text-xs">
            ← → Navigate matches | ↑ ↓ Select player | Enter: Choose winner
          </div>
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
        <g transform={`translate(${offset.x},${offset.y}) scale(${scale})`} className={showWinnerZoom ? 'bracket-winner-zoom' : ''}>
          {/* Section backgrounds */}
          <rect x={winnersOffsetX - 20} y={winnersOffsetY - 20} width={maxCols * colWidth + 40} height={winnersHeight + 40} fill="none" stroke="none" />
          {losersRounds.length > 0 && (
            <rect x={losersOffsetX - 20} y={losersOffsetY - 20} width={maxCols * colWidth + 40} height={losersHeight + 40} fill="none" stroke="none" />
          )}
          {grandRounds.length > 0 && (
            <rect x={finalX - 20} y={winnersOffsetY + 280} width={colWidth + 40} height={grandHeight + 40} fill="none" stroke="none" />
          )}
          {/* Winners Section */}
          {winnersRounds.map(([round, list], colIdx) => (
            <g key={`w-${round}`}>
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
                  const winnerColor = "#00e0a4";
                  let p1Color = "#fff";
                  let p2Color = "#fff";
                  if (winner) {
                    if (p1 && winner.id === p1?.id) p1Color = winnerColor; // p1 won
                    if (p2 && winner.id === p2?.id) p2Color = winnerColor; // p2 won
                    if (p1 && winner.id === p2?.id) p1Color = loserColor; // p1 lost
                    if (p2 && winner.id === p1?.id) p2Color = loserColor; // p2 lost
                  }
                  
                  // Inner padding for content inside the match box
                  const padX = 24;
                  const padY = 12; // top padding
                  const nameFontSize = 20;
                  const lineHeight = 30; // vertical distance between name baselines for extra bottom padding

                  const isHighlighted = !!highlightTarget && highlightTarget.round === m.round && highlightTarget.position === m.position;
                  const isSelected = adminMode && selectedMatchId === m.id;
                  const isNewMatch = !m.participant1_id && !m.participant2_id; // Empty match is "new"
                  const isWalkover = m.participant1_id && !m.participant2_id || !m.participant1_id && m.participant2_id;
                  const hasParticipants = m.participant1_id && m.participant2_id;
                  const needsWinner = hasParticipants && !m.winner_participant_id && adminMode;
                  const isPlayer1Selected = isSelected && selectedPlayerIndex === 0;
                  const isPlayer2Selected = isSelected && selectedPlayerIndex === 1;
                  return (
                    <g key={m.id} transform={`translate(${pos.x}, ${pos.y + 40})`}>
                      <g>
                        {/* Filled card */}
                        <rect x={0} y={0} width={200} height={matchHeight} rx={6} ry={6} fill={isSelected ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.7)"} className={isHighlighted ? 'boing' : ''} />
                        {/* Outline draw animation */}
                        <rect x={0} y={0} width={200} height={matchHeight} rx={6} ry={6}
                          fill="none" stroke={isSelected ? "#00ff99" : needsWinner ? "#ff6b35" : "#60a5fa"} strokeWidth={isSelected ? "4" : needsWinner ? "3" : "2"}
                          strokeDasharray="100" strokeDashoffset="100" pathLength={100}>
                          <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.2s" begin={`${colIdx * 0.2}s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                          {needsWinner && !isSelected && (
                            <animate attributeName="stroke" values="#ff6b35;#ffffff;#ff6b35" dur="0.8s" repeatCount="indefinite" />
                          )}
                          {isSelected && (
                            <animate attributeName="stroke" values="#00ff99;#ffffff;#00ff99" dur="1.2s" repeatCount="indefinite" />
                          )}
                        </rect>
                        {/* Player selection indicators */}
                        {isSelected && (
                          <g>
                            <rect x={-8} y={isPlayer1Selected ? padY - 8 : padY - 8 + lineHeight} width={4} height={lineHeight} fill="#00ff99" rx={2}>
                              <animate attributeName="fill" values="#00ff99;#ffffff;#00ff99" dur="1.2s" repeatCount="indefinite" />
                            </rect>
                          </g>
                        )}
                        <text x={padX} y={padY + nameFontSize - 2} fill={isPlayer1Selected ? "#00ff99" : p1Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>
                          {p1 ? p1.display_name : '—'}
                          {needsWinner && p1 && !isSelected && (
                            <animate attributeName="fill" values="#ff6b35;#ffffff;#ff6b35" dur="0.8s" repeatCount="indefinite" />
                          )}
                          {isPlayer1Selected && (
                            <animate attributeName="fill" values="#00ff99;#ffffff;#00ff99" dur="1.2s" repeatCount="indefinite" />
                          )}
                        </text>
                        <text x={padX} y={padY + nameFontSize - 2 + lineHeight} fill={isPlayer2Selected ? "#00ff99" : p2Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>
                          {p2 ? p2.display_name : '—'}
                          {needsWinner && p2 && !isSelected && (
                            <animate attributeName="fill" values="#ff6b35;#ffffff;#ff6b35" dur="0.8s" repeatCount="indefinite" />
                          )}
                          {isPlayer2Selected && (
                            <animate attributeName="fill" values="#00ff99;#ffffff;#00ff99" dur="1.2s" repeatCount="indefinite" />
                          )}
                        </text>
                        {winner && (
                          <g>
                            <title>Winner</title>
                            <rect x={146} y={padY + nameFontSize - 22} width={44} height={16} rx={4} ry={4} fill="#00e0a4" stroke="#00ff99" />
                            <text x={168} y={padY + nameFontSize - 11} fill="white" fontSize={9} textAnchor="middle" style={{ pointerEvents: 'none' }}>Winner</text>
                          </g>
                        )}
                        {needsWinner && (
                          <g>
                            <title>Click a player name to select winner</title>
                            <text x={100} y={matchHeight + 18} fill="#ff6b35" fontSize={11} fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>
                              Click player name to pick winner
                              <animate attributeName="fill" values="#ff6b35;#ffffff;#ff6b35" dur="0.8s" repeatCount="indefinite" />
                            </text>
                          </g>
                        )}
                        {isWalkover && (
                          <g>
                            <title>Walkover</title>
                            <rect x={160} y={padY + nameFontSize + 6} width={28} height={16} rx={4} ry={4} fill="#00e0a4" stroke="#00ff99" />
                            <text x={174} y={padY + nameFontSize + 18} fill="#000000" fontSize={10} textAnchor="middle" style={{ pointerEvents: 'none' }}>WO</text>
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
                  const winnerColor = "#00e0a4";
                  let p1Color = "#fff";
                  let p2Color = "#fff";
                  if (winner) {
                    if (p1 && winner.id === p1?.id) p1Color = winnerColor; // p1 won
                    if (p2 && winner.id === p2?.id) p2Color = winnerColor; // p2 won
                    if (p1 && winner.id === p2?.id) p1Color = loserColor; // p1 lost
                    if (p2 && winner.id === p1?.id) p2Color = loserColor; // p2 lost
                  }
                  const padX = 24;
                  const padY = 12;
                  const nameFontSize = 20;
                  const lineHeight = 30;
                  const isHighlighted = !!highlightTarget && highlightTarget.round === m.round && highlightTarget.position === m.position;
                  const isSelected = adminMode && selectedMatchId === m.id;
                  const isWalkover = m.participant1_id && !m.participant2_id || !m.participant1_id && m.participant2_id;
                  const hasParticipants = m.participant1_id && m.participant2_id;
                  const needsWinner = hasParticipants && !m.winner_participant_id && adminMode;
                  const isPlayer1Selected = isSelected && selectedPlayerIndex === 0;
                  const isPlayer2Selected = isSelected && selectedPlayerIndex === 1;
                  return (
                    <g key={m.id} transform={`translate(${pos.x}, ${pos.y + 40})`}>
                      <g>
                        {/* Filled card */}
                        <rect x={0} y={0} width={200} height={matchHeight} rx={6} ry={6} fill={isSelected ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.7)"} className={isHighlighted ? 'boing' : ''} />
                        {/* Outline draw animation */}
                        <rect x={0} y={0} width={200} height={matchHeight} rx={6} ry={6}
                          fill="none" stroke={isSelected ? "#00ff99" : needsWinner ? "#ff6b35" : "#e879f9"} strokeWidth={isSelected ? "4" : needsWinner ? "3" : "2"}
                          strokeDasharray="100" strokeDashoffset="100" pathLength={100}>
                          <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.2s" begin={`${colIdx * 0.2}s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                          {needsWinner && !isSelected && (
                            <animate attributeName="stroke" values="#ff6b35;#ffffff;#ff6b35" dur="0.8s" repeatCount="indefinite" />
                          )}
                          {isSelected && (
                            <animate attributeName="stroke" values="#00ff99;#ffffff;#00ff99" dur="1.2s" repeatCount="indefinite" />
                          )}
                        </rect>
                        {/* Player selection indicators */}
                        {isSelected && (
                          <g>
                            <rect x={-8} y={isPlayer1Selected ? padY - 8 : padY - 8 + lineHeight} width={4} height={lineHeight} fill="#00ff99" rx={2}>
                              <animate attributeName="fill" values="#00ff99;#ffffff;#00ff99" dur="1.2s" repeatCount="indefinite" />
                            </rect>
                          </g>
                        )}
                        <text x={padX} y={padY + nameFontSize - 2} fill={isPlayer1Selected ? "#00ff99" : p1Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>
                          {p1 ? p1.display_name : '—'}
                          {needsWinner && p1 && !isSelected && (
                            <animate attributeName="fill" values="#ff6b35;#ffffff;#ff6b35" dur="0.8s" repeatCount="indefinite" />
                          )}
                          {isPlayer1Selected && (
                            <animate attributeName="fill" values="#00ff99;#ffffff;#00ff99" dur="1.2s" repeatCount="indefinite" />
                          )}
                        </text>
                        <text x={padX} y={padY + nameFontSize - 2 + lineHeight} fill={isPlayer2Selected ? "#00ff99" : p2Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>
                          {p2 ? p2.display_name : '—'}
                          {needsWinner && p2 && !isSelected && (
                            <animate attributeName="fill" values="#ff6b35;#ffffff;#ff6b35" dur="0.8s" repeatCount="indefinite" />
                          )}
                          {isPlayer2Selected && (
                            <animate attributeName="fill" values="#00ff99;#ffffff;#00ff99" dur="1.2s" repeatCount="indefinite" />
                          )}
                        </text>
                        {winner && (
                          <g>
                            <title>Winner</title>
                            <rect x={146} y={padY + nameFontSize - 22} width={44} height={16} rx={4} ry={4} fill="#00e0a4" stroke="#00ff99" />
                            <text x={168} y={padY + nameFontSize - 11} fill="white" fontSize={9} textAnchor="middle" style={{ pointerEvents: 'none' }}>Winner</text>
                          </g>
                        )}
                        {needsWinner && (
                          <g>
                            <title>Click a player name to select winner</title>
                            <text x={100} y={matchHeight + 18} fill="#ff6b35" fontSize={11} fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>
                              Click player name to pick winner
                              <animate attributeName="fill" values="#ff6b35;#ffffff;#ff6b35" dur="0.8s" repeatCount="indefinite" />
                            </text>
                          </g>
                        )}
                        {isWalkover && (
                          <g>
                            <title>Walkover</title>
                            <rect x={160} y={padY + nameFontSize + 6} width={28} height={16} rx={4} ry={4} fill="#00e0a4" stroke="#00ff99" />
                            <text x={174} y={padY + nameFontSize + 18} fill="#000000" fontSize={10} textAnchor="middle" style={{ pointerEvents: 'none' }}>WO</text>
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
              {list.map((m) => {
                const pos = matchPositions.get(m.id);
                if (!pos) return null;
                const p1 = m.participant1_id ? participants[m.participant1_id] : undefined;
                const p2 = m.participant2_id ? participants[m.participant2_id] : undefined;
                const winner = m.winner_participant_id ? participants[m.winner_participant_id] : undefined;
                const loserColor = "#ff4d4d";
                const winnerColor = "#00e0a4";
                let p1Color = "#fff";
                let p2Color = "#fff";
                if (winner) {
                  if (p1 && winner.id === p1?.id) p1Color = winnerColor; // p1 won
                  if (p2 && winner.id === p2?.id) p2Color = winnerColor; // p2 won
                  if (p1 && winner.id === p2?.id) p1Color = loserColor; // p1 lost
                  if (p2 && winner.id === p1?.id) p2Color = loserColor; // p2 lost
                }
                const padX = 24; const padY = 12; const nameFontSize = 20; const lineHeight = 30;
                const isWalkover = false; // Grand Final should never be a walkover - it's populated with both champions
                const hasParticipants = m.participant1_id && m.participant2_id;
                const needsWinner = hasParticipants && !m.winner_participant_id && adminMode;
                return (
                  <g key={m.id} transform={`translate(${pos.x}, ${pos.y + 40})`}>
                    <g>
                      {/* Filled card */}
                      <rect x={0} y={0} width={220} height={matchHeight} rx={8} ry={8} fill="rgba(0,0,0,0.7)" />
                      {/* Outline draw animation */}
                      <rect x={0} y={0} width={220} height={matchHeight} rx={8} ry={8}
                        fill="none" stroke={needsWinner ? "#ff6b35" : "#FFD700"} strokeWidth={needsWinner ? "4" : "2"}
                        strokeDasharray="100" strokeDashoffset="100" pathLength={100}>
                        <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.4s" begin={`0s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                        {needsWinner && (
                          <animate attributeName="stroke" values="#ff6b35;#ffffff;#ff6b35" dur="0.6s" repeatCount="indefinite" />
                        )}
                      </rect>
                      <text x={padX} y={padY + nameFontSize - 2} fill={p1Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>
                        {p1 ? p1.display_name : '—'}
                        {needsWinner && p1 && (
                          <animate attributeName="fill" values="#ff6b35;#ffffff;#ff6b35" dur="0.6s" repeatCount="indefinite" />
                        )}
                      </text>
                      <text x={padX} y={padY + nameFontSize - 2 + lineHeight} fill={p2Color} fontSize={nameFontSize} style={{ pointerEvents: 'none' }}>
                        {p2 ? p2.display_name : '—'}
                        {needsWinner && p2 && (
                          <animate attributeName="fill" values="#ff6b35;#ffffff;#ff6b35" dur="0.6s" repeatCount="indefinite" />
                        )}
                      </text>
                      {winner && (
                        <g>
                          <title>Winner</title>
                          <rect x={166} y={padY + nameFontSize - 22} width={44} height={16} rx={4} ry={4} fill="#00e0a4" stroke="#00ff99" />
                          <text x={188} y={padY + nameFontSize - 11} fill="white" fontSize={9} textAnchor="middle" style={{ pointerEvents: 'none' }}>Winner</text>
                        </g>
                      )}
                      {needsWinner && (
                        <g>
                          <title>Click a player name to crown champion</title>
                          <text x={110} y={matchHeight + 18} fill="#ff6b35" fontSize={12} fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>
                            Click player name to crown champion
                            <animate attributeName="fill" values="#ff6b35;#ffffff;#ff6b35" dur="0.6s" repeatCount="indefinite" />
                          </text>
                        </g>
                      )}
                      {isWalkover && (
                        <g>
                          <title>Walkover</title>
                          <rect x={180} y={padY + nameFontSize + 6} width={28} height={16} rx={4} ry={4} fill="#00e0a4" stroke="#00ff99" />
                          <text x={194} y={padY + nameFontSize + 18} fill="#000000" fontSize={10} textAnchor="middle" style={{ pointerEvents: 'none' }}>WO</text>
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
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      strokeDasharray="100" strokeDashoffset="100" pathLength={100}
                    >
                      <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.2s" begin={`${colIdx * 0.2 + 0.6}s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                    </path>
                  );
                })}
              </g>
            );
          })}

          {/* Losers connectors - traditional layout (left to right) */}
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

                  // Traditional losers bracket: connectors go right (left to right)
                  const x1 = losersOffsetX + colIdx * colWidth + 200; // Right edge of current match
                  const y1 = currentPos.centerY + 40; // Add round offset for proper centering
                  const x2 = losersOffsetX + (colIdx + 1) * colWidth; // Left edge of next match
                  const y2 = targetPos.centerY + 40; // Add round offset for proper centering
                  const midX = x1 + 40; // Horizontal segment length
                  const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

                  return (
                    <path
                      key={`${match.id}-l-connector`}
                      d={path}
                      stroke="#e879f9"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      strokeDasharray="100" strokeDashoffset="100" pathLength={100}
                    >
                      <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.2s" begin={`${colIdx * 0.2 + 0.6}s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                    </path>
                  );
                })}
              </g>
            );
          })}

          {/* Winners to Grand Final connector (from last winners round) */}
          {winnersRounds.length > 0 && grandRounds.length > 0 && (
            (() => {
              const lastWinners = winnersRounds[winnersRounds.length - 1][1];
              if (!lastWinners || lastWinners.length === 0) return null;
              const wm = lastWinners[0];
              const wPos = matchPositions.get(wm.id);
              const gfList = grandRounds[0][1];
              const gf = gfList && gfList[0];
              if (!wPos || !gf) return null;
              const gfPos = matchPositions.get(gf.id);
              if (!gfPos) return null;

              const winnersChampExists = wm.status === 'completed' && wm.winner_participant_id;
              const grandFinalHasParticipant = gf.participant1_id || gf.participant2_id;
              if (!winnersChampExists && !grandFinalHasParticipant) return null;

              // From winners bracket to grand final on the right
              const x1 = winnersOffsetX + (winnersRounds.length - 1) * colWidth + 200; // Right edge of last winners match
              const y1 = wPos.centerY + 40; // Add round offset for proper centering
              const x2 = finalX; // Left edge of GF
              const y2 = gfPos.centerY + 40; // Add round offset for proper centering

              // Create path going right then down/up to final
              const midX = x1 + 50;
              const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

              return (
                <path
                  key={`winners-to-gf`}
                  d={path}
                  stroke="#60a5fa"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  strokeDasharray="100" strokeDashoffset="100" pathLength={100}
                >
                  <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.4s" begin={`0.8s`} fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                </path>
              );
            })()
          )}

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

              // From losers bracket to grand final on the right
              const x1 = losersOffsetX + (losersRounds.length - 1) * colWidth + 200; // Right edge of last losers match
              const y1 = lPos.centerY + 40; // Add round offset for proper centering
              const x2 = finalX; // Left edge of GF
              const y2 = gfPos.centerY + 40; // Add round offset for proper centering

              // Create path going right then up to final
              const midX = x1 + 50;
              const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

              return (
                <path
                  key={`losers-to-gf`}
                  d={path}
                  stroke="#e879f9"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
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
});

export default BracketView;
