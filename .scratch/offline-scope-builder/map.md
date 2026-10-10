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

- [NC symbol paths](issues/04-nc-symbol-paths.md): `Axes.<axis>.<member>` on port 501 (evidence from saved Scope files); axis-state members like `ActPos` are direct children.
- [TcCOM symbol paths](issues/05-tccom-symbol-paths.md): `<object name>.<data area>.<symbol>` on the task port; class imports default to `Object1 (<class>)`.

## Not yet specified

- Very large projects: measured in Chromium with a synthetic 16 MB PLC TMC (100k symbols, 300 nested
  FB types): import 0.8 s, index 0.2 s (capped at 250k entries), search ~0.1 s per query. Whether a
  worker/streaming parser is needed depends on real 30–50 MB files and on whether the index cap bites.
- Library noise: should system/library symbols (`TwinCAT_SystemInfoVarList`, `Global_Version`, library
  GVLs) be hidden by default, and how does the user say what is "noise"?
- Re-opening work: importing an existing `.tcscopex` to edit it, and/or diffing it against a project.
- NC encoder/drive variable names (`Axes.<axis>.<Enc>.<var>`?) and whether exported NC/TcCOM channels
  need real IndexGroup/IndexOffset values (see the open part of the Scope file validity ticket).
- Language of the UI (English only today; the user writes German).

## Out of scope

- Live ADS connection, online symbol upload or recording/plotting data in the browser — the
  destination is explicitly offline project building.
