# 3. Symbol paths and ports per source kind, editable per source

Status: accepted (V2.0) — NC and TcCOM parts unverified, see wayfinder tickets 04/05/11

## Context

Engineering files describe variables, not always their ADS names. Verified from real files: PLC `.tmc`
symbol names are full ADS paths and the port is in `ApplicationName`. Not verifiable offline: how NC
axes and TcCOM instances are named on their ports.

## Decision

| Source | Path | Port |
|---|---|---|
| PLC (`.tmc`) | symbol name as is | `ApplicationName` (`Port_851`), else 851 |
| PLC I/O (`.xti`/`.tsproj`) | var name as is | `Project/@AmsPort` |
| TcCOM (`.tmc` class / `.xti` object) | `<instance>.<area>.<symbol>`, `<instance>.<parameter>` | 350 |
| NC (`.xti`/`.tsproj`) | `<axis>[.<Enc\|Drive>].<group>.<var>` | `SafTask/@AmsPort`, else 501 |

Every source exposes **port**, **path prefix** and **target Net ID** for editing, so a wrong assumption
can be corrected in the UI without a new release. When a PLC `.tmc` and an I/O listing of the same
port are both imported, the complete `.tmc` wins.

## Consequences

PLC import is correct by construction. NC/TcCOM imports carry a visible note until verified.
