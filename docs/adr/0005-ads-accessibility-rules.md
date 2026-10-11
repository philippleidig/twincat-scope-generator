# 5. The browser offers exactly what can be recorded by ADS symbol name

Status: accepted (V2.1). Rules from research ticket 05
([report with sources](../../.scratch/browser-editor-v2-1/issues/05-ads-access-report.md)), checked
against 352 real files (ticket 06, `npm run test:corpus`).

## Context

A PLC `.tmc` lists more than the ADS symbol table of the running PLC holds: symbols and members marked
`hide`, `TcNoSymbol` and `conditionalshow`, implicit `VAR_INST` members, properties, static variables.
V2.0 offered some of them as recordable (they fail in Scope), and resolved pointers to arrays
(`<ArrayInfo PointerTo="1">`) as arrays of up to 65,536 elements.

## Decision

Each row below is decided by one function in `catalog/access.ts` (`symbolAccess`, `memberAccess`,
`typeAccess`); the XML readers only collect facts. `catalog/typeTable.ts` resolves declarations
(`resolveDecl`), drops members whose type has no symbols when a type is registered and roots in
`finalizeSource`; the walker (`catalog/walk.ts`) only expands what it gets, so tree, search index,
"Add" candidates and `resolvePath` agree.

| Construct in the `.tmc` | Browser |
|---|---|
| `hide`, `TcNoSymbol` (no value) on a symbol or member; `implicit_inst_var` (VAR_INST); locals of a POU with `hide_all_locals`; empty arrays (`Elements` 0); methods, their parameters/locals; properties without pragma | **Hidden** (not in tree, search or candidates) |
| a DataType marked `hide` or `TcNoSymbol` | **no effect** on symbols/members of that type: the attribute hides the type's declaration, not its instances (`TwinCAT_SystemInfoVarList.__PlcTask` of the hidden type `_Implicit_Task_Info` is a real ADS symbol) |
| `<PropertyItem>` (property with `monitoring := 'call'`) | **Disabled**: "Property (called on access) — Scope cannot sample it" |
| `<Name Static="true">` without `<BitOffs>` (VAR_STAT) | **Disabled** below instances: "Static variable — record `<FB type>.<var>`"; the global `<FB type>.<var>` symbol (`TcVarStatic`) is a normal root |
| `conditionalshow` on symbol/member/type, locals under `conditionalshow_all_locals` | **Disabled**: "Hidden in compiled libraries" |
| `POINTER TO` (`<Type PointerTo="n">`, `<ArrayInfo PointerTo="n">`, a `POINTER TO …` type name) | the pointer is **disabled** and has one child `^` (path `p^`, type = target); `PointerTo="2"` → `^^` |
| `REFERENCE TO` (`ReferenceTo="true"`), `VAR_IN_OUT` (`ItemType` `InOut`, an array included) | expanded like the referenced type (no `^`) in the tree and `resolvePath`, and by "Add" only when the reference itself is added; recordable with the warning "Valid only while the reference is bound". The search index lists the reference member itself, not its target |
| `TcNoSymbol 'unused'` | recordable, with a note (inherited by members) |
| interfaces, `STRING`/`WSTRING`, platform-sized types | **Disabled** with a reason (as in V2.0) |
| `qualified_only`, `<Hides>`, CODESYS `symbol` attribute | ignored |

What the walk does with indirections below its start is explicit (`WalkOptions`: `expand`, `list`
or `skip` per pointers and references):

- **Search** expands pointer targets (that is how `p^` paths are found) and lists reference members
  without expanding them: an MC function block's `Axis` would otherwise repeat the whole `AXIS_REF`;
  the referenced values are found under their real symbols.
- **"Add"** skips both below the added symbol; the user adds `p^` or the reference member itself
  (the start is always expanded). Adding a pointer adds its target.
- Pointers and references reached without passing another followed indirection are always
  followed (every FB instance's `pCfg^`, sibling pointers to the same type). *Below* a followed
  indirection, a pointer or reference *declaration* (a member, plus the `[]`/`^` hops below it)
  already followed in this walk is listed, not expanded again: a linked list stops after one hop
  and FBs that point at each other stay linear (declarations × target size) instead of combinatorial. The walk's depth limit (16) cuts long
  chains of back pointers (a state machine's states pointing at the machine) without flagging the
  index as incomplete. The tree expands any of them by hand.
- The 250k search entries are shared by water-filling: nothing is cut while all sources fit, and
  when they do not, small sources keep everything and the rest is split evenly, so one huge source
  cannot starve the others.

## Consequences

Search and "Add" no longer offer symbols that do not exist on the target. Pointer targets are
recordable (Scope saves `Master.McToPlc.Set^.Position` itself). Expanding references in search was
tried and dropped: every MC function block repeated its whole `AXIS_REF` (corpus: 933k entries, one
project over the 250k cap); the referenced values are found under their real symbols instead. With
the rules the corpus index (352 files) shrinks from 642k to 505k entries (hidden `VAR_INST`,
`conditionalshow` internals no longer expanded), 405k of them recordable values and 10.8k `^`
paths; no source is truncated, every sampled path resolves, and the 2,015 templates over the
5,000 expansion limit are reported by "Add" (the 38 empty-array templates of V2.0 are gone). A file that declares
a root name twice (two versions of a library GVL) keeps the first declaration everywhere. Sources
persisted by V2.0 are dropped on load with a hint to import the files again.

An earlier draft hid every symbol of a type marked `hide`/`TcNoSymbol`; that removed real symbols
(`__PlcTask`, `Global_Variables.TcMcGlobal`, MC function block internals) and was reverted. Types
that are also `conditionalshow` (e.g. `_FB_MoveUniversalGeneric`, `_TCMCGLOBAL`) stay disabled.
Assumptions not verified on a target: that Scope cannot sample `monitoring := 'call'` properties, and
that `conditionalshow` members are missing when the library is compiled.
