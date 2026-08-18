# Changelog

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
