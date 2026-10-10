# 4. Keep the generated XML byte-compatible; make it deterministic

Status: accepted (V2.0)

## Context

The `.tcscopex` templates mirror files saved by TwinCAT Scope and are known to import. The refactor
deduplicated repeated fragments (unit block, axis style) and moved planning out of the XML layer.

## Decision

Output must stay identical to V1 for the same input (verified by comparing old and new generator
output with normalised GUIDs during the refactor). GUIDs come from an injectable id generator so the
golden-file test (`src/export/__snapshots__`) pins the exact output. File names are sanitized and made
unique before zipping (V1 silently overwrote duplicates).
