# Changelog

## V1.3 (2026-05-07)

### New Features

- **TwinCAT XTI/TMC Import**: Upload TwinCAT XTI or TMC files via the new "Import XTI/TMC" button in the Scope Files header. The imported file is parsed and a modal lets you browse the contained TcCOM objects.
- **Tree / Flat Views**: Switch between hierarchical (TcCOM objects → groups → symbols) and flat representations directly inside the import modal.
- **Filtering**: Text filter searches symbol name, full path, type, group, and owner. CreateSymbol filter (true / false / all) defaults to `true`.
- **Multi-Select**: Pick multiple symbols at once. Per-group "Select all" and global "Select all visible" / "Clear selection" speed up bulk imports.
- **Native Icons**: Module/group icons are rendered from the BMP `ImageData` blocks embedded in the XTI/TMC file.
- **Bulk Add to Scope**: Selected symbols are added as individual patterns to the chosen Scope File / Axis Group, preserving each symbol's resolved data type (BOOL/REAL/LREAL → BIT/REAL32/REAL64, etc.).

### Sources Supported

- DataAreas (Inputs, Outputs, internal data) with per-symbol `CreateSymbol` overrides
- Parameter Init / Parameter Online (top-level `<Symbols>` block, classified by `<Category>`)
- Type aliases resolved through the file's `<DataTypes>` map

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
