# 1. Offline symbol catalog with lazy expansion and a wildcard search index

Status: accepted (V2.0)

## Context

Users want to assemble scope projects from engineering files without a PLC connection, browsing and
searching symbols the way the TwinCAT Target Browser does. V1 flattened symbols while parsing, threw
type information away and could not expand structs beyond one level or arrays at all.

## Decision

Importers produce **sources**: root symbols plus the file's **type table**, nothing pre-expanded.
- The tree expands structs, function blocks and arrays on demand from the type table.
- Search runs over an index of every distinct member path. Array indices become `*` with their
  ranges, so array size does not grow the index, and a search hit maps directly onto a counter
  template (`GVL.aAxis[*].fActPos` → `GVL.aAxis[{i:1:4}].fActPos`).
- Adding a struct or array adds every recordable leaf below it, reusing the same walk.
- The index is capped (250k entries, depth 16) and reports truncation.

## Consequences

The pattern engine and the browser share one model. Persisted sources stay small (types + roots) and
go to IndexedDB. Searching for a specific array element (`aAxis[3]`) goes through the tree, not search.
