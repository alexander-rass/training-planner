# Roadmap and Copilot Handoff

Last reviewed: 2026-11-22

This is a suggested roadmap, not a commitment to implement every item. The app already covers the core pilot workflow. Pick one follow-up at a time and confirm the desired behavior before making larger product decisions.

## Current state

The project is a static Angular app for one trainer to assemble a soccer training plan and share it as formatted WhatsApp text. There is no application server or backend.

Implemented:

- Load a local training-data JSON file or select a preloaded dataset from [`data/datasets.json`](./data/datasets.json).
- Validate the JSON and its references when loading.
- Filter drills by data-defined labels, select drills for stages, and choose per-drill modifications.
- Preview/copy the plan as WhatsApp-formatted text and download the loaded JSON.
- German and English interface strings. The browser's preferred language is checked on each startup; German is the fallback. The choice is not saved.
- Build and deploy scripts include the project's MIT license and generated third-party notices.

Important current constraints:

- The training data is maintained outside the app. Downloading JSON currently preserves the loaded source; it does not edit or serialize user changes.
- The selected plan exists only in memory and is lost on refresh.
- Stage order/default drill counts come from the data. The app does not currently edit data or provide a diagram editor.
- Training content remains in the language authored in its JSON file. Only the app interface is localized.
- Markdown is rendered for descriptions/coaching points, but raw HTML and Markdown images are not rendered. Do not bypass Angular's normal HTML sanitization or load arbitrary external images.
- The current MIT intent includes the app, handcrafted training data, and the edited AI-generated icon. Third-party dependencies and third-party names/logos/material may have separate rights.

See [`README.md`](./README.md) for the current data format, local commands, and deployment instructions.

## Suggested roadmap

### 1. Validate the real trainer workflow

Before adding features, use the app to create and share a few actual sessions. Record friction points and decide which of the optional features below would solve a real problem. Keep the current lightweight workflow if it is sufficient.

### 2. Decide whether to add in-app training-data editing

This is the most substantial likely next feature, but the current workflow intentionally has the trainer maintain JSON outside the app. If editing is desired, first agree on its scope and data-safety behavior.

Potential scope:

- Edit drill titles, descriptions, coaching points, labels, stages, and modification options.
- Validate all edits and references before export.
- Keep edits in a working copy and export a complete JSON file; do not silently overwrite the original local file.
- Clearly show unsaved changes and confirm before replacing edited data with a different dataset or file.

The UI, editing all content types, and replacing the source file are separate decisions. Start with the smallest useful editing scope.

### 3. Design and add drill diagrams

The user has identified diagrams as a future feature, with fixed entries such as players and goals placed freely. Agree on the diagram format before implementing it.

Suggested sequence:

1. Define a small declarative schema for elements (for example players, balls, goals, cones, arrows, and zones), positions, and accessible text.
2. Add a read-only renderer for a few representative diagrams and test it on mobile.
3. Consider an authoring/editor UI only after the schema and rendering approach are validated.

Prefer normalized coordinates and known element types over arbitrary executable markup or unrestricted image URLs. Do not assume which elements or editing gestures are required; confirm them with the trainer.

### 4. Consider session-plan refinements only when needed

Possible additions include durations, a plan title/date, changing stage order, duplicating drills, or saving/restoring a draft. These are not part of the current pilot. Decide each independently; in particular, ask before adding browser persistence or changing the fixed-stage workflow.

### 5. Improve data and release confidence

- Add a check that every preloaded dataset listed in the catalog exists and passes the same schema/reference validation used at runtime.
- Keep focused tests for loading, replacement confirmation, WhatsApp formatting, localization, and JSON export.
- Check keyboard use, screen-reader labels, and narrow-screen layout as the UI grows.
- Keep license notices in the deployed output. Do not publish/deploy unless explicitly requested.

## Starting a new Copilot session

Share this document and [`README.md`](./README.md), then give the new session a concrete task. Useful project context:

- Stack: Angular 22, TypeScript, npm, Vitest. The app is static; there is no backend.
- Training data is JSON under [`data/`](./data/). The catalog is `data/datasets.json`; new preloaded files must be added to that catalog and included by the existing build asset configuration.
- Keep user-facing UI text in German/English translation resources. Dataset content is not translated.
- The user's preferred language is read from browser preferences at every startup. Do not add cookies or persist language selection.
- Preserve the JSON validation and normal Angular sanitization. Raw HTML and Markdown images are intentionally not rendered.
- The selected plan is transient. Do not add persistence, change the stage model, or expand the data editor without confirming the desired behavior.
- The user prefers to do manual browser checks; run relevant unit tests/builds and give a concise manual-check list when appropriate.
- Check `git status` before editing and preserve unrelated or untracked user files.

Useful commands:

```sh
npm test -- --watch=false
npm run build
```

`npm run deploy` publishes to GitHub Pages; do not run it without explicit authorization.

Suggested prompt to paste into a new session:

> This is the static Angular soccer training planner described in `README.md` and `ROADMAP.md`. Please read both first, inspect the current worktree, and preserve unrelated changes. Work only on this task: [describe one specific roadmap item]. Ask before making product decisions that affect data editing, persistence, stage behavior, or diagrams. Run the relevant tests/build and do not deploy.
