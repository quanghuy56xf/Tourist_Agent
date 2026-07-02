"use client";

import { useState } from "react";
import { getActiveSearchSessionId, trackEvalEvent } from "@/lib/visitorAnalytics";

const SCORE_OPTIONS = [1, 2, 3, 4, 5];

function ScoreSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="text-amber-100/75">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-full border border-amber-200/15 bg-black/30 px-3 py-1 text-amber-50 outline-none"
      >
        {SCORE_OPTIONS.map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function EvalFeedbackPanel({
  groupId,
  itemId,
  compact = false,
}: {
  groupId?: number | null;
  itemId?: number | null;
  compact?: boolean;
}) {
  const [personaScore, setPersonaScore] = useState(5);
  const [storytellingScore, setStorytellingScore] = useState(5);
  const [voiceScore, setVoiceScore] = useState(5);
  const [replayScore, setReplayScore] = useState(5);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await trackEvalEvent("eval_feedback", {
        groupId: groupId ?? undefined,
        itemId: itemId ?? undefined,
        searchSessionId: getActiveSearchSessionId(),
        metadata: {
          persona_score: personaScore,
          storytelling_score: storytellingScore,
          voice_naturalness_score: voiceScore,
          replay_intent_score: replayScore,
          comment: comment.trim() || undefined,
          surface: compact ? "companion_chat" : "item_page",
        },
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
        Cảm ơn bạn! Đánh giá đã được ghi nhận cho Product Eval.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200/15 bg-white/[0.04] p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-amber-100">Đánh giá nhanh trải nghiệm</p>
        <p className="text-xs text-amber-100/55">Dữ liệu này dùng cho tab Product Eval trong quản trị.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <ScoreSelect label="Đúng vai/persona" value={personaScore} onChange={setPersonaScore} />
        <ScoreSelect label="Kể chuyện hấp dẫn" value={storytellingScore} onChange={setStorytellingScore} />
        <ScoreSelect label="Giọng nói tự nhiên" value={voiceScore} onChange={setVoiceScore} />
        <ScoreSelect label="Muốn trải nghiệm tiếp" value={replayScore} onChange={setReplayScore} />
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Ghi chú ngắn nếu có..."
        rows={compact ? 2 : 3}
        className="mt-3 w-full rounded-xl border border-amber-200/15 bg-black/20 px-3 py-2 text-sm text-amber-50 outline-none placeholder:text-amber-100/35"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        className="mt-3 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        {submitting ? "Đang gửi..." : "Gửi đánh giá"}
      </button>
    </div>
  );
}
