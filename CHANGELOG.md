# Changelog

## V2.1 (unreleased)

### Symbol browser

- **Tree | List** toggle next to the search box. *List* shows every symbol path as one flat,
  virtualised list sorted by path (arrays as patterns, ×N badge), narrowed by search text and filter
  chips without switching modes; long lists are capped with a "Showing n of m" hint.
- Selection, inspector focus, drag to axis groups and *Add to scope* work the same in both views.
- The chosen view is remembered in the browser (falls back to the tree when storage is blocked).

### Project editing

- **Drag & drop in the scope project**: drag a channel by its handle to reorder it (an indicator line
  shows where it lands), into another axis group, or onto a scope file tab (appended to that file's
  first axis group). Axis groups are dragged by their header handle to reorder them or onto a file tab.
- Hold **Ctrl** (Windows/Linux) or **Option** (macOS) while dropping to **copy** instead of move; the
  indicator shows a "+".
- Symbols from the browser or the TwinCAT Target Browser can be dropped at a precise position between
  channels.
- **"Move to…" menu** on every channel and axis group (move up/down, to another axis group or file) as
  a keyboard-friendly alternative to dragging. After a move to another axis group or file, focus stays
  on the moved item (or the tab of its new file).
- **Channel names and colours**: the swatch at the start of a channel row opens a second line with a
  **display name** and a **colour**.
  - The name may insert the template's counters as `{i}` (`Axis {i} ActPos` with
    `GVL.aAxis[{i:1:4}].fActPos` → "Axis 1 ActPos" … "Axis 4 ActPos", padding as in the template). The
    field shows the effective name as placeholder, the counters available and a preview; unknown
    counters (or a counter with its range, or stray braces) are flagged with the reason (the export then
    falls back to the symbol name and the export dialog warns).
  - Colour from a palette of 18, any colour via the native colour picker, or *Auto* (palette colours by
    position, as before). A pattern channel colours its acquisitions with consecutive palette colours
    starting at the chosen one, or with **the same colour for all**.
  - Exported to TwinCAT Scope: the channel's `<Name>` is the display name with its name relation set to
    `Custom`; the colour goes to the channel's `DisplayColor` and the series style's `DisplayColor` and
    `MarkColor` (signed ARGB). Acquisitions keep the symbol names. Without names and colours the exported
    files are unchanged.
- Characters XML cannot carry (control characters, e.g. pasted vertical tabs) are dropped from names and
  symbol paths on export instead of producing a file Scope cannot open.
  - Saved in project files (`name`, `color`, `colorMode` on a channel); older files open unchanged.

## V2.0 (2026-10-10)

Scope projects can now be built completely offline from TwinCAT project files.

### Offline symbol browser (new)

- **Import** `.tmc`, `.xti` and `.tsproj` files (several at once, whole folders, or by drag & drop).
- **PLC `.tmc` imports are correct now**: symbol names are used as the real ADS paths (`MAIN.x`). V1
  prefixed them with the PLC project name (`PLC1.MAIN.x`), which TwinCAT Scope could not resolve.
- Full **type resolution**: structs and function blocks of any depth, FB inheritance (`EXTENDS`),
  enums, aliases, arrays (incl. multi-dimensional), namespaced library types; strings, pointers and
  interfaces are recognised as not recordable.
- `.xti`/`.tsproj`: NC axes (`Axes.<axis>.ActPos` etc., as TwinCAT Scope names them), TcCOM objects
  (`<object>.<data area>.<symbol>`), PLC I/O variables, the target AMS Net ID (shared with the other
  imported files), and a list of parts stored in separate files.
- **Tree** with lazy expansion and **search** over every member path with globs and `type:` / `area:` /
  `port:` terms, plus filter chips. Arrays are added as counter patterns automatically.
- Port, path prefix and Net ID can be adjusted per imported source.
- A bundled **demo machine** to try everything without own files.

### Project

- Hierarchy simplified to **Scope file → Axis group → Channel** (the "Pattern" level is gone; each
  former symbol is a channel).
- **Targets**: several AMS Net IDs per project, chosen per channel.
- The project is **saved in the browser** (V1 lost it on reload, although the README claimed otherwise)
  and can be saved to / opened from a `.scope.json` file.
- Record time is editable; sample time is entered in ms.

### Fixes

- Scope files with the same name no longer overwrite each other in the ZIP; file names are sanitized.
- Invalid templates are no longer exported literally; empty and invalid channels are skipped with a warning.
- Counter expansion is capped (5,000 per channel) instead of freezing the browser.
- Counters support leading zeros (`{i:01:12}`) and negative bounds; reusing a counter name with another range is an error.
- Drag & drop from the Target Browser maps all IEC types (BYTE, WORD, DWORD, TIME, …) and reports unrecordable symbols.

### UI

- New design: two-pane workspace (symbol browser | scope project), design tokens, **dark mode**
  (follows the system or set manually), responsive single-pane layout on small screens, toasts,
  native dialogs, keyboard shortcut `/` for search.

### Engineering

- New architecture (`domain`, `catalog`, `export`, `state`, `features`, `ui`); see README.
- Generated XML is unchanged and now pinned by a golden-file test.
- Tests run against real TwinCAT files; coverage from 63 % to 90 % with enforced thresholds; e2e specs rewritten.

## V1.8 (2026-08-16)

### ADS Ports

- **NC2 is now 501** instead of 500, matching the NC SAF port the XTI parser already assumes for NC axes.
- **TcCOM port presets start at 350** instead of 351.

### UI

