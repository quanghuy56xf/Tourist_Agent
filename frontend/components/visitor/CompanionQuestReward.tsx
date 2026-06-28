import type { CompanionQuest } from "@/lib/companionQuests";

type CompanionQuestRewardProps = {
  quest: CompanionQuest;
  chooseAnotherLabel: string;
  continueLabel: string;
  onChooseAnother: () => void;
  onContinueTour: () => void;
};

export default function CompanionQuestReward({
  quest,
  chooseAnotherLabel,
  continueLabel,
  onChooseAnother,
  onContinueTour,
}: CompanionQuestRewardProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-3xl border border-amber-300/35 bg-gradient-to-br from-amber-400/20 via-yellow-100/[0.08] to-blue-500/15 p-5 text-center shadow-[0_18px_44px_rgba(245,158,11,0.18)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500 text-4xl text-black shadow-[0_0_32px_rgba(245,158,11,0.45)]">
        {quest.icon}
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-amber-300">
        Quest completed
      </p>
      <h3 className="mt-2 font-serif text-2xl font-bold leading-tight text-amber-50">
        Bạn đã hoàn thành {quest.title}!
      </h3>
      <div className="mt-4 rounded-2xl border border-amber-300/25 bg-black/25 p-4">
        <p className="text-sm font-bold text-amber-200">🎁 Thẻ Lưu Niệm độc quyền</p>
        <p className="mt-1 text-lg font-black text-amber-50">{quest.reward}</p>
        <p className="mt-2 text-sm leading-6 text-amber-50/80">{quest.rewardDescription}</p>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onChooseAnother}
          className="rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-black transition-transform hover:scale-[1.01] active:scale-95"
        >
          {chooseAnotherLabel}
        </button>
        <button
          type="button"
          onClick={onContinueTour}
          className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-amber-100/80 transition-colors hover:bg-white/[0.1]"
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
