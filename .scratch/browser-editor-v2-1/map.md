# Wayfinder map: Browser views, ADS-accurate catalog, project editing (V2.1)

Label: `wayfinder:map` · Tracker: local markdown (`.scratch/browser-editor-v2-1/`).

## Destination

V2.1 shipped on `main`: the symbol browser switches between tree and flat list; it only offers what is
reachable by ADS symbol name (verified against a large corpus of real TwinCAT files); channels and
axis groups can be dragged within and across scope files; channels get a display name (with counters)
and a colour that land in the exported `.tcscopex`. Spec: [`docs/spec/v2.1.md`](../../docs/spec/v2.1.md).

## Notes

- **Execution is in scope** (the user's override of "plan, don't do"): the spec is implemented in
  separate Claude Code sessions, one slice each, coordinated from the planning session; every slice is
  reviewed (thermo-nuclear, both passes) before it lands on `main`. No PRs: reviewed slices are pushed
  to `main` directly (user decision).
- Vocabulary: [`GLOSSARY.md`](../../GLOSSARY.md); decisions: [`docs/adr/`](../../docs/adr/).
- Previous map: [`../offline-scope-builder/map.md`](../offline-scope-builder/map.md).

## Decisions so far

- [Where do colours live?](issues/01-colours.md): per channel; pattern channels spread over a palette, overridable.
- [How do channel names work?](issues/02-names.md): optional display name that may use the template's counters (`Axis {i} ActPos`); empty = symbol path.
- [What can be dragged in the project?](issues/03-dnd.md): channels and axis groups, reorder and move across scope files; holding Ctrl/Alt copies.
- [How do slices land?](issues/04-integration.md): reviewed, then pushed straight to `main`.
- [How does Scope store names and colours?](issues/07-scope-names-colours.md): `<Channel><Name>` + channel-level `UsedNameType` `Custom`; colour as signed ARGB in Channel and SeriesStyle `DisplayColor`/`MarkColor`.
- [What is reachable by ADS name?](issues/05-ads-access.md): the TMC lists more than ADS exposes; hide properties/hidden/no-symbol/VAR_INST, disable call-properties, interfaces, strings; pointers via `^`; references read through.
- [Which real files do we test against?](issues/06-corpus.md): 352 files from 120 repos; current importer: 0 crashes, two defects (pointer-to-array types, empty arrays).
- [What does the flat list show?](issues/08-flat-list.md): every indexed path (arrays as patterns), the same rows as search results; filters apply.

## Not yet specified

- Keyboard alternatives to drag & drop beyond "Move to…" menu (accessibility polish).
- Colour palettes per axis group (explicitly not chosen now; may come back with chart features).

## Out of scope

- Live ADS connection and online symbol upload (unchanged).
