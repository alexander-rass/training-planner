# Roadmap and Copilot Handoff

Last reviewed: 2026-11-25

This is a suggested roadmap, not a commitment to implement every item. The app already covers the core pilot workflow. Pick one follow-up at a time and confirm the desired behavior before making larger product decisions.

## Current state

The project is a static Angular app for one trainer to assemble a soccer training plan and share it as formatted WhatsApp text. There is no application server or backend.

Implemented:

- Load a local training-data JSON file or select a preloaded dataset from [`data/datasets.json`](./data/datasets.json).
- Validate the JSON and its references when loading.
- Filter drills by data-defined labels, select drills for stages, and choose per-drill modifications.
- Add/delete drills and edit their titles, available stages, and label assignments in an in-memory working copy.
- Manage stages: add and rename stages, change their order and default drill counts, and delete them with a usage warning and reassignment or unassignment.
- Organize edit mode around a hub with dedicated Drills and Stages areas; drill search, detail, and return navigation remain separate.
- Edit descriptions in a visual Markdown editor with bold, italic, bulleted-list, and numbered-list formatting. The editor displays formatted text and stores Markdown.
- Search by title, description, coaching point, or label, and filter by stage or label. Open drills in a separate detail screen, with a back action that retains search filters.
- Validate edits immediately and retain the prior valid data when a change is rejected. Reload the selected preloaded dataset explicitly, including after edits.
- Preview/copy the plan as WhatsApp-formatted text and export the current training data as JSON.
- Create a blank `schemaVersion: 1` dataset from the welcome screen without loading a file. Drills may be created unassigned and assigned to stages later; export downloads the working copy as a new JSON file.
- German and English interface strings. The browser's preferred language is checked on each startup; German is the fallback. The choice is not saved.
- Build and deploy scripts include the project's MIT license and generated third-party notices.
- Refactored the app into a small shell with separate data-source, data-editor, plan-view, and validated data-store responsibilities. Focused editor and planner tests live with their components; app-level tests cover integration flows.

Important current constraints:

- Training-data editing is still an initial increment: drill creation/deletion, titles, descriptions, stage availability, stage catalog entries, and drill label assignments are editable. Coaching points, labels, and modifications are not yet editable.
- Edits and the selected plan exist only in memory. Refreshing loses both. Export downloads the working copy; it does not overwrite the source file or store data in the browser.
- Replacing a dataset warns before discarding edits that have not been exported. Deleting a drill clears any selected plan slots for it.
- A drill may be unassigned from all stages. Blank datasets can be created without loading JSON; editing remains transient and must be exported before refreshing.
- Stage order/default drill counts can be edited in the stage manager. The app does not yet provide a diagram editor.
- Training content remains in the language authored in its JSON file. Only the app interface is localized.
- Markdown is rendered for descriptions/coaching points, but raw HTML and Markdown images are not rendered. Do not bypass Angular's normal HTML sanitization or load arbitrary external images.
- The current MIT intent includes the app, handcrafted training data, and the edited AI-generated icon. Third-party dependencies and third-party names/logos/material may have separate rights.

See [`README.md`](./README.md) for the current data format, local commands, and deployment instructions.

## Suggested roadmap

### 1. Validate the real trainer workflow

Before adding features, use the app to create and share a few actual sessions. Record friction points and decide which of the optional features below would solve a real problem. Keep the current lightweight workflow if it is sufficient.

### 2. Expand in-app training-data editing

The editor is a separate mode and works on an in-memory copy. Continue in small increments:

1. Add, edit, reorder, and delete coaching points.
2. Add label management: create, rename, and delete labels; assign them to drills; and choose main-filter labels.
3. Add modification management: create, edit, and delete general and drill-specific modifications and their options, while keeping stable IDs and valid references.

When deleting an in-use label, stage, or modification, warn with the reference count and a short sample when the list is long. Let the trainer cancel or reassign references before deletion. For modifications, reassignment may also require mapping selected options. Keep the selected plan in memory where possible, but clear entries that are no longer valid; do not add plan or edit persistence.

Validate the complete working copy before export. Preserve optional fields, including `diagram`, through every edit and export so a future diagram feature can use them without requiring the editor to understand diagrams yet.

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
- Keep focused tests for loading, replacement confirmation, editor operations, reference cleanup, WhatsApp formatting, localization, and JSON export.
- Check keyboard use, screen-reader labels, and narrow-screen layout as the UI grows.
- Keep license notices in the deployed output. Do not publish/deploy unless explicitly requested.

## Starting a new Copilot session

Share this document and [`README.md`](./README.md), then give the new session a concrete task. Useful project context:

- Stack: Angular 22, TypeScript, npm, Vitest. The app is static; there is no backend.
- Training data is JSON under [`data/`](./data/). The catalog is `data/datasets.json`; new preloaded files must be added to that catalog and included by the existing build asset configuration.
- Keep user-facing UI text in German/English translation resources. Dataset content is not translated.
- The user's preferred language is read from browser preferences at every startup. Do not add cookies or persist language selection.
- Preserve the JSON validation and normal Angular sanitization. Raw HTML and Markdown images are intentionally not rendered.
- The selected plan and editor changes are transient. Do not add browser persistence.
- The user prefers to do manual browser checks; run relevant unit tests/builds and give a concise manual-check list when appropriate.
- Check `git status` before editing and preserve unrelated or untracked user files.

Useful commands:

```sh
npm test -- --watch=false
npm run build
```

`npm run deploy` publishes to GitHub Pages; do not run it without explicit authorization.

Suggested prompt to paste into a new session:

> This is the static Angular soccer training planner described in `README.md` and `ROADMAP.md`. Please read both first, inspect the current worktree, and preserve unrelated changes. Continue the agreed data-editor roadmap one increment at a time. Do not add browser persistence; preserve optional diagram data. Ask before making decisions outside the agreed scope. Run the relevant tests/build and do not deploy.
