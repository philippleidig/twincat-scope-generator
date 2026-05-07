# TwinCAT Scope Generator

> **Disclaimer**: This is an independent, personal open-source tool. It is **not a Beckhoff product** and is **not affiliated with, sponsored by, or endorsed by Beckhoff Automation GmbH & Co. KG**. "TwinCAT", "TwinCAT Scope", and related names are trademarks of their respective owners and are used here only to describe the file formats this tool generates and consumes. Use at your own risk.

A web-based tool for generating TwinCAT Scope configuration files (`.tcscopex`) using pattern-based symbol expressions. This tool simplifies the process of creating scope configurations for repetitive structures like axis arrays or multi-mover systems — and now also lets you pull symbols straight out of TwinCAT XTI/TMC files or directly drag them in from the TwinCAT Target Browser.

## Features

### Pattern-based Generation

- Syntax: `{name:start:end}` (e.g. `{i:1:10}`)
- Multiple independent counters in a single path
- Reuse the same counter name for synchronized values
- Live preview of how many acquisitions a pattern will expand to

### Symbol Import from TwinCAT files (`.xti` / `.tmc`)

Click **Import XTI/TMC** in the Scope Files header to upload a TwinCAT file. A modal opens that lets you browse the contained TcCOM objects, parameters and data areas, and select the symbols you want to scope.

- **Two parsers, one for each format**:
  - `.tmc` — TwinCAT Module Class. Reads `<Modules>/<Module>` definitions, the `<Parameters>` block (with struct expansion via `<SubItem>`) and `<DataAreas>/<DataArea>` (Inputs/Outputs/Internal classified by `<AreaNo AreaType="...">`).
  - `.xti` — eXported Tree Item. Dispatches on the `ClassName` attribute: `CNcAxisDef` is parsed via `<Axis>` with Encoder/Drive/Controller, TcCOM exports via the embedded `<TreeItem>/<Module>` shape with nested children.
- **ADS port from the file**: `AmsPort` attributes on `<Project>`, `<Task>`, `<Box>`, `<Module>` or `<TreeItem>` are picked up automatically and applied as the suggested port for each imported symbol. NC-axis XTIs default to port 501 (NC SAF) when no `AmsPort` is given; otherwise the dispatcher falls back to 851 (PLC).
- **Tree / Flat view toggle** inside the modal — switch between hierarchical (Object → Group → Symbol) and flat browsing.
- **Filtering**:
  - Text filter searches symbol name, full path, type, group and owner.
  - `CreateSymbol` filter (`true` / `false` / all) — defaults to `true` so only ADS-exposed symbols are shown.
- **Multi-select** with per-group "Select all" plus global "Select all visible" / "Clear selection".
- **Native icons**: module and group icons are rendered straight from the BMP `<ImageData>` blocks embedded in the file.
- **Bulk add to scope**: selected symbols are appended as individual patterns to the chosen Scope File / Axis Group, preserving each symbol's resolved data type (`BOOL` → `BIT`, `LREAL` → `REAL64`, …) and the ADS port read from the file.

### Drag & Drop from the TwinCAT Target Browser

Open the **TwinCAT Target Browser**, find a symbol on a running target, and drag it onto any **Axis Group** card in this tool — the symbol is dropped in as a new pattern in that group:

- Symbol path, base type and target ADS port are read directly from the XML payload that the Target Browser provides on drop (`<TargetBrowserExportInfo>`).
- Beckhoff base types are mapped onto the internal scope `DataType` (`BOOL` → `BIT`, `LREAL` → `REAL64`, etc.).
- Custom type aliases are resolved through the embedded `<DataTypes>` chain (so e.g. `OTCID` → `UDINT` → `UINT32` resolves correctly).
- The Axis Group highlights while you're hovering during drag, so it's obvious where the symbol will land.

### Project Output

- Multiple `.tcscopex` files, organised into Axis Groups and Patterns
- A generated `.tcmproj` project file
- Everything bundled into a ZIP archive for one-click import into TwinCAT Scope

### Customisable

- Configure target ADS ports (presets for PLC 1-4, NC, …, or custom)
- Select data types (`REAL64`, `INT32`, `BIT`, …)
- Set global recording settings (sample time, record time)

### Quality of Life

- **Local persistence**: configuration is saved in your browser's local storage.
- **Dark/Light Mode**: (coming soon) currently optimised for a clean, modern red/white theme.

## Usage

1. **Add Scope Files**: logical groups for your measurements (e.g. "Axes", "IO").
2. **Add Patterns**, three ways:
   - **Manual**: type a symbol path with counters, e.g. `MAIN.Mover[{i:1:10}].stStatus.fActPosition` (expands to 10 acquisitions).
   - **Import XTI/TMC**: click "Import XTI/TMC", pick the file, filter and multi-select symbols, then "Add to Scope".
   - **Drag & Drop**: drag a symbol from the TwinCAT Target Browser onto an Axis Group.
3. **Configure Settings**: AMS Net ID of your target system, base sample time, record time.
4. **Download**: click "Download ZIP" to get a `.tcmproj` containing all your configured `.tcscopex` files.

## Development

This project is built with React, TypeScript and Vite.

### Prerequisites

- Node.js (v18 or later)
- npm

### Setup

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test

```bash
npm test            # one-shot run
npm run test:watch  # watch mode
npm run test:e2e    # Playwright end-to-end tests
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
