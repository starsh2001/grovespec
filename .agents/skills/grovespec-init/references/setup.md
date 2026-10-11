# setup — the fixed setup interview (init asks these, verbatim)

> grovespec-init reads this and asks **exactly these questions, in this order, every time it runs** — first-time setup AND re-invocation (reconfigure). **Do not improvise new questions, reorder, or skip any.** A *fixed* interview is the point: every project gets configured the same way, and **nothing is decided silently**.
> - Ask with the host's question tool — **AskUserQuestion** in Claude Code, **request_user_input_async** in Codex (not `request_user_input`, which Codex refuses outside Plan mode) — discrete options + a free-form *Other*; put the recommended default first with a one-line why. Codex's tool returns no answer to the call: the answers arrive as the user's next message, so end the turn after asking and continue from there. A host with no question tool: present the same questions in chat and wait for the answers.
> - Write each answer to `.grovespec/config.yaml`.
> - **Q1 sets the language** — ask Q1 in the *detected* language, the rest in the chosen `config.language`. Q2–Q4 come as one payload = one question-tool call.
> - Only **four** questions are asked; the test command is **not** one (see the note after Q4 for why).

> **This is a FIXED questionnaire — the strings come from the machine; you do NOT compose them.**
> - **Q2–Q4: run `node .grovespec/bin/grovespec.mjs interview claude` in Claude Code, `… interview codex` in Codex** — it prints the questions as one JSON array in that host's question schema (`[Q2, Q3, Q4]`). **Paste it into the `questions` field byte-for-byte.** The Claude form has every non-ASCII character already `\uXXXX`-escaped; the Codex form is plain UTF-8, because Codex shows command output inside a JSON string, where escapes would arrive doubled. The Codex form also carries each option's explanation inside the question text (its options are bare labels); the labels are identical in both forms, so the **Write:** lines map either. Don't re-type it, don't re-encode it, don't "fix" it. (Why the machine holds the strings: re-typing them corrupted single Korean characters in two separate runs — `가벼운`→`가버운`, `나뉩니다`→`나뉜니다` — by hand-encoding `\uXXXX` codepoints; a "copy, don't compose" warning stopped neither. Pre-escaped ASCII leaves no encoding step to get wrong.)
> - There is **no** separate preamble to write and **no** rephrasing — each question's explanation lives inside its text, so it shows with the buttons. Don't also write a chat preamble.
> - **Only when the confirmed language is not Korean do you translate**: decode the payload and translate faithfully — same meaning, same structure, same option order (recommended first).
> - **`Write:`** lines are instructions to *you* (how to fill config) — never shown to the user. (Q1 — language — is the one you compose, since it depends on the detected language.)

## Q1 — Working language → `config.language`
Detect first: `node .grovespec/bin/grovespec.mjs locale` → a code (`ko`/`en`/…) or empty. **Offer languages as words, never codes** — most people don't read `ko`/`ja`/`zh`. Map the code → its name *in that language* for display (`ko`→한국어 · `en`→English · `ja`→日本語 · `zh`→中文 · `es`→Español · …) and ask in the detected language. **Confirm — don't assume:**
- Detected → e.g. *"OS 언어가 **한국어**로 잡혔어요 — 이 언어로 진행할까요?"*; options are **words**, recommended first: **한국어 (추천)** · English · 日本語 · *(Other)* 다른 언어 직접 입력. (Drop whichever common alternate equals the detected one so it isn't listed twice.)
- Empty → no default; ask outright *"어느 언어로 진행할까요?"* with word options (**English · 한국어 · 日本語 · *(Other)***). **Never** silently English.
- **Show the word, store the code:** map the chosen word back to its code → `config.language` (한국어→`ko` · English→`en` · 日本語→`ja` · …); for a free-form *Other*, resolve the name to its code (fall back to the written name if you can't). Later skills read the code, not the word.

## Q2 — Review repetition → `verify.find_streak` + `review.find_streak`
Question + options = `interview` payload `[0]` — how many CONSECUTIVE no-new-must-fix waves end the problem hunt (finding a new must-fix resets the count; what blocks vs. what is merely recorded is fixed by category and is not asked).

**Write:** the number the chosen label starts with (2 · 1 · 3) to **both** `verify.find_streak` and `review.find_streak` (they differ only if the user asks). `review.plan_streak` keeps the template default (2) unless the user asks.

## Q3 — Reviewer models → `verify.models` / `review.models`
Question + options = `interview` payload `[1]` — one model for every reviewer, or a stronger model on the deep-reasoning lenses only.

**Write:** option 1 (all-same) → leave `models` empty (every reviewer inherits the session model). Option 2 (split) → enable the recommended `models` split in both `verify` and `review`.

## Q4 — Edit-routing hook → `grovespec hooks install|remove`
Question + options = `interview` payload `[2]` — install the advisory routing hook: on each src/tests edit it injects which node owns the file and whether the edit touches that node's Contract surface. Never blocks; registered in **this project's** `.claude/settings.json` (Claude Code) and `.codex/hooks.json` (Codex) only; silenced by one config line, removed by one command.

**Write:** install → run **`node .grovespec/bin/grovespec.mjs hooks install`** — the runtime merges the entry into both files (**never edit them by hand**). Each host then gates the new hook on the user's review — Claude Code asks at the next session; Codex runs it only once the project is trusted and the hook is approved in `/hooks`, and says nothing until then, so tell the user. That review is part of the install, not an error. Don't install → if a registration exists from an earlier setup, run `… hooks remove`; otherwise nothing (config stays `hooks: off`). **Reconfigure re-asks this** — re-running init is how the hook is toggled.

## Not a question — the test command (`review.test`) is auto-detected
The command that runs the project's tests is **mechanically determined by the stack** (Python → `pytest`, Node → `npm test`/`node --test`, Rust → `cargo test`, a `Makefile` target, …) — so it is **not** put to the human; making someone pick a derivable value is making them do the tool's job. Handle it automatically:
- **Brownfield** (code already exists) → init **detects** it during per-case prep (read `package.json` `scripts.test` / `pyproject`·pytest config / `Makefile` / `cargo`·`go` layout / etc.) and writes `review.test`. Only if nothing is clearly detectable, leave it empty.
- **Greenfield** (no stack yet at init) → leave `review.test: ""`; there is nothing to detect, the stack doesn't exist yet. The **first `grovespec-review`** (once code exists) **derives it from the stack**, uses it, and writes it back to config.
- **Ask the human only when it genuinely can't be determined** (no clear runner, or several equally-plausible ones) — and then as a *"이게 맞아?"* confirm with a concrete best guess, never a blank "what's your test command?".

## After the interview
Write every answer to `.grovespec/config.yaml`.
- **First-time setup** → continue init (per-case prep → brief → root).
- **Reconfigure** (a GroveSpec project already exists) → config is now updated; **report what changed and stop** — do not recreate brief/tree/tasks.
