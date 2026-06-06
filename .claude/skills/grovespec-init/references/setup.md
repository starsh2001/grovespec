# setup — the fixed setup interview (init asks these, verbatim)

> grovespec-init reads this and asks **exactly these questions, in this order, every time it runs** — first-time setup AND re-invocation (reconfigure). **Do not improvise new questions, reorder, or skip any.** A *fixed* interview is the point: every project gets configured the same way, and **nothing is decided silently**. Ask with the **AskUserQuestion** tool (discrete options + a free-form *Other*); put the **(추천)** default first with a one-line why; write each answer to `.grovespec/config.yaml`. Q1 sets the language — ask Q1 in the *detected* language, the rest in the chosen `config.language`. You may batch Q2–Q4 in one AskUserQuestion call.

## Q1 — Working language → `config.language`
Detect first: `bash .grovespec/bin/grovespec locale` → a code (`ko`/`en`/…) or empty. **Confirm — don't assume:**
- Ask (in the detected language): *"OS 로케일이 **{code}** 로 잡혔어요 — 이 언어로 진행할까요?"*
- Options: **{code} (추천)** · *(Other)* 다른 언어 직접 입력
- If detection is empty → ask outright *"어느 언어로 진행할까요?"* (no default; **never** silently English).

## Q2 — Review strength → `verify.strength` + `review.strength`
*"리뷰를 어느 심각도부터 막을까요? (그 이상이면 재시도)"*
- **2 — Critical + Should-Fix (추천)** — 유용한 수정까지 잡고 재시도 (기본)
- **1 — Critical만** — 빠르고 느슨 (빌드를 막는 것만)
- **3 — + Nice-to-Have** — 가장 엄격, 느림
- Write the chosen number to **both** `verify.strength` and `review.strength` (they may differ if the user asks).

## Q3 — Reviewer models → `verify.models` / `review.models`
*"리뷰어 모델을 섞을까요?"* (균일하면 그냥 세션 모델을 쓰고, 섞기는 깊은 렌즈만 센 모델로)
- **(추천) 하나로 (상속)** — `models`를 비워둠 = 전 리뷰어가 세션 모델. Opus 불필요·추가비용 0. (전부 강하게 원하면 세션을 센 모델로 돌리면 됨.)
- **분담** — 권장 `models` 활성화: finder는 싼 모델, `correctness·security·coherence·triage`만 센 모델 (Opus 접근 필요).

## Q4 — Test command → `review.test`
*"`review`가 테스트를 돌릴 때 쓸 명령은? (지금 없으면 비워두고 나중에)"*
- **(추천) 나중에 / 자동 감지** — `review.test: ""` 유지 (review가 그때 추론하거나 다시 물음)
- *(Other)* 직접 입력 — 예: `pytest -q` · `npm test` · `node --test`

## After the interview
Write every answer to `.grovespec/config.yaml`.
- **First-time setup** → continue init (per-case prep → brief → root).
- **Reconfigure** (a GroveSpec project already exists) → config is now updated; **report what changed and stop** — do not recreate brief/tree/tasks.
