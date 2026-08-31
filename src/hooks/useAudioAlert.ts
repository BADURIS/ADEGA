import { useCallback, useRef } from 'react';

export function useAudioAlert() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playNewOrderSound = useCallback(() => {
    try {
      if (typeof window === 'undefined') return;

      // HTML5 Audio with fallback to Web Audio API synthesized bell tone if audio file fails
      const audio = new Audio('/sounds/new-order-bell.mp3');
      audioRef.current = audio;

      audio.play().catch(() => {
        // Fallback: Web Audio API Oscillator chime sound
        try {
          const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!AudioCtxClass) return;
          const ctx = new AudioCtxClass();

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // Note A5
          osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.3); // Note A6

          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start();
          osc.stop(ctx.currentTime + 0.8);
        } catch (e) {
          console.warn('Audio playback failed:', e);
        }
      });
    } catch (err) {
      console.warn('Could not play audio alert:', err);
    }
  }, []);

  const stopSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return { playNewOrderSound, stopSound };
}
