# Glossary

Vocabulary of the Scope Generator. Code, UI and docs use these terms with exactly these meanings.

## Symbol catalog (what was imported)

**Source** — What one imported file contributes for one runtime: a PLC, a TcCOM object/class, the NC
or the process image of an I/O device.
Has a kind, an ADS **port**, an optional **path prefix** and target **AMS Net ID**, a type table and
its root symbols. One file can yield several sources (a `.tsproj` with PLC and NC).
_Avoid_: file, project (a file is the container, a source is what it describes).

**Process image (I/O)** — The I/O data of one device (and task) as an ADS server of its own, port
27904 + image id, once "Enable ADS Server" and "Create symbols" are set on the device's *Image*. Paths
are `<box>.<PDO>.<entry>` (EtherCAT), boxes flat at top level. See ADR 0006.

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

**PLC scope** — Whether a PLC root symbol is declared in a global variable list (**global**, the
`TcVarGlobal` property in the `.tmc`) or in a program (**program**). Unknown outside a `.tmc`.

**System symbol** — A root symbol TwinCAT generates rather than the project: the PLC lists
`TwinCAT_SystemInfoVarList`, `Global_Version`, `TwinCAT_PreventOnlineChangeGvl`, `TC_EVENTS`, an
EtherCAT master's `Inputs.Frm0*`/`Outputs.Frm0*` and each box's `WcState`/`InputToggle`. Hidden by
default.

**Recordable** — A symbol whose resolved type maps to a **scope data type** (numeric or BOOL) and
that has an ADS symbol. Strings, interfaces, pointers themselves and **disabled symbols** are not
recordable; values reached **via reference** or through a pointer's `^` are.

**Hidden symbol** — Something the file lists that has no ADS symbol on the target (a symbol or
member marked `hide` or `TcNoSymbol`, `VAR_INST`, methods, empty arrays, …). Not shown anywhere.
A *type* marked `hide` does not hide its instances. See ADR 0005.

**Disabled symbol** — Shown muted with the reason as tooltip, never selectable or added: properties
with `monitoring := 'call'`, static variables below FB instances, `conditionalshow`, strings,
interfaces, pointers themselves.

**Pointer target (`^`)** — The one child of a pointer, path `<pointer path>^` (`^^` for a pointer to a
pointer); recordable like any symbol of the pointed-to type.

**Via reference** — A symbol reached through a `REFERENCE TO` or `VAR_IN_OUT` member. Same path as
without the reference (no `^`), recordable, but valid only while the reference is bound; shown with a
warning icon.

**Pick** — A symbol selected in the browser, as plain data: source and path (concrete like
`GVL.aAxis[3]` from the tree, or with wildcards like `GVL.aAxis[*]` from search). Resolved against the
current catalog only when added, into **channel specs**.

**Channel spec** — A channel to add as importers describe it: template, data type, port and target
**AMS Net ID** (not yet a project target).

**Search entry** — One node of the search index. Array indices are written as `*`
(`GVL.aAxis[*].fActPos`) together with their **ranges**, so an array contributes one entry, not one per element.
Disabled symbols and pointers are entries too (with their reason), pointer targets as `p^` paths.

**Corpus** — The 352 public TwinCAT files (plus one boot project whose I/O symbol table is the reference for the I/O importer) in `scripts/corpus/manifest.json`, downloaded into `.corpus/`
by `npm run test:corpus` and used to check importer invariants. Never committed.

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
with the template's padding. Without one (or when the template cannot fill it) the symbol path is shown.
_Avoid_: alias, label, title.

**Channel colour** — `#rrggbb` of a channel's line, exported as signed ARGB. Unset: the exporter picks
a palette colour by position in the axis group. A pattern channel's acquisitions get consecutive
palette colours starting at it, or all the same colour (**colour mode** `same`).

**Acquisition** — One recorded value in the exported file (`<AdsAcquisition>` + `<Channel>`):
a fully expanded template.

**Scope data type** — Value type Scope records: `BIT`, `INT8…INT64`, `UINT8…UINT64`, `REAL32`, `REAL64`.
