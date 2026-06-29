"use client";

interface SpeedButtonProps {
  className?: string;
  speed: 1 | 1.5 | 2;
  onToggle: () => void;
}

export default function SpeedButton({ className = "", speed, onToggle }: SpeedButtonProps) {
  const label = `Tốc độ ${speed}x`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black transition active:scale-95 ${className}`}
      style={{
        borderColor: "var(--border)",
        background: "var(--secondary)",
        color: "var(--primary)",
      }}
    >
      {speed}x
    </button>
  );
}
