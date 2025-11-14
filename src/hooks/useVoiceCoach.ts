import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useVoiceCoach = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueue = useRef<string[]>([]);
  const isProcessingQueue = useRef(false);

  const processQueue = useCallback(async () => {
    if (isProcessingQueue.current || audioQueue.current.length === 0) {
      return;
    }

    isProcessingQueue.current = true;
    setIsSpeaking(true);

    while (audioQueue.current.length > 0) {
      const text = audioQueue.current.shift();
      if (!text) continue;

      try {
        const { data, error } = await supabase.functions.invoke('text-to-speech', {
          body: { text, voice: 'Sarah' }
        });

        if (error) throw error;

        if (data?.audioContent) {
          // Create audio element and play
          const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
          audioRef.current = audio;

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error('Audio playback failed'));
            audio.play().catch(reject);
          });

          // Small pause between phrases
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error('Voice coach error:', error);
      }
    }

    isProcessingQueue.current = false;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!isEnabled) return;
    
    audioQueue.current.push(text);
    processQueue();
  }, [isEnabled, processQueue]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    audioQueue.current = [];
    isProcessingQueue.current = false;
    setIsSpeaking(false);
  }, []);

  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => !prev);
    if (!isEnabled) {
      stop();
    }
  }, [isEnabled, stop]);

  return {
    speak,
    stop,
    isSpeaking,
    isEnabled,
    toggleEnabled
  };
};
