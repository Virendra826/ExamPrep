import type { ReactNode } from "react";

interface BadgeProps {
  variant?: "success" | "neutral" | "warning" | "danger" | "indigo";
  children: ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = "neutral", children, className = "" }) => {
  const variantStyles = {
    success: "bg-emerald-950/40 text-emerald-300 border-emerald-800/60",
    neutral: "bg-slate-800/70 text-slate-400 border-slate-700/60",
    warning: "bg-amber-950/40 text-amber-300 border-amber-800/60",
    danger: "bg-rose-950/40 text-rose-300 border-rose-800/60",
    indigo: "bg-indigo-950/40 text-indigo-300 border-indigo-800/60",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
