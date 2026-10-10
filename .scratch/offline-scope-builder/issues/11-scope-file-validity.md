# Are symbol-based acquisitions valid for non-PLC ports as generated?

Type: research
Status: open

## Question

Every acquisition is written with `SymbolBased=true`, `IndexGroup=16448`, `IndexOffset=0`, which is
what Scope saves for PLC symbols. Find (Beckhoff Infosys / Scope documentation / saved sample
`.tcscopex` files) whether NC (501) and TcCOM (35x) symbol acquisitions need different values.

## Answer

Partly answered by research (20 public `.tcscopex`/`.tcscope` files):

- Scope stores IndexGroup/IndexOffset *and* the symbol name for symbol-based acquisitions: PLC 0x4040
  (25 of 26 channels), NC 0x4100+axis id with the axis-state offset, TcCOM the object id with
  0x80000000 (inputs) / 0x81000000 (outputs).
- The generator writes 0x4040/0 for every acquisition, which TwinCAT Scope accepts for PLC symbols
  (V1 users). Whether Scope re-resolves NC/TcCOM addresses from the symbol name at load is **not
  verified** — a live import of an exported NC/TcCOM channel settles it.
