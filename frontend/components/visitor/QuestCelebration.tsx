"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import type { CompanionQuest } from "@/lib/companionQuests";

type QuestCelebrationProps = {
  quest: CompanionQuest;
  onClose: () => void;
};

export default function QuestCelebration({ quest, onClose }: QuestCelebrationProps) {
  useEffect(() => {
    const duration = 1800;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.75 },
        colors: ["#fbbf24", "#f59e0b", "#fef3c7", "#60a5fa", "#34d399"],
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.75 },
        colors: ["#fbbf24", "#f59e0b", "#fef3c7", "#60a5fa", "#34d399"],
      });

      if (Date.now() < end) {
        window.requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-slate-950/90 px-4 py-6 text-amber-50 backdrop-blur-md animate-in fade-in duration-300">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_32%)]" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-amber-200/35 bg-gradient-to-br from-amber-500/25 via-slate-900 to-blue-950/95 p-1 shadow-[0_24px_80px_rgba(245,158,11,0.28)] animate-in zoom-in-95 slide-in-from-bottom-6 duration-500">
        <div className="relative rounded-[1.75rem] border border-white/10 bg-black/30 px-6 py-7 text-center">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-400 text-4xl text-black shadow-[0_0_38px_rgba(251,191,36,0.58)] ring-4 ring-amber-200/20">
            {quest.icon}
          </div>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.26em] text-amber-200">
            Chúc mừng bạn đã hoàn thành!
          </p>
          <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-amber-50 drop-shadow">
            {quest.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-50/78">
            Bạn đã vượt qua hành trình này thật xuất sắc. Đôn xin trao bạn tấm bưu thiếp lưu niệm đặc biệt này.
          </p>

          <div className="mt-6 rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-100/15 to-white/[0.04] p-5 shadow-inner">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200/85">
              Thẻ lưu niệm độc quyền
            </p>
            <p className="mt-2 text-2xl font-black text-amber-50">{quest.reward}</p>
            <p className="mt-3 text-sm leading-6 text-amber-50/75">
              {quest.rewardDescription}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-7 w-full rounded-full bg-amber-400 px-5 py-3 text-sm font-black text-black shadow-[0_0_28px_rgba(251,191,36,0.35)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            Nhận phần thưởng & Đánh giá
          </button>
        </div>
      </div>
    </div>
  );
}
