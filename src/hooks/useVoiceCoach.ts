import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useVoiceCoach = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueue = useRef<string[]>([]);
  const isProcessingQueue = useRef(false);
  const audioCache = useRef<Map<string, string>>(new Map());
  const lastRequestTime = useRef<number>(0);

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
        let audioContent: string;

        // Check cache first
        if (audioCache.current.has(text)) {
          audioContent = audioCache.current.get(text)!;
          console.log('Using cached audio for:', text);
        } else {
          // Rate limiting: ensure at least 800ms between requests
          const now = Date.now();
          const timeSinceLastRequest = now - lastRequestTime.current;
          if (timeSinceLastRequest < 800) {
            await new Promise(resolve => setTimeout(resolve, 800 - timeSinceLastRequest));
          }
          lastRequestTime.current = Date.now();

          // Retry logic for rate limits
          let retries = 0;
          let success = false;
          
          while (!success && retries < 3) {
            try {
              const { data, error } = await supabase.functions.invoke('text-to-speech', {
                body: { text, voice: 'Sarah' }
              });

              if (error) throw error;

              if (data?.audioContent) {
                audioContent = data.audioContent;
                // Cache the result
                audioCache.current.set(text, audioContent);
                success = true;
              } else {
                throw new Error('No audio content received');
              }
            } catch (error: any) {
              retries++;
              if (error?.message?.includes('429') || error?.message?.includes('rate')) {
                console.log(`Rate limited, retry ${retries}/3 after delay`);
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
              } else {
                throw error;
              }
            }
          }

          if (!success) {
            console.error('Failed after 3 retries, skipping phrase');
            continue;
          }
        }

        // Play the audio
        const audio = new Audio(`data:audio/mpeg;base64,${audioContent!}`);
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error('Audio playback failed'));
          audio.play().catch(reject);
        });

        // Small pause between phrases
        await new Promise(resolve => setTimeout(resolve, 300));
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
