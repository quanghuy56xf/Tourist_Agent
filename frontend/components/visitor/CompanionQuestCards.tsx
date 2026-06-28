import type { CompanionQuest } from "@/lib/companionQuests";

type CompanionQuestCardsProps = {
  title: string;
  startLabel: string;
  quests: CompanionQuest[];
  onSelectQuest: (quest: CompanionQuest) => void;
};

export default function CompanionQuestCards({
  title,
  startLabel,
  quests,
  onSelectQuest,
}: CompanionQuestCardsProps) {
  return (
    <div className="mt-4 space-y-3 animate-in slide-in-from-bottom-4 duration-500 pb-3">
      <p className="text-center text-sm font-semibold text-amber-100">{title}</p>
      <div className="grid gap-3">
        {quests.map((quest) => (
          <button
            key={quest.id}
            type="button"
            onClick={() => onSelectQuest(quest)}
            className="group w-full rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-500/15 via-white/[0.06] to-blue-500/10 p-4 text-left shadow-[0_12px_28px_rgba(0,0,0,0.3)] transition-all hover:-translate-y-0.5 hover:border-amber-300/60 hover:bg-amber-500/20 active:scale-[0.99]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/30 text-2xl ring-1 ring-amber-300/25 transition-transform group-hover:scale-110">
                {quest.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-lg font-bold leading-tight text-amber-50">
                  {quest.title}
                </h3>
                <p className="mt-1 text-xs text-amber-200/70">{quest.audience}</p>
                <p className="mt-2 text-sm leading-6 text-amber-50/85">{quest.concept}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full border border-amber-300/25 bg-black/20 px-3 py-1 text-xs text-amber-100/80">
                    🎁 {quest.reward}
                  </span>
                  <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black shadow-[0_0_16px_rgba(245,158,11,0.25)]">
                    {startLabel}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
