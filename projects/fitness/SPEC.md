# Claude Code Project Spec — Fitness & Wellness Tracker

> **How to use this file:** Save it as `SPEC.md` in your project folder. Fill in / adjust the bracketed bits. Then start Claude Code with the _driver prompt_ at the bottom — don't paste the whole idea as one wall of text. The spec is the source of truth; the driver prompt tells Claude Code how to work through it.

---

## The framework (why it's shaped this way)

A weak prompt describes a _result_ ("build me a fitness app"). A strong prompt gives Claude Code four things it otherwise has to guess at — and guessing is where small projects go sideways:

1. **Constraints** — stack, persistence, what NOT to build. Stops over-engineering.
2. **A data model** — the shape of what gets stored. This is the real backbone of any tracker.
3. **Priorities** — P0/P1/P2, so the first working version is the _useful_ version.
4. **A build sequence** — phased, with a checkpoint after each, so you review before it compounds a wrong assumption.

Everything below maps to those four. Reuse this skeleton for every future project (currency converter, card scorer, etc.) — only the contents change.

---

## 1. One-liner

A single-page, mobile-style personal tracker to (a) log my main lift numbers and PRs, (b) plan upcoming workouts, and (c) run a daily 90 Day Challenge checklist with a per-habit consistency dashboard.

## 2. Goals & success criteria _(this is "done")_

- [ ] I can add/edit my main lifts and see current working weight + PR history per lift.
- [ ] I can schedule upcoming workouts (date + planned exercises) and mark them done.
- [ ] I can tick off the 6 daily challenge tasks; the app shows the current day (1–90), counted from a fixed start date.
- [ ] Missing a task never resets anything — a slip costs that day's tick and nothing more.
- [ ] A dashboard shows the completion % of each task across the days elapsed, so the consistency of each individual habit is visible.
- [ ] Data persists between sessions (closing the tab doesn't wipe it).
- [ ] Looks and feels like a phone app on a mobile screen.

## 3. Context / constraints

- Personal use only, runs on my machine / phone browser. **No accounts, no backend, no cloud.**
- Units in **kg**. Water target **3 L**. Protein target **160 g**.
- Challenge start date is fixed at **7 September 2026** and runs 90 days (through 5 December 2026).
- Keep it lightweight — this lives alongside my other small projects.

## 4. Tech stack _(my recommendation — confirm or override)_

- **Single-page app, plain HTML + CSS + JS in one folder**, or a minimal Vite + React setup if you prefer components. Start with whichever is simplest to meet the spec.
- **Persistence: `localStorage`.** No database.
- Mobile-first layout (design for ~390px width, scale up gracefully).
- _Decision to confirm before coding:_ single-file vs. React. Pick the lighter option unless the challenge logic justifies components.

## 5. Core features (prioritized)

**P0 — must work in v1**

- Lifts module: list of lifts, edit current weight, view PR history.
- 90 Day Challenge daily checklist + day counter.
- Per-habit consistency dashboard (% completion per task across elapsed days).
- localStorage persistence.

**P1 — next**

- Upcoming workouts: add/schedule/mark complete.
- Estimated 1RM calculation from weight × reps.

**P2 — nice to have, only if cheap**

- Simple progress chart for a lift over time.
- Export/import data as JSON (backup).

## 6. Data model _(the backbone — get this right first)_

```
Lift        { id, name, unit:"kg", currentWeight, history:[{date, weight, reps}] }
Workout     { id, date, name, exercises:[{name, sets, reps, weight}], done:false }
Challenge   { days:[ { date,
                       tasks:{ workout, water, protein, reading, project, floss },
                       complete } ] }
```

The start date and length are constants in the module, not stored state, so
there is no `startDate`/`currentDay`/`failed` to keep in sync. Every day that
has begun gets a record on load, so an untouched day counts as a real zero in
the dashboard instead of dropping out of the denominator.

**90 Day Challenge rules to encode:** one workout, 3 L water, 160 g protein, 10 pages read, 1 hour on a personal project, floss + creatine. All 6 ticked marks the day complete. **Missing a task never resets the challenge** — the day simply isn't complete, and the run continues. The score is the per-task completion percentage across the days elapsed.

## 7. Screens

- **Home** — day counter, today's checklist, the habit consistency dashboard, plus a quick glance at top lifts.
- **Lifts** — full list, add/edit, PR history.
- **Workouts** — upcoming list, add, mark done.
- (Tab or bottom-nav style switching between the three.)

## 8. Build plan (phases — checkpoint after each)

- **Phase 0:** No code. Confirm stack, file structure, and the data model above. List open questions.
- **Phase 1:** App shell + navigation + localStorage read/write scaffolding.
- **Phase 2:** Lifts module (P0).
- **Phase 3:** 90 Day Challenge tracker incl. consistency dashboard (P0).
- **Phase 4:** Workouts module (P1).
- **Phase 5:** Mobile polish + edge cases (empty states, bad input, refresh safety).

## 9. Out of scope (v1)

Login/accounts, cloud sync, notifications/reminders, social features, any backend or server.

## 10. Acceptance checks _(I'll verify against these)_

- Refresh the page → all data still there.
- Tick all 6 tasks → day counts as complete; leave one unticked and roll the date → the day stays incomplete, the challenge carries on, and that task's percentage drops.
- Add a lift with a new PR → history updates, current weight reflects latest.
- Resize to phone width → no horizontal scroll, tap targets usable.

---

## ▶ Driver prompt (paste this into Claude Code to start)

> Read `SPEC.md` in full. **Do not write any code yet.**
>
> 1. Confirm your understanding in a few bullet points.
> 2. Recommend the simplest stack and a file structure that meets the constraints.
> 3. List any open questions or assumptions.
>    Once I approve, build in the phases listed in §8 — **pause after each phase** so I can review before you continue. Flag any decision that would be hard to reverse before you make it.
