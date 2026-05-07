# Changelog

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