- **Visible hierarchy**: Scope File, Axis Group and Pattern were previously told apart only by a thin coloured stripe on the left. Each tier now has its own header bar with a coloured icon badge, a tier label, and a colour that runs down the node's full height — red for Scope File, teal for Axis Group, indigo for Pattern — so it is obvious which patterns belong to which axis group.
- **Collapsible nodes**: every Scope File, Axis Group and Pattern can be folded away, which keeps large configurations navigable.
- **Counts per tier**: headers show how many axis groups / patterns a node contains alongside the acquisition total.
- **Header actions moved inline**: duplicate and delete for a Scope File used to sit in a detached strip above the file name; they are now in the file's own header next to everything else it applies to.
- **Legend**: the Scope Files section header shows the `Scope File › Axis Group › Pattern` structure.
- **Drag & drop feedback**: dropping a symbol from the TwinCAT Target Browser now names the axis group it will land in.

### Dependencies

- All dependencies updated to their current releases, including Vite 8, Vitest 4, ESLint 10, React 19.2.8, jsdom 30 and lucide-react 1.x. `npm audit` goes from 15 known vulnerabilities to 0.
- TypeScript stays on 5.9 for now: `typescript-eslint` does not yet support TypeScript 7.
- `@types/uuid` dropped — `uuid` ships its own type declarations.
- Added `eslint.config.js`. The repository had no ESLint flat config, so `npm run lint` failed outright; linting now runs in CI as well.
- CI moved to Node 22 (jsdom 30 and Vite 8 no longer support Node 20) and the GitHub Actions were bumped to current majors.

## V1.7 (2026-05-07)

### Documentation

- **Disclaimer**: README and the in-app footer now state clearly that this is an independent, personal open-source tool and **not a Beckhoff product** — not affiliated with, sponsored by, or endorsed by Beckhoff Automation GmbH & Co. KG. Trademark notice for "TwinCAT" added.

## V1.6 (2026-05-07)

### Improvements

- **ADS port from XTI**: when importing an `.xti` file, the suggested ADS port for each symbol is now read directly from the file's `AmsPort` attribute (looked up on `<TcSmItem>` itself, then on `<Project>`, `<Task>`, `<Box>`, `<Module>`, or anywhere in the subtree). Child TreeItems inherit the parent's port unless they specify their own. NC-axis XTIs without an explicit `AmsPort` now default to 501 (NC SAF) instead of 851.
- **README**: documents the new XTI/TMC import workflow and the existing drag-and-drop import from the TwinCAT Target Browser.

## V1.5 (2026-05-07)

### New Features

- **TwinCAT XTI/TMC Import**: Upload TwinCAT XTI or TMC files via the new "Import XTI/TMC" button in the Scope Files header. After picking a file, a modal opens that lists the TcCOM objects with their parameters and data areas.
- **Tree / Flat Views**: Switch between hierarchical (TcCOM objects → groups → symbols) and flat representations directly inside the import modal.
- **Filtering**: Text filter searches symbol name, full path, type, group, and owner. `CreateSymbol` filter (`true` / `false` / all) defaults to `true`.
- **Multi-Select**: Pick multiple symbols at once. Per-group "Select all" and global "Select all visible" / "Clear selection" speed up bulk imports.
- **Native Icons**: Module / group icons are rendered from the BMP `<ImageData>` blocks embedded in the file.
- **Bulk Add to Scope**: Selected symbols are added as individual patterns to the chosen Scope File / Axis Group, preserving each symbol's resolved data type (`BOOL` → `BIT`, `LREAL` → `REAL64`, …).

### Parser Architecture

TMC and XTI are different file formats and now have **separate parsers** verified against real-world Beckhoff samples on GitHub:

- **`tmcParser.ts`** — handles `.tmc` files (`<TcModuleClass>` root). Reads `<Modules>/<Module>` definitions, the `<Parameters>` block (including struct expansion via `<SubItem>`), and `<DataAreas>/<DataArea>` with `<AreaNo AreaType="InputDst|OutputSrc|MArea">` for input/output classification. Hidden parameters (`HideParameter="true"`) are skipped.
- **`xtiParser.ts`** — handles `.xti` files (`<TcSmItem>` root). Dispatches by `ClassName`:
  - `CNcAxisDef` → `<Axis>` with Encoder/Drive/Controller `<Vars VarGrpType="1|2">` for inputs/outputs.
  - `CTcCOMObject` and similar → `<TreeItem>` wrapping a `<Module>`, with the same Parameters/DataAreas shape as TMC. Nested TreeItems become children with concatenated path prefixes.
  - Unknown ClassNames fall back to a structural scan.
- **`index.ts`** — `parseTwinCatFile()` dispatcher routes by file extension, with root-element fallback for unknown extensions.
- Type aliases are resolved through the file's `<DataTypes>` map; non-scalar types (structs/enums) are surfaced as non-scopable entries the user can drill into manually.

## V1.3 (skipped)

Replaced by V1.5 — initial TMC/XTI import was rebuilt with separate parsers based on real GitHub samples.

## V1.1 (2026-01-22)

### New Features

- **Sample Management**: Samples can now be created, edited, and deleted
- **LocalStorage Persistence**: Custom samples are automatically saved in the browser
- **JSON Export**: Export all samples as a JSON file
- **JSON Import**: Import samples from a JSON file or paste JSON directly
- **Reset to Defaults**: Restore the original default sample patterns

### Changed

- Renamed "Example Patterns" to "Sample Patterns"
- Added action buttons in the header (Add, Export, Import, Reset)
- Added inline edit/delete buttons for each sample

## V1.0

- Initial release
- TwinCAT Scope configuration file generator
- Pattern expansion with counter syntax `{name:start:end}`
- Multiple scope files and patterns support
- ZIP download with .tcscopex and .tcmproj files
