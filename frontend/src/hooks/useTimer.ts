import { useState, useEffect, useRef } from "react";

export interface UseTimerOptions {
  timerMode: "FIXED" | "VARIABLE";
  initialSeconds: number;
  onExpire?: () => void;
  enabled?: boolean;
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function useTimer({
  timerMode,
  initialSeconds,
  onExpire,
  enabled = true,
}: UseTimerOptions) {
  const [seconds, setSeconds] = useState<number>(initialSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const hasExpiredRef = useRef(false);

  // Resync from server initialSeconds whenever it changes (e.g. reload or remount)
  useEffect(() => {
    setSeconds(initialSeconds);
    hasExpiredRef.current = initialSeconds <= 0;
  }, [initialSeconds]);

  useEffect(() => {
    if (!enabled) return;

    if (timerMode === "FIXED" && seconds <= 0) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
      return;
    }

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (timerMode === "FIXED") {
          const next = prev - 1;
          if (next <= 0) {
            clearInterval(interval);
            if (!hasExpiredRef.current) {
              hasExpiredRef.current = true;
              onExpireRef.current?.();
            }
            return 0;
          }
          return next;
        } else {
          return prev + 1;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerMode, enabled, seconds]);

  const formattedTime = formatDuration(seconds);
  const isLowTime = timerMode === "FIXED" && seconds > 0 && seconds <= 60;
  const isExpired = timerMode === "FIXED" && seconds <= 0;

  return {
    seconds,
    formattedTime,
    isLowTime,
    isExpired,
  };
}
