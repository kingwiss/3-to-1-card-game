let audioCtx: AudioContext | null = null;
const lastPlayed: Record<string, number> = {};

export const resumeAudio = async () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
};

export const playSound = (type: 'draw' | 'play' | 'sabotage' | 'limitLift' | 'win' | 'lose' | 'opponent' | 'tick' | 'coinShuffle' | 'coinLand') => {
  const nowMs = Date.now();
  if (lastPlayed[type] && nowMs - lastPlayed[type] < 500) {
    return; // Throttle sounds of the same type to prevent overlapping cacophony
  }
  lastPlayed[type] = nowMs;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'tick') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'draw') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'play') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'opponent') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'sabotage') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'limitLift') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    osc.frequency.setValueAtTime(800, now + 0.2);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'win') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.setValueAtTime(500, now + 0.1);
    osc.frequency.setValueAtTime(600, now + 0.2);
    osc.frequency.setValueAtTime(800, now + 0.3);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.6);
  } else if (type === 'lose') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'coinShuffle') {
    // Realistic coin shuffling/clinking sound
    for (let i = 0; i < 15; i++) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        // Highpass filter to remove low frequencies and make it sound more "metallic"
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 4000;
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Mix of sine and square for a metallic "clink"
        osc.type = i % 2 === 0 ? 'sine' : 'square';
        
        // Random high frequencies typical of small metal objects
        const freq = 3000 + Math.random() * 4000;
        const timeOffset = now + i * 0.05 + Math.random() * 0.02;
        
        osc.frequency.setValueAtTime(freq, timeOffset);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, timeOffset + 0.03);
        
        gainNode.gain.setValueAtTime(0, timeOffset);
        gainNode.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, timeOffset + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.05);
        
        osc.start(timeOffset);
        osc.stop(timeOffset + 0.06);
    }
  } else if (type === 'coinLand') {
    // A bright, satisfying "ka-ching" or solid coin drop when hitting the profile
    const frequencies = [1200, 1600, 2400];
    frequencies.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        
        // Slight delay between tones for a "sparkle" effect
        const startTime = now + i * 0.03;
        
        osc.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        
        osc.start(startTime);
        osc.stop(startTime + 0.5);
    });
    
    // Add a quick "thud" for the physical impact
    const thudOsc = audioCtx.createOscillator();
    const thudGain = audioCtx.createGain();
    thudOsc.connect(thudGain);
    thudGain.connect(audioCtx.destination);
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(150, now);
    thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    thudGain.gain.setValueAtTime(0.2, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thudOsc.start(now);
    thudOsc.stop(now + 0.1);
  }
};
