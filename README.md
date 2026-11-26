# Training Planner

A static Angular application for planning soccer training sessions. It runs in the browser and has no application server or backend.

For suggested next steps and context to carry into a new Copilot session, see [`ROADMAP.md`](./ROADMAP.md).

## Current features

- Load training data from a local JSON file or select a preloaded dataset.
- Filter drills by labels. When multiple labels are selected, a drill must have all of them.
- Choose drills and per-drill modification options for each stage. Stage order and default drill counts come from the data.
- Preview and copy the plan as formatted WhatsApp text, including descriptions, coaching points, and selected modifications.
- Add and delete drills, and edit their titles, available stages, and labels in an in-memory working copy.
- Add, edit, reorder, and delete coaching points for each drill.
- Manage reusable modifications and their options, and choose which drills use each modification. Deletion warns about affected drills, supports cancellation or reassignment, and can map selected options so the current plan is preserved where possible.
- Manage labels by creating, renaming, and deleting them, assigning them to drills, and choosing main-filter labels. Deleting a used label warns about its drill and main-filter references and allows reassignment, removal, or cancellation.
- Start from an empty dataset without loading a file. Create drills and stages in either order; drills can be assigned to stages later. Export downloads the new dataset as `new-training-data-export.json`.
- Open a data-editing hub with separate Drills, Stages, Labels, and Modifications areas. Modifications have a searchable name list and a focused detail screen for editing options and drill availability; drill search, detail, and back navigation remain within Drills.
- Manage stages by adding, renaming, reordering, and changing default drill counts. Deleting a stage shows affected drills and lets you reassign them, leave them unassigned, or cancel.
- Edit descriptions in a visual Markdown editor with bold, italic, numbered-list, and bullet-list formatting. The editor displays formatted text while storing Markdown in the JSON.
- Search by title, description, coaching point, or label, and filter by stage or label while editing. Open a drill in a separate detail screen and return to the search with its filters retained. Each data change is validated immediately; rejected changes leave the previous valid data available for export.
- Download the current training data as JSON. The loaded source file is never overwritten; refresh clears edits, and replacing or reloading a dataset warns about edits that have not been exported.
- Use the interface in German or English. On each startup, it uses the first supported language in the browser's preferred-language list and falls back to German. The choice is not saved.

The current plan and training-data edits exist only in memory and are lost when the page is refreshed.

## Run and test locally

Requirements: Node.js and npm.

```sh
npm ci
npm start
```

Then open the local URL printed by Angular CLI (usually `http://localhost:4200/`).

Run the unit tests and production build with:

```sh
npm test -- --watch=false
npm run build
```

## Training data

Training JSON files use `schemaVersion: 1` and contain a catalog and a drill list. A drill may have an empty `availableStageIds` list when it is not currently assigned to any stage:

- `catalog.stages`: ordered stages with `id`, display `label`, `order`, and `defaultDrillCount`.
- `catalog.labels`: the available labels. `catalog.mainFilterLabelIds` determines which labels appear as the main filters; other labels are available in the additional filters.
- `catalog.modifications`: reusable selectable drill modifications, each with a `single-select` type and a list of options. A modification can be available for multiple drills.
- `drills`: drills with `id`, `title`, `availableStageIds`, `labelIds`, `descriptionMarkdown`, and `modificationIds` (the modifications available for that drill). A drill may also have `coachingPoints` and a future-use `diagram` field.

IDs within each collection must be unique, and references must point to existing entries. Stage orders must also be unique, and default drill counts must be integers from 0 to 100. The app validates the JSON and its references when loading and exporting it. Stage labels, drill content, labels, and modification text are displayed as authored in the JSON; only the application interface is translated.

For example, descriptions and coaching points may use Markdown:

```json
{
  "id": "drill-001",
  "title": "Passing diamond",
  "availableStageIds": ["main"],
  "labelIds": ["passing"],
  "descriptionMarkdown": "Players form a diamond (**10m x 10m**).",
  "coachingPoints": ["Keep **moving**."],
  "modificationIds": []
}
```

Raw HTML and Markdown images are not rendered. This prevents a data file from causing external images to load in the browser.

### Add a preloaded dataset

1. Put the JSON file in [`data/`](./data/).
2. Add an entry to [`data/datasets.json`](./data/datasets.json):

   ```json
   {
     "id": "example-team",
     "name": "Example Team",
     "fileName": "example-team.json"
   }
   ```

The `fileName` must be a JSON filename directly inside `data/`. The Angular asset configuration copies JSON files from that directory into the build, so the file and catalog entry are available in local development and deployment. Files not listed in the catalog are not offered in the preloaded-dataset selector, but can still be selected with the local file picker.

## Deployment

Build the static site with `npm run build`. The production output is in `dist/training-planner/browser/`; the build also copies the project license and generated third-party notices into that directory.

A GitHub Pages deploy target is configured for the `/training-planner/` base path. Build with the deployment base path and deploy with:

```sh
npm run deploy
```

## License

The project is licensed under MIT; see [`LICENSE`](./LICENSE). This is intended to cover the application, the handcrafted training data, and the project icon. The icon was generated with Google AI Mode and then color-edited. Google's [Terms of Service](https://policies.google.com/terms?hl=en) say Google does not claim ownership of original content generated by its services, but this does not guarantee that an output is exclusive or copyrightable. Third-party dependencies retain their own licenses, and their notices are included in the deployed output. Club names, logos, and other third-party material may have separate rights and are not covered by this project's license.
