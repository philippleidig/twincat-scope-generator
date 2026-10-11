# Glossary

Vocabulary of the Scope Generator. Code, UI and docs use these terms with exactly these meanings.

## Symbol catalog (what was imported)

**Source** — What one imported file contributes for one runtime: a PLC, a TcCOM object/class or the NC.
Has a kind, an ADS **port**, an optional **path prefix** and target **AMS Net ID**, a type table and
its root symbols. One file can yield several sources (a `.tsproj` with PLC and NC).
_Avoid_: file, project (a file is the container, a source is what it describes).

**Complete source** — A source that lists every symbol of its runtime (a PLC `.tmc`). A partial source
(the I/O variables of a PLC in a `.tsproj`) is dropped when a complete one for the same kind and port exists.

**Root symbol** — A symbol as declared in the file (`MAIN.fbAxis`, `GVL.nCount`, a TcCOM parameter,
an NC axis variable). Its members and array elements are derived from the type table on demand.

**Type table** — The `<DataTypes>` of a file, keyed by name and by `namespace.name`. Resolves aliases,
enums, arrays, struct/FB members and inheritance.

**Symbol path** — Full ADS name of a value, e.g. `GVL.aAxis[3].fActPos`. Path prefix + root symbol
name + members + indices.

**Area** — Where a root symbol lives: `input`, `output`, `internal`, `parameter`
(from `AreaType`/`VarGrpType`). Members inherit the area of their root.

**Recordable** — A symbol whose resolved type maps to a **scope data type** (numeric or BOOL).
Strings, pointers, references and interfaces are not recordable.

**Pick** — A symbol selected in the browser, as plain data: source and path (concrete like
`GVL.aAxis[3]` from the tree, or with wildcards like `GVL.aAxis[*]` from search). Resolved against the
current catalog only when added, into **channel specs**.

**Channel spec** — A channel to add as importers describe it: template, data type, port and target
**AMS Net ID** (not yet a project target).

**Search entry** — One node of the search index. Array indices are written as `*`
(`GVL.aAxis[*].fActPos`) together with their **ranges**, so an array contributes one entry, not one per element.

**Browser view** — How the symbol browser shows the catalog: the **tree** (sources → folders → symbols →
members → elements; a query switches it to search results) or the **list** (every search entry, sorted
by path, narrowed by query and filters). Both produce the same picks.

## Scope project (what is exported)

**Project** — Everything in one `.tcmproj`: settings, targets and scope files.

**Target** — A named AMS Net ID channels record from. _Avoid_: device, PLC.

**Scope file** — One `.tcscopex` containing one YT chart.

**Axis group** — One value axis in the chart; groups channels that are displayed together.

**Channel** — A symbol **template** with data type, port and target. Expands into one or more
**acquisitions**. _Avoid_: pattern (V1 term for a container of symbols, removed in V2), symbol.

**Template** — A symbol path that may contain **counters** `{name:start:end}`; a repeated counter
name reuses the same value; a start with leading zeros pads (`{i:01:12}`).

**Display name** — The name a channel shows in TwinCAT Scope (`<Channel><Name>`, name relation
`Custom`). Optional; may insert the template's counters as `{i}` (no range), filled per acquisition
with the template's padding. Without one (or with unknown counters) the symbol path is shown.
_Avoid_: alias, label, title.

**Channel colour** — `#rrggbb` of a channel's line, exported as signed ARGB. Unset: the exporter picks
a palette colour by position in the axis group. A pattern channel's acquisitions get consecutive
palette colours starting at it (**colour mode** `palette`), or all the same colour (`same`).

**Acquisition** — One recorded value in the exported file (`<AdsAcquisition>` + `<Channel>`):
a fully expanded template.

**Scope data type** — Value type Scope records: `BIT`, `INT8…INT64`, `UINT8…UINT64`, `REAL32`, `REAL64`.
