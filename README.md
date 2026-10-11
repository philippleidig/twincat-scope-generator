# TwinCAT Scope Generator

> **Disclaimer**: This is an independent, personal open-source tool. It is **not a Beckhoff product** and is **not affiliated with, sponsored by, or endorsed by Beckhoff Automation GmbH & Co. KG**. "TwinCAT", "TwinCAT Scope", and related names are trademarks of their respective owners and are used here only to describe the file formats this tool generates and consumes. Use at your own risk.

Build TwinCAT Scope projects **offline, in the browser**: import the files of your TwinCAT solution,
browse and search every symbol like in the TwinCAT Target Browser, pick what to record, and download a
ready-to-open `.tcmproj` with its `.tcscopex` files. No PLC connection, no installation, and no file
ever leaves your browser.

## Workflow

1. **Import** `.tmc`, `.xti` or `.tsproj` files — pick files, a whole solution folder, or drop them on
   the symbol browser. Try **"Try the demo machine"** without files of your own.
2. **Find** symbols in the tree or by search, narrow with filters.
3. **Add** them to the axis group marked *Adding here* (button, or drag & drop).
4. **Export ZIP** — a `.tcmproj` plus one `.tcscopex` per scope file.

The project is saved in the browser automatically; *Save project file* / *Open project file* in the
menu move it between machines.

## Offline symbol browser

| File | What you get |
|---|---|
| PLC `.tmc` (in the PLC project folder) | **Every** PLC symbol with its real ADS path (`MAIN.fbAxis`, `GVL.nCount`), types from `<DataTypes>` incl. structs, function blocks (with inheritance), enums, aliases and arrays. Port from the project (`Port_851`). |
| TcCOM `.tmc` / object `.xti` | Data areas and parameters as `<object name>.<data area>.<symbol>` on the task port (350 by default). |
| `.xti` / `.tsproj` | NC axes as `Axes.<axis>.<member>` on port 501 (axis state such as `ActPos`, `SetPos`, `ActVelo`, and `ToPlc`/`FromPlc`), TcCOM objects, PLC variables linked to I/O, and the target's AMS Net ID. Parts stored in separate files are listed so you can import them too. |

Import the whole solution folder to get everything at once: the PLC `.tmc` supersedes the I/O
listing of the same PLC, and the Net ID from the `.tsproj` is applied to the other files.

- **Tree** like the Target Browser: sources → `MAIN`/`GVL`/`Axes › Axis 1`… → symbols → members →
  array elements, expanded lazily so huge projects stay fast (16 MB `.tmc`: ~1 s to import).
- **List** view (toggle *Tree | List* next to the search box): every symbol path as one flat list sorted
  by path, arrays as patterns; search text and filters narrow it. The choice is remembered.
- **Search**: all words must match anywhere in the path (`axis actpos`); `*`/`?` globs match the whole
  path (`*.fActPos`, `MAIN.*Axis*`); `type:LREAL`, `area:input`, `port:852` filter by field.
- **Filters**: BOOL / Integer / Real, Input / Output / Internal / Parameter, *Recordable only*.
- **Arrays become patterns**: a search hit `GVL.aAxis[*].fActPos` is added as
  `GVL.aAxis[{i:1:4}].fActPos` — one channel, four acquisitions.
- **Structs and FBs**: adding one adds every recordable member below it.
- Strings, pointers, references and interfaces are shown but cannot be selected.
- Each source's **port**, **path prefix** (object name for TcCOM) and **target Net ID** can be edited.
- How paths and ports are derived per source, and how sure we are: [ADR 0003](docs/adr/0003-symbol-paths-per-source-kind.md).

## Scope project

- Scope files (tabs) → axis groups → channels. Each scope file becomes one `.tcscopex` with a YT chart;
  each axis group one value axis.
- A channel is a symbol path with optional counters `{name:start:end}`: several counters multiply,
  a repeated name stays in sync (`Axis {i:1:3}.Drive {i:1:3}` → 3), leading zeros pad (`{i:01:12}`).
  Expansion is capped at 5,000 per channel.
- Per channel: data type, ADS port (with presets), target (when the project has several).
- **Display name and colour** per channel (swatch at the start of the row): names may use the
  template's counters (`Axis {i} ActPos`), colours come from a 16-colour palette or any custom colour;
  pattern channels continue the palette from the chosen colour or use the same colour for all.
  Exported as the channel name and line colour TwinCAT Scope shows.
- **Targets** (AMS Net IDs) are managed in *Project settings*, together with project name, scope server,
  base sample time and record time.
- **Drag & drop** from the TwinCAT Target Browser onto an axis group still works.
- **Reorganise by dragging**: channels (by their handle) to another position, axis group or file tab;
  axis groups to another position or file tab. Hold Ctrl (Option on macOS) to copy instead of move.
  Every channel and axis group also has a **Move to…** menu for keyboard use.
- **Pattern library** with reusable templates (import/export as JSON).
- Problems (invalid paths, duplicate file names, bad Net IDs) are flagged before export; invalid channels are skipped.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev            # http://localhost:5173/twincat-scope-generator/
npm run build
npm run lint
npm test               # unit + component tests (Vitest)
npm run test:coverage  # with coverage thresholds
npm run test:e2e       # Playwright; set PW_CHROMIUM_PATH to use a preinstalled Chromium
```

### Architecture

```
src/
  domain/     project model + pure operations, pattern engine, scope data types, ports
  catalog/    TwinCAT importers (tmc, xti/tsproj), type table, lazy tree, search index, candidates
  export/     .tcscopex/.tcmproj writer, ZIP
  state/      zustand stores (project → localStorage, catalog → IndexedDB) and cross-store actions
  features/   browser, project, settings, shell (UI)
  ui/         design tokens, base styles, primitives (Button, Field, Dialog, Menu, VirtualList, Toaster)
```

Vocabulary: [GLOSSARY.md](GLOSSARY.md) · decisions: [docs/adr](docs/adr) · code review:
[docs/review](docs/review/thermonuclear-review.md) · open questions:
[.scratch/offline-scope-builder/map.md](.scratch/offline-scope-builder/map.md).

Parser tests run against real TwinCAT files from public repositories
(see [src/catalog/__fixtures__](src/catalog/__fixtures__/README.md) for sources and licenses).

## License

MIT — see [LICENSE](LICENSE.md).
