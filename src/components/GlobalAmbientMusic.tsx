import React, { useEffect, useRef, useCallback } from 'react';

// Musical scales and ambient system constants
const MUSICAL_SCALES = {
  pentatonic: [261.63, 293.66, 329.63, 392.00, 440.00], // C, D, E, G, A
  dorian: [261.63, 293.66, 311.13, 349.23, 392.00, 440.00, 493.88], // C, D, Eb, F, G, A, Bb
  harmonic_minor: [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 493.88], // C, D, Eb, F, G, Ab, B
};

interface MelodyState {
  currentScale: string;
}

const GlobalAmbientMusic: React.FC = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambienceMasterGainRef = useRef<GainNode | null>(null);
  const ambienceOscillatorsRef = useRef<OscillatorNode[]>([]);
  const ambienceGainsRef = useRef<GainNode[]>([]);
  const ambienceActiveRef = useRef(false);
  const melodyState = useRef<MelodyState>({ currentScale: 'pentatonic' });

  const startAmbienceSound = useCallback(() => {
    if (ambienceActiveRef.current || !audioContextRef.current) return;

    ambienceActiveRef.current = true;
    const ctx = audioContextRef.current;

    // Clear any existing oscillators
    ambienceOscillatorsRef.current.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    ambienceGainsRef.current.forEach(gain => gain.disconnect());
    ambienceOscillatorsRef.current = [];
    ambienceGainsRef.current = [];

    // Expanded ambient layers - increased to 15 for much more varied atmosphere
    const currentScale = MUSICAL_SCALES[melodyState.current.currentScale as keyof typeof MUSICAL_SCALES];
    const ambienceLayers = [
      // ESSENTIAL SPACESHIP HUMMING - Core atmosphere
      { freq: 60, volume: 0.35, type: 'sine' as OscillatorType, modDepth: 0.02, modRate: 0.08, tension: 'humming' }, // Deep engine hum
      { freq: 120, volume: 0.25, type: 'triangle' as OscillatorType, modDepth: 0.015, modRate: 0.12, tension: 'humming' }, // Ventilation system
      { freq: 180, volume: 0.15, type: 'sine' as OscillatorType, modDepth: 0.01, modRate: 0.06, tension: 'humming' }, // Generator harmonics
      { freq: 90, volume: 0.2, type: 'sawtooth' as OscillatorType, modDepth: 0.025, modRate: 0.09, tension: 'humming' }, // Low machinery
      { freq: 240, volume: 0.12, type: 'triangle' as OscillatorType, modDepth: 0.02, modRate: 0.14, tension: 'humming' }, // High systems

      // SUB-BASS FOUNDATION - Essential ominous foundation
      { freq: currentScale[0] * 0.2, volume: 0.25, type: 'sine' as OscillatorType, modDepth: 0.08, modRate: 0.05, tension: 'ominous' },
      { freq: currentScale[0] * 0.4, volume: 0.2, type: 'sine' as OscillatorType, modDepth: 0.06, modRate: 0.08, tension: 'ominous' },
      { freq: currentScale[1] * 0.3, volume: 0.18, type: 'triangle' as OscillatorType, modDepth: 0.1, modRate: 0.04, tension: 'ominous' },

      // TENSION BUILDERS - Core suspense elements
      { freq: currentScale[1] * 0.6, volume: 0.15, type: 'triangle' as OscillatorType, modDepth: 0.12, modRate: 0.18, tension: 'suspense' },
      { freq: currentScale[2] * 0.8, volume: 0.12, type: 'triangle' as OscillatorType, modDepth: 0.1, modRate: 0.15, tension: 'suspense' },
      { freq: currentScale[3] * 0.7, volume: 0.14, type: 'sawtooth' as OscillatorType, modDepth: 0.15, modRate: 0.22, tension: 'suspense' },

      // CINEMATIC LAYERS - Multiple epic elements for variety
      { freq: currentScale[0] * 1.2, volume: 0.1, type: 'triangle' as OscillatorType, modDepth: 0.15, modRate: 0.28, tension: 'epic' },
      { freq: currentScale[2] * 1.1, volume: 0.08, type: 'sine' as OscillatorType, modDepth: 0.18, modRate: 0.32, tension: 'epic' },

      // ETHEREAL WISPS - Mysterious floating elements for atmosphere
      { freq: currentScale[4] * 1.8, volume: 0.06, type: 'sine' as OscillatorType, modDepth: 0.25, modRate: 0.15, tension: 'ethereal' },
      { freq: currentScale[1] * 2.2, volume: 0.05, type: 'triangle' as OscillatorType, modDepth: 0.3, modRate: 0.11, tension: 'ethereal' },
    ];

    ambienceLayers.forEach((layer, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filterNode = ctx.createBiquadFilter();

      oscillator.type = layer.type;
      oscillator.frequency.setValueAtTime(layer.freq, ctx.currentTime);

      // DRAMATIC frequency modulation for cinematic tension
      const lfoGain = ctx.createGain();
      const lfo = ctx.createOscillator();

      // Tension-based modulation characteristics
      let modCharacter;
      switch ((layer as any).tension) {
        case 'humming':
          lfo.type = 'sine'; // Smooth, continuous hum
          modCharacter = { rate: layer.modRate, depth: layer.modDepth }; // Minimal modulation for stability
          break;
        case 'ominous':
          lfo.type = 'sine'; // Smooth, mysterious
          modCharacter = { rate: layer.modRate * 0.3, depth: layer.modDepth * 1.5 };
          break;
        case 'suspense':
          lfo.type = 'triangle'; // Building tension
          modCharacter = { rate: layer.modRate * 1.8, depth: layer.modDepth * 4.0 };
          break;
        case 'epic':
          lfo.type = 'sine'; // Heroic sweep
          modCharacter = { rate: layer.modRate * 0.6, depth: layer.modDepth * 3.2 };
          break;
        case 'ethereal':
          lfo.type = 'sine'; // Mystical waves
          modCharacter = { rate: layer.modRate * 0.4, depth: layer.modDepth * 6.0 };
          break;
        default:
          lfo.type = 'sine';
          modCharacter = { rate: layer.modRate, depth: layer.modDepth };
      }

      lfo.frequency.setValueAtTime(modCharacter.rate, ctx.currentTime);
      lfoGain.gain.setValueAtTime(layer.freq * modCharacter.depth, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfo.start();

      // DRAMATIC amplitude tremolo for intensity
      const ampLfoGain = ctx.createGain();
      const ampLfo = ctx.createOscillator();
      ampLfo.frequency.setValueAtTime(modCharacter.rate * 0.4, ctx.currentTime);
      ampLfo.type = 'sine';
      ampLfoGain.gain.setValueAtTime(layer.volume * 0.4, ctx.currentTime); // Much more dramatic amplitude variation

      ampLfo.connect(ampLfoGain);
      ampLfoGain.connect(gainNode.gain);
      ampLfo.start();

      // Add DRAMATIC filter sweeps for cinematic movement
      const filterLfoGain = ctx.createGain();
      const filterLfo = ctx.createOscillator();
      filterLfo.frequency.setValueAtTime(modCharacter.rate * 0.25, ctx.currentTime);
      filterLfo.type = 'triangle';
      filterLfoGain.gain.setValueAtTime(filterNode.frequency.value * 0.3, ctx.currentTime);

      filterLfo.connect(filterLfoGain);
      filterLfoGain.connect(filterNode.frequency);
      filterLfo.start();

      // DRAMATIC filtering based on tension character
      switch ((layer as any).tension) {
        case 'humming':
          filterNode.type = 'lowpass'; // Muffled spaceship hum
          filterNode.frequency.setValueAtTime(300 + index * 50, ctx.currentTime);
          filterNode.Q.setValueAtTime(0.8, ctx.currentTime); // Smooth filtering
          break;
        case 'ominous':
          filterNode.type = 'lowpass'; // Dark, brooding
          filterNode.frequency.setValueAtTime(200 + index * 80, ctx.currentTime);
          filterNode.Q.setValueAtTime(2.0, ctx.currentTime);
          break;
        case 'suspense':
          filterNode.type = 'bandpass'; // Focused tension
          filterNode.frequency.setValueAtTime(500 + index * 150, ctx.currentTime);
          filterNode.Q.setValueAtTime(4.0 + index * 1.0, ctx.currentTime);
          break;
        case 'epic':
          filterNode.type = 'peaking'; // Heroic presence
          filterNode.frequency.setValueAtTime(800 + index * 200, ctx.currentTime);
          filterNode.Q.setValueAtTime(3.0 + index * 0.5, ctx.currentTime);
          filterNode.gain.setValueAtTime(6.0, ctx.currentTime); // Boost for epic feel
          break;
        case 'ethereal':
          filterNode.type = 'highpass'; // Mystical highs
          filterNode.frequency.setValueAtTime(1000 + index * 300, ctx.currentTime);
          filterNode.Q.setValueAtTime(8.0 + index * 1.5, ctx.currentTime); // Maximum drama
          break;
        default:
          filterNode.type = 'lowpass';
          filterNode.frequency.setValueAtTime(400 + index * 100, ctx.currentTime);
          filterNode.Q.setValueAtTime(1.0, ctx.currentTime);
      }

      // DRAMATIC entrance based on tension type
      gainNode.gain.setValueAtTime(0, ctx.currentTime);

      let entranceTime;
      switch ((layer as any).tension) {
        case 'humming':
          entranceTime = 0.5 + index * 0.2; // Quick, steady build like systems coming online
          break;
        case 'ominous':
          entranceTime = 3 + index * 0.8; // Slow, menacing build
          break;
        case 'suspense':
          entranceTime = 0.2 + index * 0.1; // Quick, startling entrance
          break;
        case 'epic':
          entranceTime = 5 + index * 1.2; // Grand, sweeping entrance
          break;
        case 'ethereal':
          entranceTime = 8 + index * 2.0; // Mystical, gradual appearance
          break;
        default:
          entranceTime = 1 + index * 0.3;
      }

      gainNode.gain.exponentialRampToValueAtTime(layer.volume, ctx.currentTime + entranceTime);

      // Connect chain: oscillator -> filter -> gain -> reverb -> destination
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(ambienceMasterGainRef.current!); // Connect to dedicated ambient bus

      oscillator.start();

      ambienceOscillatorsRef.current.push(oscillator);
      ambienceGainsRef.current.push(gainNode);

      // Add subtle volume fluctuations (never silent)
      const addFluctuation = () => {
        if (!ambienceActiveRef.current) {
          return;
        }

        // DRAMATIC volume fluctuations based on tension type
        let dramaDynamics;
        switch ((layer as any).tension) {
          case 'humming':
            dramaDynamics = {
              variation: 0.15, // Very stable for continuous hum
              minVolume: layer.volume * 0.9, // Almost constant
              maxVolume: layer.volume * 1.1, // Tiny fluctuations
              duration: Math.random() * 8 + 5, // 5-13 second slow changes
            };
            break;
          case 'ominous':
            dramaDynamics = {
              variation: 0.4, // Subtle swells
              minVolume: layer.volume * 0.6, // Stays audible
              maxVolume: layer.volume * 1.2, // Gentle peaks
              duration: Math.random() * 3 + 2, // 2-5 second swells
            };
            break;
          case 'suspense':
            dramaDynamics = {
              variation: 0.5, // Moderate variation
              minVolume: layer.volume * 0.5, // Subtle dips
              maxVolume: layer.volume * 1.3, // Modest peaks
              duration: Math.random() * 2 + 1, // 1-3 second tension builds
            };
            break;
          case 'epic':
            dramaDynamics = {
              variation: 0.4, // Gentle swells
              minVolume: layer.volume * 0.7, // Always present
              maxVolume: layer.volume * 1.2, // Subtle heroic peaks
              duration: Math.random() * 4 + 3, // 3-7 second epic builds
            };
            break;
          case 'ethereal':
            dramaDynamics = {
              variation: 0.6, // Mystical waves
              minVolume: layer.volume * 0.4, // Can fade mysteriously
              maxVolume: layer.volume * 1.2, // Gentle ethereal peaks
              duration: Math.random() * 6 + 4, // 4-10 second ethereal waves
            };
            break;
          default:
            dramaDynamics = {
              variation: 0.6,
              minVolume: layer.volume * 0.4,
              maxVolume: layer.volume * 1.2,
              duration: Math.random() * 2 + 1,
            };
        }

        const randomVolume = Math.random() * (dramaDynamics.maxVolume - dramaDynamics.minVolume) + dramaDynamics.minVolume;
        const fluctuationDuration = dramaDynamics.duration;
        const randomTime = ctx.currentTime + fluctuationDuration;

        try {
          gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, randomVolume), randomTime);
        } catch (e) {}

        // Schedule next dramatic event with tension-specific timing
        const nextDelay = fluctuationDuration + (Math.random() * 1 - 0.5); // ±500ms variation for drama
        setTimeout(addFluctuation, nextDelay * 1000);
      };

      addFluctuation(); // Start fluctuation immediately

      // Add SLOW FREQUENCY EVOLUTION to break loop feeling
      const addFrequencyEvolution = () => {
        if (!ambienceActiveRef.current) return;

        // Slowly evolve frequency over long periods to create organic changes
        const baseFreq = layer.freq;
        const evolutionAmount = baseFreq * (0.02 + Math.random() * 0.06); // 2-8% frequency drift
        const direction = Math.random() > 0.5 ? 1 : -1;
        const newFreq = baseFreq + (evolutionAmount * direction);
        const evolutionTime = 30 + Math.random() * 60; // 30-90 second slow evolution

        try {
          oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(20, Math.min(2000, newFreq)), // Keep in reasonable range
            ctx.currentTime + evolutionTime
          );
        } catch (e) {}

        // Schedule next evolution with randomized timing
        const nextEvolutionDelay = evolutionTime + (Math.random() * 20 - 10); // ±10 second variation
        setTimeout(addFrequencyEvolution, nextEvolutionDelay * 1000);
      };

      // Start frequency evolution after initial entrance, with staggered timing per layer
      setTimeout(addFrequencyEvolution, (index * 5 + Math.random() * 10) * 1000);
    });

    // Restart oscillators every 5 minutes to ensure they never end
    const restartInterval = setInterval(() => {
      if (ambienceActiveRef.current) {
        stopAmbienceSound();
        setTimeout(() => startAmbienceSound(), 100);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }, []);

  const stopAmbienceSound = useCallback(() => {
    if (!ambienceActiveRef.current) return;

    ambienceActiveRef.current = false;

    // Fade out and stop all oscillators
    ambienceGainsRef.current.forEach((gain, index) => {
      try {
        gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current!.currentTime + 2);
      } catch (e) {}
    });

    setTimeout(() => {
      ambienceOscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      ambienceGainsRef.current.forEach(gain => gain.disconnect());
      ambienceOscillatorsRef.current = [];
      ambienceGainsRef.current = [];
    }, 2500);
  }, []);

  // Initialize audio context and start ambient music
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Create ambient master gain
        ambienceMasterGainRef.current = audioContextRef.current.createGain();
        ambienceMasterGainRef.current.gain.setValueAtTime(0.5, audioContextRef.current.currentTime); // Raised ambient music volume significantly
        ambienceMasterGainRef.current.connect(audioContextRef.current.destination);
      }

      // Resume audio context if suspended (required for some browsers)
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      // Start ambient music
      if (!ambienceActiveRef.current) {
        startAmbienceSound();
      }
    };

    // Start on first user interaction (click anywhere)
    const handleFirstInteraction = () => {
      initAudio();
      // Remove the listener after first interaction
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    // Add listeners for first user interaction
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      stopAmbienceSound();
    };
  }, [startAmbienceSound, stopAmbienceSound]);

  // Handle page visibility changes to pause/resume music
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, pause music
        if (ambienceActiveRef.current && audioContextRef.current?.state === 'running') {
          audioContextRef.current.suspend();
        }
      } else {
        // Page is visible again, resume music
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        // Restart ambient music if it's not active
        if (!ambienceActiveRef.current) {
          startAmbienceSound();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [startAmbienceSound]);

  return null; // This component doesn't render anything visible
};

export default GlobalAmbientMusic;