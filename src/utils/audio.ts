/**
 * Premium Web Audio API synthesizer for real-time chat alerts.
 * Avoids any external assets/CDNs dependency for high-speed, offline-safe operations.
 */

export const playIncomingTone = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    const playBeep = (freq: number, start: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    // Beautiful harmonic bright chime (Ting-Ting!)
    // First tone: 880 Hz (A5) for 100ms
    playBeep(880, now, 0.12, 0.12);
    // Second tone: 1174.66 Hz (D6) for 240ms, slightly louder, starting 80ms later
    playBeep(1174.66, now + 0.08, 0.24, 0.15);

    // Vibration feedback [vibrate, pass, vibrate]
    if ('vibrate' in navigator) {
      navigator.vibrate([120, 80, 120]);
    }
  } catch (err) {
    console.debug("Web Audio synthesis is blocked by browser interaction policies:", err);
  }
};

export const playOutgoingTone = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Satisfying wet popping/click sound (WhatsApp output feel)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle'; // Warmer click
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.06); // Descending pitch slider

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
    
  } catch (err) {
    console.debug("Web Audio synthesis is blocked by browser interaction policies:", err);
  }
};
