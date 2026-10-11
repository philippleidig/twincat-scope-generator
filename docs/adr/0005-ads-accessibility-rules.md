# 5. The browser offers exactly what can be recorded by ADS symbol name

Status: accepted (V2.1). Rules from research ticket 05
([report with sources](../../.scratch/browser-editor-v2-1/issues/05-ads-access-report.md)), checked
against 352 real files (ticket 06, `npm run test:corpus`).

## Context

A PLC `.tmc` lists more than the ADS symbol table of the running PLC holds: members and types marked
`hide`, `TcNoSymbol` and `conditionalshow`, implicit `VAR_INST` members, properties, static variables.
V2.0 offered some of them as recordable (they fail in Scope), and resolved pointers to arrays
(`<ArrayInfo PointerTo="1">`) as arrays of up to 65,536 elements.

## Decision

The type table (`catalog/typeTable.ts`) decides per construct; the walker (`catalog/walk.ts`) applies it,
so tree, search index, "Add" candidates and `resolvePath` agree.

| Construct in the `.tmc` | Browser |
|---|---|
| `hide`, `TcNoSymbol` (no value) on a symbol or member; `implicit_inst_var` (VAR_INST); locals of a POU with `hide_all_locals`; empty arrays (`Elements` 0); methods, their parameters/locals; properties without pragma | **Hidden** (not in tree, search or candidates) |
| a DataType marked `hide` or `TcNoSymbol` | every symbol/member of that type is hidden |
| `<PropertyItem>` (property with `monitoring := 'call'`) | **Disabled**: "Property (called on access) — Scope cannot sample it" |
| `<Name Static="true">` without `<BitOffs>` (VAR_STAT) | **Disabled** below instances: "Static variable — record `<FB type>.<var>`"; the global `<FB type>.<var>` symbol (`TcVarStatic`) is a normal root |
| `conditionalshow` on symbol/member/type, locals under `conditionalshow_all_locals` | **Disabled**: "Hidden in compiled libraries" |
| `POINTER TO` (`<Type PointerTo="n">`, `<ArrayInfo PointerTo="n">`, a `POINTER TO …` type name) | the pointer is **disabled** and has one child `^` (path `p^`, type = target); `PointerTo="2"` → `^^` |
| `REFERENCE TO` (`ReferenceTo="true"`), `VAR_IN_OUT` (`ItemType` `InOut`) | expanded like the referenced type (no `^`) in the tree, `resolvePath` and "Add"; recordable with the warning "Valid only while the reference is bound" (`viaReference`). The search index lists the reference member itself, not its target |
| `TcNoSymbol 'unused'` | recordable, with a note (inherited by members) |
| interfaces, `STRING`/`WSTRING`, platform-sized types | **Disabled** with a reason (as in V2.0) |
| `qualified_only`, `<Hides>`, CODESYS `symbol` attribute | ignored |

Two limits keep the walk finite and "Add" predictable:

- A pointer or reference leading to a type already entered through a pointer or reference higher up
  the same path (linked lists, back references) is listed but not expanded again in search/"Add";
  the tree can still expand it by hand.
- "Add" on a struct/FB does not follow pointers or references *below* it (an MC function block would
  otherwise pull in its whole `AXIS_REF`); the user adds `p^` or the reference member itself.
  Adding a pointer adds its target.

## Consequences

Search and "Add" no longer offer symbols that do not exist on the target. Pointer targets are
recordable (Scope saves `Master.McToPlc.Set^.Position` itself). Expanding references in search was
tried and dropped: every MC function block repeated its whole `AXIS_REF` (corpus: 933k entries, one
project over the 250k cap); the referenced values are found under their real symbols instead. With
the rules the corpus index shrinks from 642k to 483k entries (hidden `VAR_INST`, `conditionalshow`
internals no longer expanded), including 9.7k `^` paths. A file that declares a root name twice
(two versions of a library GVL) keeps the first declaration everywhere. Sources persisted by V2.0
keep their old member lists until re-imported.
Assumptions not verified on a target: that Scope cannot sample `monitoring := 'call'` properties, and
that `conditionalshow` members are missing when the library is compiled.
