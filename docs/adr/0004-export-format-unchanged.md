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

## Addendum (V2.1): channel names and colours

Channels may carry a display name and a colour. Only then does the output change, in the elements
TwinCAT Scope itself writes for them (research ticket 07): the channel's `<Name>` becomes the display
name and its channel-level `NameRelationInfo` `UsedNameType` becomes `Custom`; the colour (signed
32-bit ARGB) goes to `<Channel><DisplayColor>`, `<SeriesStyle><DisplayColor>` and `<MarkColor>`.
Acquisitions keep the symbol names. For channels without a name and colour the output stays
byte-identical; the golden file pins both cases.
