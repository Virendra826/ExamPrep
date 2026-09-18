import React from "react";
import { Clock, AlertCircle } from "lucide-react";
import { useTimer } from "../../hooks/useTimer";

interface TimerWidgetProps {
  timerMode: "FIXED" | "VARIABLE";
  initialSeconds: number;
  onExpire?: () => void;
  enabled?: boolean;
}

export const TimerWidget: React.FC<TimerWidgetProps> = ({
  timerMode,
  initialSeconds,
  onExpire,
  enabled = true,
}) => {
  const { formattedTime, isLowTime, isExpired } = useTimer({
    timerMode,
    initialSeconds,
    onExpire,
    enabled,
  });

  return (
    <div
      aria-label="Quiz Timer"
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold tracking-wider transition-colors ${
        isLowTime
          ? "bg-amber-500/15 border-amber-500/40 text-amber-400 animate-pulse"
          : isExpired
          ? "bg-red-500/15 border-red-500/40 text-red-400"
          : "bg-slate-800/80 border-slate-700/80 text-slate-300"
      }`}
    >
      {isLowTime || isExpired ? (
        <AlertCircle className="w-4 h-4 text-amber-400" />
      ) : (
        <Clock className="w-4 h-4 text-indigo-400" />
      )}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 hidden sm:inline">
          {timerMode === "FIXED" ? "Remaining:" : "Elapsed:"}
        </span>
        <span className="font-mono text-sm font-bold text-white tracking-normal">
          {formattedTime}
        </span>
      </div>
    </div>
  );
};
