# setup — the fixed setup interview (init asks these, verbatim)

> grovespec-init reads this and asks **exactly these questions, in this order, every time it runs** — first-time setup AND re-invocation (reconfigure). **Do not improvise new questions, reorder, or skip any.** A *fixed* interview is the point: every project gets configured the same way, and **nothing is decided silently**. Ask with the **AskUserQuestion** tool (discrete options + a free-form *Other*); put the **(추천)** default first with a one-line why; write each answer to `.grovespec/config.yaml`. Q1 sets the language — ask Q1 in the *detected* language, the rest in the chosen `config.language`. You may batch Q2–Q3 in one AskUserQuestion call. (Only **three** questions are asked — the test command is **not** one; see the note after Q3 for why.)

> **This is a FIXED questionnaire — reproduce the strings, do NOT compose them.** Each question below gives an **ASK** block (the exact words, with the plain-language explanation already built in — written for someone who's never seen the workflow and may not code) and **Options** (exact labels + descriptions). Put the **ASK** text into the AskUserQuestion `question` field and use the **Options** as given. There is **no** separate preamble to write and **no** rephrasing — the explanation lives inside the ASK text, so it shows with the buttons (don't also write a chat preamble; that's what made one question short and another a wall).
> - **If `config.language` is the language these are written in (Korean), copy them character-for-character.** Do NOT paraphrase, summarize, retype from memory, add words (don't turn 「리뷰어 모델」 into 「리뷰어 AI 모델」), or "fix" them. Re-typing instead of copying is exactly how garbled Korean appears — `섞을까요`→"섯을까요", `비싸요`→"비주요", `어느`→"어는". **Copy, don't compose.**
> - **Only when `config.language` differs do you translate** — faithfully, in correct natural prose, keeping the same meaning and structure.
> - **`Write:`** lines are instructions to *you* (how to fill config) — never shown to the user. (Q1 — language — is the one you compose, since it depends on the detected language.)

## Q1 — Working language → `config.language`
Detect first: `bash .grovespec/bin/grovespec locale` → a code (`ko`/`en`/…) or empty. **Offer languages as words, never codes** — most people don't read `ko`/`ja`/`zh`. Map the code → its name *in that language* for display (`ko`→한국어 · `en`→English · `ja`→日本語 · `zh`→中文 · `es`→Español · …) and ask in the detected language. **Confirm — don't assume:**
- Detected → e.g. *"OS 언어가 **한국어**로 잡혔어요 — 이 언어로 진행할까요?"*; options are **words**, recommended first: **한국어 (추천)** · English · 日本語 · *(Other)* 다른 언어 직접 입력. (Drop whichever common alternate equals the detected one so it isn't listed twice.)
- Empty → no default; ask outright *"어느 언어로 진행할까요?"* with word options (**English · 한국어 · 日本語 · *(Other)***). **Never** silently English.
- **Show the word, store the code:** map the chosen word back to its code → `config.language` (한국어→`ko` · English→`en` · 日本語→`ja` · …); for a free-form *Other*, resolve the name to its code (fall back to the written name if you can't). Later skills read the code, not the word.

## Q2 — Review strength → `verify.strength` + `review.strength`
**ASK** (copy into the `question` field, verbatim):
> 리뷰 강도 — GroveSpec은 코드를 다 쓰면 AI가 그 코드를 다시 검토해 문제를 찾아내요. 문제는 심각도로 나뉩니다: Critical(심각)=실제로 망가짐(안 돌아가거나 동작이 틀림), Should-Fix(고치는 게 좋음)=돌아는 가지만 나중에 버그·혼란으로 이어질 게 분명함, Nice-to-Have(있으면 좋음)=사소한 다듬기. 어느 심각도부터 "통과 못 함 → 다시 고쳐"로 되돌릴까요? (그보다 가벼운 건 메모만 하고 넘어가요.)

**Options** (verbatim — labels + descriptions):
- **2 — Critical + Should-Fix (추천)** — 망가진 것 + 고치는 게 좋은 것까지 되돌려 고치게 함. 너무 빡빡하지도 느슨하지도 않은 기본값.
- **1 — Critical만** — 진짜로 망가진 것만 되돌림. 가장 빠르고 느슨.
- **3 — + Nice-to-Have** — 사소한 다듬기까지 전부 되돌림. 가장 꼼꼼하지만 가장 느림.

**Write:** the chosen number to **both** `verify.strength` and `review.strength` (they differ only if the user asks).

## Q3 — Reviewer models → `verify.models` / `review.models`
**ASK** (copy into the `question` field, verbatim):
> 리뷰어 모델 — 그 검토는 여러 AI가 서로 다른 관점으로 나눠서 해요 (한쪽은 '결과가 맞나', 다른 쪽은 '보안 구멍은 없나'). AI는 똑똑할수록 더 잘 잡지만 그만큼 비싸요. 검토 AI를 전부 같은 걸로 둘까요, 아니면 깊이 파고드는 쪽만 더 센(비싼) 걸로 올릴까요?

**Options** (verbatim — labels + descriptions):
- **전부 같은 AI로** — 검토 AI 전부 지금 이 대화에서 쓰는 모델 그대로. 따로 설정 없이 바로 됨. 단, 지금 비싼 모델(Opus 등)을 쓰고 있다면 검토 비용도 높아짐 — 넓게 훑는 쪽은 싼 모델로도 충분하기 때문에, 그 경우엔 아래 혼합이 오히려 비용도 낮고 효율적임.
- **깊은 검토만 센 AI로** — 넓게 훑는 쪽은 싼 AI, 깊이 파고드는 쪽만 더 똑똑하고 비싼 AI. 역할별로 필요한 만큼만 쓰므로 비용 대비 검토 품질이 가장 좋음. 다만 모델을 나눠 설정하고, 그 비싼 AI를 쓸 수 있어야 함.

**Write:** `전부 같은 AI로` → leave `models` empty (every reviewer inherits the session model). `깊은 검토만 센 AI로` → enable the recommended `models` split in both `verify` and `review`.

## Not a question — the test command (`review.test`) is auto-detected
The command that runs the project's tests is **mechanically determined by the stack** (Python → `pytest`, Node → `npm test`/`node --test`, Rust → `cargo test`, a `Makefile` target, …) — so it is **not** put to the human; making someone pick a derivable value is making them do the tool's job. Handle it automatically:
- **Brownfield** (code already exists) → init **detects** it during per-case prep (read `package.json` `scripts.test` / `pyproject`·pytest config / `Makefile` / `cargo`·`go` layout / etc.) and writes `review.test`. Only if nothing is clearly detectable, leave it empty.
- **Greenfield** (no stack yet at init) → leave `review.test: ""`; there is nothing to detect, the stack doesn't exist yet. The **first `grovespec-review`** (once code exists) **derives it from the stack**, uses it, and writes it back to config.
- **Ask the human only when it genuinely can't be determined** (no clear runner, or several equally-plausible ones) — and then as a *"이게 맞아?"* confirm with a concrete best guess, never a blank "what's your test command?".

## After the interview
Write every answer to `.grovespec/config.yaml`.
- **First-time setup** → continue init (per-case prep → brief → root).
- **Reconfigure** (a GroveSpec project already exists) → config is now updated; **report what changed and stop** — do not recreate brief/tree/tasks.
