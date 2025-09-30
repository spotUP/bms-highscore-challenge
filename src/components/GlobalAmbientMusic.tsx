import React, { useEffect, useRef, useCallback, useState } from 'react';

// Dynamic Tone.js import - don't load until user interaction
let Tone: any = null;

// Generative music pieces using Tone.js (no external samples required)
const AVAILABLE_PIECES = [
  { id: 'space-atmosphere', title: 'Space Atmosphere', mood: 'space' },
  { id: 'cosmic-chords', title: 'Cosmic Chords', mood: 'spacey' },
  { id: 'crystal-cascade', title: 'Crystal Cascade', mood: 'sparkle' },
  { id: 'doom-drone', title: 'Doom Drone', mood: 'dark' },
  { id: 'space-drone', title: 'Space Drone', mood: 'dystopian' },
  { id: 'homeward-bound', title: 'Homeward Bound', mood: 'hopeful' },
  { id: 'distant-memories', title: 'Distant Memories', mood: 'nostalgic' },
  { id: 'stellar-solitude', title: 'Stellar Solitude', mood: 'lonely' },
  { id: 'earths-embrace', title: 'Earth\'s Embrace', mood: 'warm' },
  { id: 'cosmic-longing', title: 'Cosmic Longing', mood: 'melancholic' },
  { id: 'cosmic-whale', title: 'Cosmic Whale', mood: 'oceanic' },
  { id: 'earth-approach', title: 'Earth Approach', mood: 'joyful' },
];

interface GenerativeMusicState {
  currentPieceId: string | null;
  isPlaying: boolean;
  volume: number;
}

interface MusicAnalysisData {
  volume: number;      // 0-1 current volume level
  disharmonic: number; // 0-1 disharmonic intensity (based on spectral analysis)
  beat: number;        // 0-1 beat intensity
}

