# Wayfinder map: Offline Scope Builder

Label: `wayfinder:map` · Tracker: local markdown (`.scratch/offline-scope-builder/`), as no issue tracker
was configured for the skill (`/setup-matt-pocock-skills` was never run in this repo).

## Destination

A requirements spec for the offline Scope Builder that someone can implement without further
decisions: which TwinCAT files are imported and how every source kind maps to ADS symbol paths and
ports, how the offline target browser searches and filters, what the scope project can express, and
what the exported `.tcmproj`/`.tcscopex` must contain to open in TwinCAT Scope.

## Notes

- Domain: TwinCAT 3 engineering files (`.tmc`, `.xti`, `.tsproj`) and TwinCAT Scope configurations
  (`.tcscopex`, `.tcmproj`). Everything runs in the browser, no ADS connection (hard constraint from the user).
- A first implementation exists on branch `claude/offline-target-browser` (V2.0). Treat it as the
  **prototype** the HITL tickets react to — it is not the decision itself.
- Skills for every session: `grilling` + `domain-modeling` for HITL tickets; vocabulary in
  [`GLOSSARY.md`](../../GLOSSARY.md); decisions already taken while building the prototype are ADRs in
  [`docs/adr/`](../../docs/adr/).
- Real-world sample files and their licenses: `src/catalog/__fixtures__/`.

## Decisions so far

- [What real TMC files look like](issues/01-tmc-structure.md): PLC symbols carry full ADS paths, port in `ApplicationName`, types in `<DataTypes>` (structs, FB inheritance, enums, arrays, pointer attributes).
- [What real XTI/TSPROJ files look like](issues/02-xti-tsproj-structure.md): PLC I/O vars, TcCOM `Module/TmcDesc`, NC `Axis`/`Encoder`/`Drive` vars, `TargetNetId`, split projects reference other files.
- [Where V1 stood (thermos review)](issues/03-v1-review.md): wrong PLC paths, silent ZIP overwrites, no persistence, unbounded expansion; Pattern tier and duplicated type maps blocked the browser direction.

## Not yet specified

- Very large projects (TMC files of 20–50 MB): is main-thread `DOMParser` acceptable, or do we need a
  worker with a streaming parser? Needs a real large file to measure.
- Library noise: should system/library symbols (`TwinCAT_SystemInfoVarList`, `Global_Version`, library
  GVLs) be hidden by default, and how does the user say what is "noise"?
- Re-opening work: importing an existing `.tcscopex` to edit it, and/or diffing it against a project.
- Language of the UI (English only today; the user writes German).

## Out of scope

- Live ADS connection, online symbol upload or recording/plotting data in the browser — the
  destination is explicitly offline project building.
