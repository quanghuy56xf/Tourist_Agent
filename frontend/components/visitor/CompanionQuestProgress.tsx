import type { MouseEvent } from "react";
import type { CompanionQuest, CompanionQuestStop } from "@/lib/companionQuests";

type CompanionQuestProgressProps = {
  quest: CompanionQuest;
  stop: CompanionQuestStop | null;
  currentStopIndex: number;
  expanded: boolean;
  scanLabel: string;
  switchLabel: string;
  onToggleExpanded: () => void;
  onScanStop: () => void;
  onShowCards: () => void;
};

export default function CompanionQuestProgress({
  quest,
  stop,
  currentStopIndex,
  expanded,
  scanLabel,
  switchLabel,
  onToggleExpanded,
  onScanStop,
  onShowCards,
}: CompanionQuestProgressProps) {
  const safeIndex = Math.min(currentStopIndex, quest.stops.length - 1);
  const progressLabel = stop
    ? `Điểm ${safeIndex + 1}/${quest.stops.length}`
    : `Đã xong ${quest.stops.length}/${quest.stops.length}`;

  const handleScanClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onScanStop();
  };

  return (
    <div className="mx-4 mb-2 animate-in slide-in-from-top-2 duration-300">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onToggleExpanded();
        }}
        className="flex w-full cursor-pointer items-center gap-2 rounded-2xl border border-amber-300/20 bg-black/25 px-3 py-2 text-left shadow-[0_8px_22px_rgba(0,0,0,0.24)] backdrop-blur-md transition-colors hover:bg-white/[0.07]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-xl ring-1 ring-amber-300/25">
          {quest.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300/75">
            <span>{progressLabel}</span>
            <span className="flex flex-1 items-center gap-1">
              {quest.stops.map((questStop, index) => (
                <span
                  key={questStop.id}
                  className={`h-1.5 flex-1 rounded-full ${
                    index < currentStopIndex
                      ? "bg-emerald-400"
                      : index === safeIndex && stop
                      ? "bg-amber-400"
                      : "bg-white/15"
                  }`}
                />
              ))}
            </span>
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-sm font-semibold text-amber-50">
            <span className="truncate">{quest.title}</span>
            {stop && <span className="shrink-0 text-amber-200/60">· {stop.title}</span>}
          </span>
        </span>
        {stop && (
          <button
            type="button"
            onClick={handleScanClick}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-base text-black shadow-[0_0_16px_rgba(245,158,11,0.35)] transition-transform active:scale-95"
            aria-label={scanLabel}
          >
            📸
          </button>
        )}
        <span className="shrink-0 text-xs text-amber-200/50">{expanded ? "⌃" : "⌄"}</span>
      </div>

      {expanded && stop && (
        <div className="mt-2 rounded-2xl border border-amber-300/20 bg-[#0b1328]/95 p-3 shadow-[0_12px_26px_rgba(0,0,0,0.28)] backdrop-blur-md animate-in slide-in-from-top-1 duration-200">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300/80">
            Nhiệm vụ đang chạy
          </p>
          <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-semibold text-amber-200/70">{progressLabel}</p>
            <h4 className="mt-1 text-base font-bold text-amber-50">{stop.title}</h4>
            <p className="mt-2 text-sm leading-6 text-amber-50/80">{stop.hint}</p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={onScanStop}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-sm font-black text-black shadow-[0_0_18px_rgba(245,158,11,0.3)] transition-transform active:scale-95"
            >
              <span>📸</span>
              <span>{scanLabel}</span>
            </button>
            <button
              type="button"
              onClick={onShowCards}
              className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-amber-100/75 transition-colors hover:bg-white/[0.1]"
            >
              {switchLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