const GlobalAmbientMusic: React.FC = () => {
  // Pick a random piece at initialization
  const randomPiece = AVAILABLE_PIECES[Math.floor(Math.random() * AVAILABLE_PIECES.length)];

  const [musicState, setMusicState] = useState<GenerativeMusicState>({
    currentPieceId: randomPiece.id,
    isPlaying: false,
    volume: 0.6,
  });

  const currentPieceRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const sampleLibraryRef = useRef<any>(null);
  const analyserRef = useRef<any | null>(null);
  const fftRef = useRef<any | null>(null);
  const analysisDataRef = useRef<MusicAnalysisData>({ volume: 0, disharmonic: 0, beat: 0 });

  const initializeTone = useCallback(async () => {
    if (isInitializedRef.current) return;

    // Load Tone.js dynamically on first user interaction
    if (!Tone) {
      const ToneModule = await import('tone');
      Tone = ToneModule.default || ToneModule;
    }

    try {
      await Tone.start();

      // Create analyzers for music reactivity
      analyserRef.current = new Tone.Analyser('waveform', 256);
      fftRef.current = new Tone.FFT(512);

      // Connect destination to analyzers
      Tone.getDestination().connect(analyserRef.current);
      Tone.getDestination().connect(fftRef.current);

      isInitializedRef.current = true;
    } catch (error) {
      console.error('[GENERATIVE MUSIC] Failed to start Tone.js:', error);
    }
  }, []);

  const createAmbientDrone = useCallback(() => {
    // Multiple oscillators for rich ambient drone
    const synths = [];
    const notes = ['C2', 'Eb2', 'G2', 'Bb2', 'D3'];

    notes.forEach((note, i) => {
      const gain = new Tone.Gain(0.08 - i * 0.01).toDestination();
      const synth = new Tone.Oscillator({
        frequency: note,
        type: 'sine'
      }).connect(gain);

      synth.start();
      synths.push({ synth, gain });
    });

    return synths;
  }, []);

  const createMeditationBells = useCallback(() => {
    const gain = new Tone.Gain(0.4).toDestination();
    const synth = new Tone.MetalSynth({
      frequency: 440,
      envelope: {
        attack: 0.001,
        decay: 1.4,
        sustain: 0.1,
        release: 1.4
      },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).connect(gain);

    const notes = ['C4', 'E4', 'G4', 'C5'];

    const pattern = new Tone.Pattern((time, note) => {
      synth.triggerAttackRelease(note, '1n', time);
    }, notes, 'random');

    pattern.interval = '4n';
    pattern.start(0);

    return [{ synth, pattern, gain }];
  }, []);

  const createSpaceAtmosphere = useCallback(async () => {
    const reverb = new Tone.Reverb(4);
    await reverb.generate();

    const gain = new Tone.Gain(0.3).toDestination();
    reverb.connect(gain);

    const synth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 2, decay: 0.5, sustain: 0.8, release: 4 }
    }).connect(reverb);

    const notes = ['C2', 'Eb2', 'F2', 'Ab2'];
    let noteIndex = 0;

    const pattern = new Tone.Loop((time) => {
      synth.triggerAttackRelease(notes[noteIndex % notes.length], '1m', time);
      noteIndex++;
    }, '2m');

    pattern.start(0);

    return [{ synth, pattern, reverb, gain }];
  }, []);

  const createMinimalPiano = useCallback(() => {
    const gain = new Tone.Gain(0.5).toDestination();
    const piano = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.1, release: 1.5 }
    }).connect(gain);

    const notes = ['C4', 'Eb4', 'F4', 'G4', 'Bb4'];

    const pattern = new Tone.Pattern((time, note) => {
      if (Math.random() > 0.6) {
        piano.triggerAttackRelease(note, '8n', time);
      }
    }, notes, 'random');

    pattern.interval = '4n';
    pattern.start(0);

    return [{ synth: piano, pattern, gain }];
  }, []);

  const createCosmicChords = useCallback(async () => {
    const reverb = new Tone.Reverb(3).toDestination();
    await reverb.generate();

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 1, decay: 0.5, sustain: 0.8, release: 3 }
    }).connect(reverb);

    const chords = [
      ['C3', 'E3', 'G3', 'B3'],
      ['F3', 'A3', 'C4', 'E4'],
      ['G2', 'B2', 'D3', 'F3'],
      ['A2', 'C3', 'E3', 'G3']
    ];

    const loop = new Tone.Loop((time) => {
      const chord = chords[Math.floor(Math.random() * chords.length)];
      synth.triggerAttackRelease(chord, '2m', time);
    }, '4m');
    loop.start(0);

    return [{ synth, loop, reverb }];
  }, []);

  const createForestRain = useCallback(() => {
    const noise = new Tone.Noise('pink').start();
    const filter = new Tone.AutoFilter({
      frequency: 0.15,
      type: 'sine',
      depth: 1,
      baseFrequency: 800,
      octaves: 2.6
    }).toDestination().start();

    const gain = new Tone.Gain(0.2).connect(filter);
    noise.connect(gain);

    return [{ synth: noise, filter, gain }];
  }, []);

  const createDeepOcean = useCallback(() => {
    const synths = [];
    const notes = ['C1', 'E1', 'G1', 'C2'];

    notes.forEach((note, i) => {
      const lfo = new Tone.LFO(0.05 + i * 0.01, 0.5, 1);
      const gain = new Tone.Gain(0.15).toDestination();
      lfo.connect(gain.gain);
      lfo.start();

      const osc = new Tone.Oscillator({
        frequency: note,
        type: 'sine'
      }).connect(gain).start();

      synths.push({ synth: osc, lfo, gain });
    });

    return synths;
  }, []);

  const createDigitalDreams = useCallback(async () => {
    const delay = new Tone.FeedbackDelay('8n', 0.4).toDestination();
    const reverb = new Tone.Reverb(2).connect(delay);
    await reverb.generate();

    const synth = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 10,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.5 }
    }).connect(reverb);

    const notes = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'];

    const pattern = new Tone.Pattern((time, note) => {
      if (Math.random() > 0.3) {
        synth.triggerAttackRelease(note, '16n', time);
      }
    }, notes, 'randomOnce');
    pattern.interval = '8n';
    pattern.start(0);

    return [{ synth, pattern, reverb, delay }];
  }, []);

  const createEtherealVoices = useCallback(async () => {
    const reverb = new Tone.Reverb(5).toDestination();
    await reverb.generate();

    const synth = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 2, decay: 1, sustain: 0.5, release: 3 }
    }).connect(reverb);

    const notes = ['C4', 'Eb4', 'G4', 'Bb4', 'D5'];

    const loop = new Tone.Loop((time) => {
      const note = notes[Math.floor(Math.random() * notes.length)];
      synth.triggerAttackRelease(note, '4m', time);
    }, '8m');
    loop.start(0);

    return [{ synth, loop, reverb }];
  }, []);

  const createCrystalCascade = useCallback(() => {
    const reverb = new Tone.Reverb(2).toDestination();
    reverb.generate();

    const synth = new Tone.MetalSynth({
      frequency: 880,
      envelope: { attack: 0.001, decay: 0.8, release: 0.8 },
      harmonicity: 8,
      modulationIndex: 20,
      resonance: 8000,
      octaves: 2
    }).connect(reverb);

    const notes = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'];

    const pattern = new Tone.Pattern((time, note) => {
      if (Math.random() > 0.7) {
        synth.triggerAttackRelease(note, '32n', time);
      }
    }, notes, 'random');
    pattern.interval = '16n';
    pattern.start(0);

    return [{ synth, pattern, reverb }];
  }, []);

  const createWarmBass = useCallback(() => {
    const filter = new Tone.Filter(200, 'lowpass').toDestination();
    const lfo = new Tone.LFO(0.1, 150, 300).start();
    lfo.connect(filter.frequency);

    const synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 2 }
    }).connect(filter);

    const notes = ['C2', 'F2', 'G2', 'Bb2'];

    const loop = new Tone.Loop((time) => {
      const note = notes[Math.floor(Math.random() * notes.length)];
      synth.triggerAttackRelease(note, '1m', time);
    }, '2m');
    loop.start(0);

    return [{ synth, loop, filter, lfo }];
  }, []);

  const createClockwork = useCallback(() => {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' }
    }).toDestination();

    const notes = ['C3', 'C4', 'G3', 'E3'];
    let index = 0;

    const pattern = new Tone.Pattern((time, note) => {
      synth.triggerAttackRelease(note, '32n', time);
      index = (index + 1) % notes.length;
    }, notes, 'up');
    pattern.interval = '4n';
    pattern.start(0);

    return [{ synth, pattern }];
  }, []);

  const createDoomDrone = useCallback(async () => {
    // Heavy distortion chain
    const distortion = new Tone.Distortion(0.4);
    const reverb = new Tone.Reverb(4);
    await reverb.generate();
    const filter = new Tone.Filter(300, 'lowpass');

    // Chain effects
    const mainGain = new Tone.Gain(0.5).toDestination();
    distortion.connect(filter);
    filter.connect(reverb);
    reverb.connect(mainGain);

    // Heavy synth for power chords
    const powerSynth = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 1, decay: 0.3, sustain: 0.9, release: 3 },
      filterEnvelope: { attack: 0.5, decay: 0.1, sustain: 0.8, release: 2 }
    }).connect(distortion);

    // Doom chord progression - power chords
    const chords = [
      ['C1', 'C2', 'G2'],
      ['Ab1', 'Ab2', 'Eb2'],
      ['F1', 'F2', 'C2'],
      ['Bb1', 'Bb2', 'F2']
    ];

    let chordIndex = 0;

    const loop = new Tone.Loop((time) => {
      const chord = chords[chordIndex % chords.length];
      powerSynth.triggerAttackRelease(chord, '2m', time);
      chordIndex++;
    }, '4m');

    loop.start(0);

    // Continuous sub-bass drone
    const subGain = new Tone.Gain(0.3).toDestination();
    const subBass = new Tone.Oscillator('C1', 'sine').connect(subGain).start();

    // Slow LFO on sub-bass for movement
    const lfo = new Tone.LFO(0.05, 0.2, 0.4);
    lfo.connect(subGain.gain);
    lfo.start();

    return [{ synth: powerSynth, loop, distortion, reverb, filter, mainGain, subBass, subGain, lfo }];
  }, []);

  const createSpaceDrone = useCallback(async () => {
    // Massive reverb for space atmosphere
    const spaceReverb = new Tone.Reverb(10);
    await spaceReverb.generate();
    const distortion = new Tone.Distortion(0.2);
    const delay = new Tone.PingPongDelay('8n', 0.5);

    const mainGain = new Tone.Gain(0.4).toDestination();
    distortion.connect(spaceReverb);
    spaceReverb.connect(delay);
    delay.connect(mainGain);

    // Doom-style drone base
    const droneSynth = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 2, decay: 0.5, sustain: 0.9, release: 4 },
      filterEnvelope: { attack: 1, decay: 0.2, sustain: 0.7, release: 3 }
    }).connect(distortion);

    // Dystopian chord progression
    const chords = [
      ['C1', 'Eb2', 'Gb2'],  // Diminished - unsettling
      ['G1', 'Bb2', 'Db2'],
      ['Ab1', 'B2', 'D2'],
      ['F1', 'Ab2', 'Cb2']
    ];

    let chordIndex = 0;

    const droneLoop = new Tone.Loop((time) => {
      const chord = chords[chordIndex % chords.length];
      droneSynth.triggerAttackRelease(chord, '3m', time);
      chordIndex++;
    }, '6m');

    droneLoop.start(0);

    // Crystal metallic sounds for lonely atmosphere
    const crystalReverb = new Tone.Reverb(6);
    await crystalReverb.generate();
    const crystalGain = new Tone.Gain(0.15).toDestination();
    crystalReverb.connect(crystalGain);

    const crystalSynth = new Tone.MetalSynth({
      frequency: 1760,
      envelope: { attack: 0.001, decay: 2, release: 3 },
      harmonicity: 12,
      modulationIndex: 30,
      resonance: 6000,
      octaves: 2
    }).connect(crystalReverb);

    const crystalNotes = ['C6', 'Eb6', 'Gb6', 'Bb6', 'Db7'];

    const crystalPattern = new Tone.Pattern((time, note) => {
      if (Math.random() > 0.85) { // Sparse, lonely
        crystalSynth.triggerAttackRelease(note, '16n', time);
      }
    }, crystalNotes, 'random');
    crystalPattern.interval = '4n';
    crystalPattern.start(0);

    // Deep space sub-bass with detuned oscillators
    const subGain = new Tone.Gain(0.25).toDestination();
    const subBass1 = new Tone.Oscillator('C1', 'sine').connect(subGain).start();
    const subBass2 = new Tone.Oscillator('C1', 'sine').connect(subGain);
    subBass2.detune.value = -7; // Slight detune for thickness
    subBass2.start();

    // Slow LFO for breathing effect
    const subLfo = new Tone.LFO(0.03, 0.15, 0.35);
    subLfo.connect(subGain.gain);
    subLfo.start();

    // Atmospheric noise layer
    const noise = new Tone.Noise('pink');
    const noiseFilter = new Tone.Filter(400, 'lowpass');
    const noiseGain = new Tone.Gain(0.08).toDestination();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noise.start();

    // LFO on noise for wind-like movement
    const noiseLfo = new Tone.LFO(0.08, 0.05, 0.12);
    noiseLfo.connect(noiseGain.gain);
    noiseLfo.start();

    return [{
      droneSynth,
      droneLoop,
      crystalSynth,
      crystalPattern,
      subBass1,
      subBass2,
      noise,
      distortion,
      spaceReverb,
      delay,
      mainGain,
      subGain,
      subLfo,
      crystalReverb,
      crystalGain,
      noiseFilter,
      noiseGain,
      noiseLfo
    }];
  }, []);

  const createHomewardBound = useCallback(async () => {
    // Hopeful journey home - warm major chords with space atmosphere
    const reverb = new Tone.Reverb(8);
    await reverb.generate();
    const chorus = new Tone.Chorus(2, 2.5, 0.5).start();

    const mainGain = new Tone.Gain(0.45).toDestination();
    chorus.connect(reverb);
    reverb.connect(mainGain);

    // Warm pad synth for hope
    const padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 3, decay: 1, sustain: 0.8, release: 5 }
    }).connect(chorus);

    // Major, hopeful progression
    const chords = [
      ['C3', 'E3', 'G3', 'C4'],  // C major - home
      ['F3', 'A3', 'C4', 'F4'],  // F major - journey
      ['G3', 'B3', 'D4', 'G4'],  // G major - hope
      ['A3', 'C4', 'E4', 'A4']   // A minor - longing
    ];

    let chordIndex = 0;
    const chordLoop = new Tone.Loop((time) => {
      padSynth.triggerAttackRelease(chords[chordIndex % chords.length], '4m', time);
      chordIndex++;
    }, '6m');
    chordLoop.start(0);

    // Gentle melodic twinkling - like stars guiding home
    const melody = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.5, decay: 0.8, sustain: 0.2, release: 2 }
    }).connect(reverb);

    const melodyNotes = ['E5', 'G5', 'C6', 'B5', 'A5', 'G5', 'E5', 'C5'];
    const melodyPattern = new Tone.Pattern((time, note) => {
      if (Math.random() > 0.6) {
        melody.triggerAttackRelease(note, '4n', time, 0.3);
      }
    }, melodyNotes, 'up');
    melodyPattern.interval = '2n';
    melodyPattern.start(0);

    // Deep space drone base
    const droneGain = new Tone.Gain(0.2).toDestination();
    const drone = new Tone.Oscillator('C2', 'sine').connect(droneGain).start();

    return [{ padSynth, melody, drone, chordLoop, melodyPattern, reverb, chorus, mainGain, droneGain }];
  }, []);

  const createDistantMemories = useCallback(async () => {
    // Nostalgic, bittersweet memories of Earth
    const reverb = new Tone.Reverb(12);
    await reverb.generate();
    const delay = new Tone.FeedbackDelay('4n', 0.6);

    const mainGain = new Tone.Gain(0.4).toDestination();
    delay.connect(reverb);
    reverb.connect(mainGain);

    // Melancholic piano-like sound
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 1.5, sustain: 0.3, release: 3 }
    }).connect(delay);

    // Minor, wistful melody
    const notes = ['A4', 'C5', 'E5', 'D5', 'C5', 'A4', 'G4', 'E4'];
    let noteIndex = 0;

    const memoryLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.3) {
        piano.triggerAttackRelease(notes[noteIndex % notes.length], '2n', time, 0.5);
        noteIndex++;
      }
    }, '1m');
    memoryLoop.start(0);

    // Warm bass remembering home
    const bassGain = new Tone.Gain(0.25).toDestination();
    const bass = new Tone.Oscillator('A1', 'sine').connect(bassGain).start();

    const bassLfo = new Tone.LFO(0.04, 0.2, 0.3);
    bassLfo.connect(bassGain.gain);
    bassLfo.start();

    return [{ piano, bass, memoryLoop, reverb, delay, mainGain, bassGain, bassLfo }];
  }, []);

  const createStellarSolitude = useCallback(async () => {
    // Pure loneliness in vast space
    const reverb = new Tone.Reverb(15);
    await reverb.generate();

    const mainGain = new Tone.Gain(0.35).toDestination();
    reverb.connect(mainGain);

    // Isolated single notes echoing in void
    const loneSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 1, decay: 3, sustain: 0.1, release: 8 }
    }).connect(reverb);

    const lonelyNotes = ['C4', 'Eb4', 'F4', 'Ab4'];

    const solitudeLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.7) { // Very sparse
        const note = lonelyNotes[Math.floor(Math.random() * lonelyNotes.length)];
        loneSynth.triggerAttackRelease(note, '1m', time, 0.4);
      }
    }, '8m');
    solitudeLoop.start(0);

    // Deep emptiness
    const voidGain = new Tone.Gain(0.15).toDestination();
    const void1 = new Tone.Oscillator('C1', 'sine').connect(voidGain).start();
    const void2 = new Tone.Oscillator('G1', 'sine').connect(voidGain).start();

    // Breathing effect - like breathing in spacesuit
    const breathLfo = new Tone.LFO(0.02, 0.1, 0.2);
    breathLfo.connect(voidGain.gain);
    breathLfo.start();

    return [{ loneSynth, void1, void2, solitudeLoop, reverb, mainGain, voidGain, breathLfo }];
  }, []);

  const createEarthsEmbrace = useCallback(async () => {
    // Warm, comforting thoughts of family and home
    const reverb = new Tone.Reverb(6);
    await reverb.generate();
    const phaser = new Tone.Phaser({
      frequency: 0.5,
      octaves: 3,
      baseFrequency: 350
    });
    phaser.toDestination();

    const mainGain = new Tone.Gain(0.5).toDestination();
    reverb.connect(phaser);

    // Rich, warm major chords
    const warmSynth = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 2, decay: 1, sustain: 0.9, release: 4 }
    }).connect(reverb);

    // Warm, loving progression
    const homeChords = [
      ['C3', 'E3', 'G3', 'B3'],
      ['F3', 'A3', 'C4', 'E4'],
      ['G3', 'B3', 'D4', 'F4'],
      ['C3', 'E3', 'G3', 'C4']
    ];

    let homeIndex = 0;
    const embraceLoop = new Tone.Loop((time) => {
      warmSynth.triggerAttackRelease(homeChords[homeIndex % homeChords.length], '3m', time);
      homeIndex++;
    }, '5m');
    embraceLoop.start(0);

    // Heartbeat bass - family's love
    const heartGain = new Tone.Gain(0.3).toDestination();
    const heartbeat = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 2,
      oscillator: { type: 'sine' }
    }).connect(heartGain);

    const pulse = new Tone.Loop((time) => {
      heartbeat.triggerAttackRelease('C1', '8n', time);
    }, '2m');
    pulse.start(0);

    return [{ warmSynth, heartbeat, embraceLoop, pulse, reverb, phaser, mainGain, heartGain }];
  }, []);

  const createCosmicLonging = useCallback(async () => {
    // Melancholic yearning for Earth from deep space
    const reverb = new Tone.Reverb(10);
    await reverb.generate();
    const tremolo = new Tone.Tremolo(0.5, 0.7).start();

    const mainGain = new Tone.Gain(0.42).toDestination();
    tremolo.connect(reverb);
    reverb.connect(mainGain);

    // Yearning string-like synth
    const strings = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 2.5, decay: 1, sustain: 0.8, release: 6 }
    }).connect(tremolo);

    // Minor, yearning progression
    const longingChords = [
      ['A2', 'C3', 'E3', 'A3'],
      ['F2', 'A2', 'C3', 'F3'],
      ['C3', 'E3', 'G3', 'C4'],
      ['G2', 'B2', 'D3', 'G3']
    ];

    let longingIndex = 0;
    const yearnLoop = new Tone.Loop((time) => {
      strings.triggerAttackRelease(longingChords[longingIndex % longingChords.length], '4m', time);
      longingIndex++;
    }, '7m');
    yearnLoop.start(0);

    // Space drone with sadness
    const sadDroneGain = new Tone.Gain(0.2).toDestination();
    const sadDrone1 = new Tone.Oscillator('A1', 'sine').connect(sadDroneGain).start();
    const sadDrone2 = new Tone.Oscillator('E2', 'sine').connect(sadDroneGain).start();

    const sadLfo = new Tone.LFO(0.03, 0.15, 0.25);
    sadLfo.connect(sadDroneGain.gain);
    sadLfo.start();

    // Occasional bell-like memory
    const memoryBell = new Tone.MetalSynth({
      frequency: 880,
      envelope: { attack: 0.001, decay: 2, release: 3 },
      harmonicity: 8,
      modulationIndex: 20,
      resonance: 4000
    }).connect(reverb);

    const bellPattern = new Tone.Pattern((time, note) => {
      if (Math.random() > 0.9) {
        memoryBell.triggerAttackRelease(note, '16n', time, 0.2);
      }
    }, ['E5', 'A5', 'C6'], 'random');
    bellPattern.interval = '2n';
    bellPattern.start(0);

    return [{ strings, sadDrone1, sadDrone2, memoryBell, yearnLoop, bellPattern, reverb, tremolo, mainGain, sadDroneGain, sadLfo }];
  }, []);

  const createCosmicWhale = useCallback(async () => {
    // Lonely whale in outer space - underwater atmosphere meets cosmic void
    const massiveReverb = new Tone.Reverb(18); // Extremely deep space/ocean reverb
    await massiveReverb.generate();
    const echoDelay = new Tone.FeedbackDelay('4n', 0.8); // Long haunting echoes
    const underwaterFilter = new Tone.Filter(800, 'lowpass'); // Muffled underwater feeling

    const mainGain = new Tone.Gain(0.5).toDestination();
    echoDelay.connect(massiveReverb);
    massiveReverb.connect(underwaterFilter);
    underwaterFilter.connect(mainGain);

    // Whale cry - deep, mournful FM synthesis
    const whaleCry = new Tone.FMSynth({
      harmonicity: 1.2,
      modulationIndex: 8,
      oscillator: { type: 'sine' },
      envelope: { attack: 3, decay: 4, sustain: 0.3, release: 8 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 2, decay: 2, sustain: 0.5, release: 6 }
    }).connect(echoDelay);

    // Whale song notes - deep, emotional cries
    const whaleNotes = ['G1', 'A1', 'C2', 'D2', 'E2', 'G2'];
    let lastCryTime = -10; // Start immediately

    const cryLoop = new Tone.Loop((time) => {
      const now = Tone.getTransport().seconds;
      // Cry every 8-12 seconds - more frequent so you can hear it
      if (now - lastCryTime > 8 + Math.random() * 4) {
        const note = whaleNotes[Math.floor(Math.random() * whaleNotes.length)];
        const duration = 4 + Math.random() * 6; // Long, sustained cries
        whaleCry.triggerAttackRelease(note, duration, time, 0.8); // Increased volume
        lastCryTime = now;
      }
    }, '1m'); // Check more frequently
    cryLoop.start(0);

    // Sonar pings - metallic, eerie
    const sonar = new Tone.MetalSynth({
      frequency: 300,
      envelope: { attack: 0.001, decay: 0.4, release: 0.6 },
      harmonicity: 12,
      modulationIndex: 20,
      resonance: 4000,
      octaves: 1
    }).connect(echoDelay);

    const sonarPattern = new Tone.Pattern((time) => {
      if (Math.random() > 0.7) { // 30% chance - occasional sonar
        sonar.triggerAttackRelease('16n', time, 0.2);
      }
    }, ['C4'], 'up');
    sonarPattern.interval = '4m';
    sonarPattern.start(0);

    // Bubble sounds - high pitched plinks
    const bubbleGain = new Tone.Gain(0.15).connect(massiveReverb);
    const bubbles = new Tone.MetalSynth({
      frequency: 800,
      envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
      harmonicity: 8,
      modulationIndex: 5,
      resonance: 2000,
      octaves: 2
    }).connect(bubbleGain);

    const bubbleNotes = ['C6', 'D6', 'E6', 'G6', 'A6'];
    const bubbleLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.4) { // 60% chance - frequent bubbles
        const note = bubbleNotes[Math.floor(Math.random() * bubbleNotes.length)];
        bubbles.triggerAttackRelease('32n', time, 0.08);
      }
    }, '8n');
    bubbleLoop.start(0);

    // Cranky mysterious sounds - dissonant low drones
    const crankGain = new Tone.Gain(0.25).connect(underwaterFilter);
    const crankyDrone = new Tone.AMSynth({
      harmonicity: 0.7, // Dissonant
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 8, decay: 2, sustain: 0.7, release: 10 },
      modulation: { type: 'square' }
    }).connect(crankGain);

    // Slow cranky creaks
    const crankLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.85) { // 15% chance - rare and unsettling
        const crankNotes = ['C1', 'Db1', 'D1', 'Eb1'];
        const note = crankNotes[Math.floor(Math.random() * crankNotes.length)];
        crankyDrone.triggerAttackRelease(note, '8m', time, 0.4);
      }
    }, '4m');
    crankLoop.start(0);

    // Deep cozy drone - comforting but sad
    const cozyGain = new Tone.Gain(0.35).connect(underwaterFilter);
    const cozyDrone = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 10, decay: 0, sustain: 1, release: 10 }
    }).connect(cozyGain);

    // Warm but melancholic drone
    cozyDrone.triggerAttack('A1');

    // Distant harmonic calls - other whales far away, gentle hope
    const distantGain = new Tone.Gain(0.15).connect(massiveReverb);
    const distantWhale = new Tone.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 4, decay: 3, sustain: 0.4, release: 6 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 3, decay: 2, sustain: 0.6, release: 5 }
    }).connect(distantGain);

    // Occasional distant responses - hope in the void
    const distantLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.88) { // 12% chance - rare distant calls
        // Higher pitched than main whale - sounds far away
        const distantNotes = ['C3', 'D3', 'E3', 'G3'];
        const note = distantNotes[Math.floor(Math.random() * distantNotes.length)];
        const duration = 3 + Math.random() * 4;
        distantWhale.triggerAttackRelease(note, duration, time, 0.3);
      }
    }, '6m');
    distantLoop.start(0);

    // Gentle water currents - subtle movement sounds
    const currentGain = new Tone.Gain(0.18).connect(underwaterFilter);
    const waterCurrent = new Tone.Noise('pink').connect(currentGain);
    waterCurrent.start();

    // Modulate water current volume for gentle flowing effect
    const currentLfo = new Tone.LFO(0.08, 0.1, 0.25);
    currentLfo.connect(currentGain.gain);
    currentLfo.start();

    return [{
      whaleCry,
      sonar,
      bubbles,
      crankyDrone,
      cozyDrone,
      distantWhale,
      waterCurrent,
      cryLoop,
      sonarPattern,
      bubbleLoop,
      crankLoop,
      distantLoop,
      massiveReverb,
      echoDelay,
      underwaterFilter,
      mainGain,
      bubbleGain,
      crankGain,
      cozyGain,
      distantGain,
      currentGain,
      currentLfo
    }];
  }, []);

  const createEarthApproach = useCallback(async () => {
    // Approaching Earth after 20 years - tears of joy, family reunion imminent
    const warmReverb = new Tone.Reverb(4); // Less reverb - we're getting closer
    await warmReverb.generate();
    const chorus = new Tone.Chorus(4, 2.5, 0.5).start();
    const phaser = new Tone.Phaser({
      frequency: 0.3,
      octaves: 2,
      baseFrequency: 400
    });
    phaser.toDestination();

    const mainGain = new Tone.Gain(0.55).toDestination();
    chorus.connect(warmReverb);
    warmReverb.connect(phaser);

    // Warm, uplifting major chord progression - pure joy
    const joyfulPads = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 2, decay: 1, sustain: 0.9, release: 3 }
    }).connect(chorus);

    // Emotional progression - building anticipation and joy
    const progressionChords = [
      ['C3', 'E3', 'G3', 'C4'],   // C major - home
      ['G3', 'B3', 'D4', 'G4'],   // G major - approaching
      ['A3', 'C4', 'E4', 'A4'],   // A minor - tears
      ['F3', 'A3', 'C4', 'F4'],   // F major - warmth
      ['C3', 'E3', 'G3', 'B3'],   // C major 7 - arrival
    ];

    let chordIndex = 0;
    const progressionLoop = new Tone.Loop((time) => {
      joyfulPads.triggerAttackRelease(
        progressionChords[chordIndex % progressionChords.length],
        '4m',
        time,
        0.7
      );
      chordIndex++;
    }, '4m');
    progressionLoop.start(0);

    // Bright melodic bells - memories of family flashing by
    const memoryGain = new Tone.Gain(0.4).connect(warmReverb);
    const memoryBells = new Tone.MetalSynth({
      frequency: 400,
      envelope: { attack: 0.01, decay: 0.8, release: 1.2 },
      harmonicity: 8,
      modulationIndex: 12,
      resonance: 3000,
      octaves: 1.5
    }).connect(memoryGain);

    // Happy memories - frequent, sparkling
    const memoryNotes = ['C5', 'E5', 'G5', 'B5', 'D5', 'A5', 'C6'];
    const memoryPattern = new Tone.Pattern((time, note) => {
      if (Math.random() > 0.3) { // 70% chance - frequent happy flashes
        memoryBells.triggerAttackRelease('16n', time, 0.5);
      }
    }, memoryNotes, 'random');
    memoryPattern.interval = '8n';
    memoryPattern.start(0);

    // Heartbeat of anticipation - getting faster as we approach
    const heartGain = new Tone.Gain(0.25).toDestination();
    const heartbeat = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.3 }
    }).connect(heartGain);

    // Excited heartbeat - faster than normal
    const heartPattern = new Tone.Loop((time) => {
      heartbeat.triggerAttackRelease('C1', '16n', time);
    }, '1n'); // Quick excited heartbeat
    heartPattern.start(0);

    // Uplifting lead melody - main emotional theme
    const leadGain = new Tone.Gain(0.45).connect(warmReverb);
    const leadSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 2 }
    }).connect(leadGain);

    // Beautiful ascending melody - hope and joy
    const leadMelody = ['E4', 'G4', 'C5', 'B4', 'A4', 'G4', 'E4', 'D4', 'C4', 'E4', 'G4', 'C5'];
    let melodyIndex = 0;

    const melodyLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.2) { // 80% chance - prominent melody
        leadSynth.triggerAttackRelease(
          leadMelody[melodyIndex % leadMelody.length],
          '4n',
          time,
          0.6
        );
        melodyIndex++;
      }
    }, '4n');
    melodyLoop.start(0);

    // Warm bass foundation - calm and stable
    const bassGain = new Tone.Gain(0.3).toDestination();
    const warmBass = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 0, sustain: 1, release: 1 }
    }).connect(bassGain);

    // Root note - grounding warmth
    warmBass.triggerAttack('C2');

    // Shimmer effect - tears of joy catching light
    const shimmerGain = new Tone.Gain(0.2).connect(warmReverb);
    const shimmer = new Tone.MetalSynth({
      frequency: 2000,
      envelope: { attack: 0.001, decay: 0.3, release: 0.5 },
      harmonicity: 12,
      modulationIndex: 40,
      resonance: 8000,
      octaves: 2
    }).connect(shimmerGain);

    const shimmerNotes = ['C6', 'E6', 'G6', 'B6', 'D6'];
    const shimmerPattern = new Tone.Pattern((time, note) => {
      if (Math.random() > 0.6) { // 40% chance - delicate sparkles
        shimmer.triggerAttackRelease('32n', time, 0.15);
      }
    }, shimmerNotes, 'random');
    shimmerPattern.interval = '16n';
    shimmerPattern.start(0);

    // Building intensity LFO - emotion swelling
    const emotionLfo = new Tone.LFO(0.05, 0.5, 0.7); // Slow emotional build
    emotionLfo.connect(mainGain.gain);
    emotionLfo.start();

    return [{
      joyfulPads,
      memoryBells,
      heartbeat,
      leadSynth,
      warmBass,
      shimmer,
      progressionLoop,
      memoryPattern,
      heartPattern,
      melodyLoop,
      shimmerPattern,
      warmReverb,
      chorus,
      phaser,
      mainGain,
      memoryGain,
      heartGain,
      leadGain,
      bassGain,
      shimmerGain,
      emotionLfo
    }];
  }, []);

  const createPiece = useCallback(async (pieceId: string) => {
    switch (pieceId) {
      case 'space-atmosphere':
        return await createSpaceAtmosphere();
      case 'cosmic-chords':
        return await createCosmicChords();
      case 'crystal-cascade':
        return createCrystalCascade();
      case 'doom-drone':
        return await createDoomDrone();
      case 'space-drone':
        return await createSpaceDrone();
      case 'homeward-bound':
        return await createHomewardBound();
      case 'distant-memories':
        return await createDistantMemories();
      case 'stellar-solitude':
        return await createStellarSolitude();
      case 'earths-embrace':
        return await createEarthsEmbrace();
      case 'cosmic-longing':
        return await createCosmicLonging();
      case 'cosmic-whale':
        return await createCosmicWhale();
      case 'earth-approach':
        return await createEarthApproach();
      default:
        return await createSpaceAtmosphere();
    }
  }, [createSpaceAtmosphere, createCosmicChords, createCrystalCascade, createDoomDrone, createSpaceDrone, createHomewardBound, createDistantMemories, createStellarSolitude, createEarthsEmbrace, createCosmicLonging, createCosmicWhale, createEarthApproach]);

  const startPiece = useCallback(async (pieceId: string) => {
    if (!isInitializedRef.current) {
      await initializeTone();
    }

    // Stop current piece if playing
    if (currentPieceRef.current) {
      // Stopping current piece
      try {
        if (currentPieceRef.current.stop) {
          await currentPieceRef.current.stop();
        } else if (Array.isArray(currentPieceRef.current)) {
          // Handle Tone.js synth arrays - dispose all audio nodes
          currentPieceRef.current.forEach((item) => {
            if (!item) return;

            // Handle old format: { synth, pattern }
            if (item.synth || item.pattern) {
              if (item.pattern) item.pattern.stop();
              if (item.synth?.dispose) item.synth.dispose();
              else if (item.synth?.stop) item.synth.stop();
            } else {
              // Handle new format: object with multiple audio nodes
              Object.values(item).forEach((node: any) => {
                try {
                  if (node?.stop) node.stop();
                  if (node?.dispose) node.dispose();
                } catch (e) {
                  // Ignore disposal errors for already disposed nodes
                }
              });
            }
          });
        }

        // Stop and reset transport for clean slate
        Tone.getTransport().stop();
        Tone.getTransport().cancel();

        currentPieceRef.current = null;
        // Previous piece stopped cleanly
      } catch (error) {
        console.error('Error stopping previous piece:', error);
      }
    }

    try {
      // Starting piece

      // Set target volume immediately
      const targetVolume = Tone.gainToDb(musicState.volume);
      Tone.getDestination().volume.value = targetVolume;

      // Use Tone.js synthesized pieces
      const synths = await createPiece(pieceId);
      currentPieceRef.current = synths;

      // Start Tone.Transport fresh
      if (Tone.getTransport().state !== 'started') {
        Tone.getTransport().start();
        // Tone.Transport started
      }

      setMusicState(prev => ({
        ...prev,
        currentPieceId: pieceId,
        isPlaying: true,
      }));

      // Successfully started piece
    } catch (error) {
      console.error(`[GENERATIVE MUSIC] Error starting piece "${pieceId}":`, error);
    }
  }, [musicState.volume, initializeTone, createPiece]);

  const stopCurrentPiece = useCallback(async () => {
    if (currentPieceRef.current) {
      // Stopping current piece
      try {
        if (currentPieceRef.current.stop) {
          // Alex Bainter piece
          await currentPieceRef.current.stop();
        } else if (Array.isArray(currentPieceRef.current)) {
          // Tone.js synth array
          currentPieceRef.current.forEach(({ synth, pattern }) => {
            if (pattern) pattern.stop();
            if (synth.dispose) synth.dispose();
            else if (synth.stop) synth.stop();
          });
        }

        // Stop transport
        if (Tone.getTransport().state === 'started') {
          Tone.getTransport().stop();
          // Tone.Transport stopped
        }

        currentPieceRef.current = null;
        setMusicState(prev => ({ ...prev, isPlaying: false }));
        // Piece stopped successfully
      } catch (error) {
        console.error('[GENERATIVE MUSIC] Error stopping piece:', error);
      }
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setMusicState(prev => ({ ...prev, volume: clampedVolume }));

    if (isInitializedRef.current) {
      Tone.getDestination().volume.value = Tone.gainToDb(clampedVolume);
    }
  }, []);

  // Initialize on first user interaction
  useEffect(() => {
    const handleFirstInteraction = async () => {
      const pieceName = AVAILABLE_PIECES.find(p => p.id === musicState.currentPieceId)?.title || musicState.currentPieceId;
      // Audio context initialized, starting
      await initializeTone();

      // Auto-start the randomly selected piece on first interaction
      if (musicState.currentPieceId && !musicState.isPlaying) {
        await startPiece(musicState.currentPieceId);
      }

      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [initializeTone, musicState.currentPieceId, musicState.isPlaying, startPiece]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        if (isInitializedRef.current && Tone.getContext().state === 'running') {
          await Tone.getContext().suspend();
          // Audio context suspended
        }
      } else {
        if (isInitializedRef.current && Tone.getContext().state === 'suspended') {
          await Tone.getContext().resume();
          // Audio context resumed
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentPieceRef.current) {
        if (currentPieceRef.current.stop) {
          currentPieceRef.current.stop().catch(console.error);
        } else if (Array.isArray(currentPieceRef.current)) {
          currentPieceRef.current.forEach(({ synth, pattern }) => {
            if (pattern) pattern.stop();
            if (synth.dispose) synth.dispose();
            else if (synth.stop) synth.stop();
          });
        }
      }
    };
  }, []);

  // Music analysis loop - runs continuously to extract audio features
  useEffect(() => {
    if (!isInitializedRef.current) return;

    let animationFrameId: number;
    let previousVolume = 0;
    let beatHistory: number[] = [];

    const analyzeMusic = () => {
      if (analyserRef.current && fftRef.current) {
        // Get waveform for volume
        const waveform = analyserRef.current.getValue() as Float32Array;

        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < waveform.length; i++) {
          sum += waveform[i] * waveform[i];
        }
        const rms = Math.sqrt(sum / waveform.length);
        const volume = Math.min(1, rms * 3); // Scale and clamp

        // Get frequency spectrum for disharmonic/dissonance analysis
        const spectrum = fftRef.current.getValue() as Float32Array;

        // Detect dissonance using multiple methods for better sensitivity
        let dissonanceScore = 0;
        let totalEnergy = 0;
        let highFreqEnergy = 0;

        // Method 1: High-frequency content (harsh sounds)
        // Method 2: Spectral flatness (noise vs tonal)
        // Method 3: Peak density (roughness from close frequencies)

        for (let i = 0; i < spectrum.length; i++) {
          const freq = (i / spectrum.length) * 22050; // Nyquist frequency
          const db = spectrum[i];
          const linearEnergy = Math.pow(10, db / 20); // Convert dB to linear

          totalEnergy += linearEnergy;

          // Weight high frequencies (above 2kHz) - harsh, dissonant sounds
          if (freq > 2000) {
            highFreqEnergy += linearEnergy * 2; // Double weight for high frequencies
          }

          // Look for roughness (adjacent frequency peaks)
          if (i > 0 && i < spectrum.length - 1) {
            const prev = spectrum[i - 1];
            const next = spectrum[i + 1];
            // If this bin is louder than neighbors, it's a peak
            if (db > prev && db > next && db > -40) {
              dissonanceScore += linearEnergy;
            }
          }
        }

        // Normalize and combine metrics
        const highFreqRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
        const roughness = dissonanceScore * 0.02;

        // Final dissonance value (more sensitive - triggers at 0.3 instead of needing close to 1.0)
        const disharmonic = Math.min(1, (highFreqRatio * 3 + roughness * 2) * 0.5);

        // Detect beats by tracking volume changes
        const volumeChange = Math.abs(volume - previousVolume);
        beatHistory.push(volumeChange);
        if (beatHistory.length > 10) beatHistory.shift();

        const avgChange = beatHistory.reduce((a, b) => a + b, 0) / beatHistory.length;
        const beat = Math.min(1, volumeChange > avgChange * 1.5 ? volumeChange * 5 : 0);

        previousVolume = volume;

        // Store analysis data
        analysisDataRef.current = { volume, disharmonic, beat };
      }

      animationFrameId = requestAnimationFrame(analyzeMusic);
    };

    analyzeMusic();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Global functions to control music from anywhere
  useEffect(() => {
    (window as any).generativeMusic = {
      availablePieces: AVAILABLE_PIECES,
      currentState: musicState,
      startPiece,
      stopCurrentPiece,
      setVolume,
      getAnalysisData: () => analysisDataRef.current, // Expose analysis data
      getRandomPiece: () => {
        const randomIndex = Math.floor(Math.random() * AVAILABLE_PIECES.length);
        return AVAILABLE_PIECES[randomIndex];
      },
      getPiecesByMood: (mood: string) => {
        return AVAILABLE_PIECES.filter(piece => piece.mood === mood);
      },
    };

    // Global window object set

    return () => {
      delete (window as any).generativeMusic;
    };
  }, [musicState, startPiece, stopCurrentPiece, setVolume]);

  // Connect Tone.js destination to Pong audio analyzer for visualizer
  useEffect(() => {
    let hasConnected = false;
    let connectionAttempts = 0;

    const connectToVisualizer = () => {
      if (hasConnected) return;
      connectionAttempts++;

      const pongAudioContext = (window as any).pongAudioContext;
      const analyzer = (window as any).pongAudioAnalyzer;

      console.log(`[VISUALIZER] Connection attempt ${connectionAttempts}: pongAudioContext=${!!pongAudioContext} analyzer=${!!analyzer} toneInitialized=${isInitializedRef.current}`);

      if (analyzer && pongAudioContext && isInitializedRef.current) {
        try {
          // Get Tone's raw audio context
          const toneContext = Tone.getContext().rawContext as AudioContext;
          console.log('[VISUALIZER] Tone context:', toneContext);

          // Create a MediaStreamDestination in Tone's context
          const mediaStreamDest = toneContext.createMediaStreamDestination();
          console.log('[VISUALIZER] Created MediaStreamDestination');

          // Get Tone's master destination and connect it
          const toneDest = Tone.getDestination();
          console.log('[VISUALIZER] Tone destination:', toneDest);

          // Use Tone's connect method to connect to the MediaStreamDestination
          toneDest.connect(mediaStreamDest as any);
          console.log('[VISUALIZER] Step 1: Connected Tone destination to MediaStreamDestination');

          // Create a MediaStreamSource in Pong's context from Tone's stream
          const mediaStreamSource = pongAudioContext.createMediaStreamSource(mediaStreamDest.stream);
          console.log('[VISUALIZER] Step 2: Created MediaStreamSource from Tone stream');

          // Connect the source to Pong's analyzer
          mediaStreamSource.connect(analyzer);
          console.log('[VISUALIZER] Step 3: Connected MediaStreamSource to Pong analyzer');

          hasConnected = true;
          console.log('[VISUALIZER] ✅ Successfully connected Tone.js to Pong visualizer via MediaStream');
        } catch (e) {
          console.error('[VISUALIZER] Error connecting Tone.js:', e);
        }
      }
    };

    // Try to connect periodically in case analyzer loads later
    const interval = setInterval(connectToVisualizer, 1000);
    connectToVisualizer(); // Try immediately too

    return () => clearInterval(interval);
  }, []);

  return null;
};

export default GlobalAmbientMusic;