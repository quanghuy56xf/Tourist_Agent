# HERA RAG Eval Production Beta Report

- **Range:** Last 30 days
- **Generated at:** 2026-07-01T10:17:21.483608Z
- **Release status:** **GO for canary**
- **Production gate score:** 5/5
- **RAGAS golden gate score:** 4/4

## 1. Executive Summary

- Total RAG traces: **1**
- Average confidence: **0.920**
- Low-confidence rate: **0.0%** (0 traces)
- Fallback rate: **0.0%** (0 traces)
- Verified-knowledge rate: **100.0%** (1 traces)
- Average dense max score: **0.934**
- Average latency: **0.0 ms**
- Healthy indexes: **2/2**
- Recent critical traces sampled: **0**
- Recent warning traces sampled: **0**

## 2. Production Gates

| Gate | Result | Current value |
|---|---:|---:|
| Average confidence >= 0.70 | ✅ | 0.920 |
| Low-confidence rate <= 15% | ✅ | 0.0% |
| Fallback rate <= 20% | ✅ | 0.0% |
| Verified-knowledge rate >= 85% | ✅ | 100.0% |
| Index healthy rate >= 95% | ✅ | 100.0% |

## 3. Guardrail Setup - Production Beta

### Request-time guardrails
- Regex PII redaction for email, Vietnamese phone-like numbers, CCCD/CMND-like identifiers, API keys, and private keys.
- Prompt-injection heuristic blocking for instruction override, system prompt extraction, jailbreak/DAN, hidden context exfiltration, and Vietnamese bypass phrases.
- Topic scope validator with hard block for clearly unsafe/off-domain abuse and soft allow for tourism/heritage-adjacent queries.
- Conversation-history sanitization: unsafe prior turns are replaced with `[Message removed by safety filter]` before reaching the LLM.
- Output contract guardrail: no verified context, empty context, or critical confidence returns a safe fallback instead of a factual answer.

### Async/deep eval path
- Existing RAG traces capture retrieval query, chunk evidence, confidence reasons, fallback signals, verified-knowledge flag, and latency JSON.
- RAGAS async timeout issue has been resolved for the golden eval runner; the latest 70-case run completed without runtime notes.
- RAGAS judge credentials are configured and the latest golden eval produced finite metrics.
- Golden dataset currently has 70 evaluated cases: 50 corpus-scoped and 20 item-scoped.

## 4. Confidence Distribution

| Bucket | Range | Count |
|---|---:|---:|
| 0–0.25 | 0.00-0.25 | 0 |
| 0.25–0.45 | 0.25-0.45 | 0 |
| 0.45–0.7 | 0.45-0.70 | 0 |
| 0.7–1.0 | 0.70-1.00 | 1 |

## 5. Index Health

| Group | Docs | Healthy | Unhealthy docs | Missing | Stale | Surplus | Orphan |
|---|---:|---:|---:|---:|---:|---:|---:|
| Quốc Tử Giám | 6 | ✅ | 0 | 0 | 0 | 0 | 0 |
| vin uni | 0 | ✅ | 0 | 0 | 0 | 0 | 0 |

## 6. Recent Trace Risk Review

| Time | Risk | Group | Item | Confidence | Dense | Fallback | Verified | Context | Query |
|---|---|---|---|---:|---:|---|---|---:|---|
| 2026-06-30T14:55:32 | 🟢 ok | Quốc Tử Giám | Đại Thành Điện | 0.920 | 0.934 | no | True | 8 | kể thêm điểm thú vị |

## 7. RAGAS Golden Eval - Latest Run

- **Dataset:** `backend/evals/golden/rag_golden_70.jsonl`
- **Generated at:** 2026-07-01T10:17:21.483608Z
- **Release status:** **GO for canary**
- **Total cases:** 70
- **Attempted by RAGAS:** 70
- **Scope attempted:** corpus=50, item=20
- **Errored cases:** 0 (corpus=0, item=0)
- **Gate score:** 4/4
- **Runtime notes:** RAGAS evaluation completed without runtime notes.
- **Risk summary:** low-confidence=0, retrieval fallback=1, error=0

| Metric | Score | Target | Gate |
|---|---:|---:|---:|
| faithfulness | 0.8918 | 0.85 | ✅ |
| answer_relevancy | 0.8439 | 0.80 | ✅ |
| context_recall | 0.9762 | 0.75 | ✅ |
| context_precision | 0.8277 | 0.70 | ✅ |

## 8. Recommended Actions

- All production-beta and RAGAS golden gates passed. Proceed with internal/canary rollout and continue async sampling.
- Inspect the 1 retrieval fallback case from the 70-case run and decide whether retriever tuning, source data fixes, or dataset adjustment is needed.

## 9. Next Production Hardening Steps

1. Add 30+ no-answer/abstention cases and track unsupported-answer rate.
2. Add 50+ Vietnamese prompt-injection/red-team regression prompts.
3. Keep RAGAS judge credentials and compatible LLM/embedding settings configured before every release eval run.
4. Promote production failures directly into the golden dataset or a dedicated regression suite.
