# Which FB/struct members are reachable by ADS symbol name?

Type: research
Status: resolved

## Question

Properties, references, pointers, interfaces, methods, VAR_IN_OUT/VAR_INST/VAR_TEMP, hide attributes,
`symbol` attributes, `qualified_only`, BIT/STRING/UNION/LTIME: which are ADS symbols, which can Scope
record, and how does each appear in a `.tmc`?

## Answer

Full report with sources: [05-ads-access-report.md](05-ads-access-report.md). A `.tmc` lists more than
the live ADS symbol table: properties without a monitoring pragma, `hide`, `tc_no_symbol`, VAR_INST
appear but are not symbols. Pointers are dereferenceable by name (`p^`, recorded in Beckhoff's own
TF5500 sample); references read through to their target; `call`-monitored properties exist only as
`<PropertyItem>` and cannot be sampled; BIT members are recordable. The resulting rules are the A1
table in `docs/spec/v2.1.md`.
