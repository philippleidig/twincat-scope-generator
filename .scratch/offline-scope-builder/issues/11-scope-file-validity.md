# Are symbol-based acquisitions valid for non-PLC ports as generated?

Type: research
Status: open

## Question

Every acquisition is written with `SymbolBased=true`, `IndexGroup=16448`, `IndexOffset=0`, which is
what Scope saves for PLC symbols. Find (Beckhoff Infosys / Scope documentation / saved sample
`.tcscopex` files) whether NC (501) and TcCOM (35x) symbol acquisitions need different values.
