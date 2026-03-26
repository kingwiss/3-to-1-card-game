let audioCtx: AudioContext | null = null;
const lastPlayed: Record<string, number> = {};

export const resumeAudio = async () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
};

export const playSound = (type: 'draw' | 'play' | 'sabotage' | 'limitLift' | 'win' | 'lose' | 'opponent' | 'tick' | 'coinShuffle' | 'coinLand') => {
  const nowMs = Date.now();
  const throttleTime = (type === 'coinShuffle' || type === 'coinLand') ? 1000 : 500;
  if (lastPlayed[type] && nowMs - lastPlayed[type] < throttleTime) {
    return; // Throttle sounds to prevent overlapping cacophony
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
    // Very simple and short clink
    for (let i = 0; i < 2; i++) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 4000;
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        
        const freq = 4000 + Math.random() * 2000;
        const timeOffset = now + i * 0.05;
        
        osc.frequency.setValueAtTime(freq, timeOffset);
        
        gainNode.gain.setValueAtTime(0, timeOffset);
        gainNode.gain.linearRampToValueAtTime(0.05, timeOffset + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.03);
        
        osc.start(timeOffset);
        osc.stop(timeOffset + 0.04);
    }
  } else if (type === 'coinLand') {
    // A single, short "ping"
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    osc.start(now);
    osc.stop(now + 0.15);
    
    // Very quick thud
    const thudOsc = audioCtx.createOscillator();
    const thudGain = audioCtx.createGain();
    thudOsc.connect(thudGain);
    thudGain.connect(audioCtx.destination);
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(100, now);
    thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.03);
    thudGain.gain.setValueAtTime(0.05, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    thudOsc.start(now);
    thudOsc.stop(now + 0.03);
  }
};
