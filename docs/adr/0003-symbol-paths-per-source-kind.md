# 3. Symbol paths and ports per source kind, editable per source

Status: accepted (V2.0). PLC verified from real `.tmc` files; NC and TcCOM verified from symbol names
in public `.tcscopex` files saved by TwinCAT Scope (wayfinder tickets 04/05); NC encoder/drive paths
still assumed.

## Context

Engineering files describe variables, not always their ADS names, and there is no target to ask.

## Decision

| Source | ADS symbol path | Port |
|---|---|---|
| PLC (`.tmc`) | symbol name as is (`MAIN.x`, `GVL.y`) | `ApplicationName` (`Port_851`), else 851 |
| PLC I/O (`.xti`/`.tsproj`) | var name as is | `Project/@AmsPort` |
| TcCOM object (`.xti`) | `<object name>.<data area>.<symbol>`; parameters `<object name>.<parameter>` (only with `CreateSymbol`) | 350 (task port; editable) |
| TcCOM class (`.tmc`) | as above with prefix `Object1 (<class>)`, TwinCAT's default object name | 350 |
| I/O process image (`.xti`/`.tsproj`) | `<box>.<PDO>.<entry>`, see [ADR 0006](0006-io-process-image-symbols.md) | 27904 + image id |
| NC axis (`.xti`/`.tsproj`) | `Axes.<axis>.<member>` — axis state (`ActPos`, `SetPos`, `ActVelo`, …) and the PLC interface (`ToPlc`, `FromPlc`); encoder/drive variables `Axes.<axis>.<Enc\|Drive>.<var>` (assumed) | `SafTask/@AmsPort`, else 501 |

- Every source exposes **port**, **path prefix** and **target Net ID** for editing (applied on blur),
  so a wrong assumption can be corrected without a release.
- A complete source (PLC `.tmc`) replaces a partial listing of the same runtime (PLC I/O from a
  `.tsproj`, same kind and port).
- Below a root, paths continue with `.member`, `[i,j]` and, through a pointer, `^`
  (`MAIN.pData^.fValue`, as TwinCAT Scope saves it); references add nothing to the path. Which
  members exist at all follows the ADS accessibility rules in [ADR 0005](0005-ads-accessibility-rules.md) (V2.1).
- When the imported files name exactly one Net ID (a `.tsproj`), sources without one adopt it; with
  several Net IDs the user assigns them per source.

## Consequences

The boot project in the corpus (ADR 0006) also holds the NC symbol table: it has no
`Axes.<axis>.Enc.*`/`Drive.*` symbols and more axis state values than listed here — the encoder/drive
assumption looks wrong (open).

PLC, NC axis-state and TcCOM paths match what TwinCAT Scope itself saves. Open: whether Scope needs
real IndexGroup/IndexOffset values for non-PLC symbols (it stores both; the generator writes the PLC
values) — wayfinder ticket 11.
