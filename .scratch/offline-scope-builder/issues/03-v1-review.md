# Where does V1 stand?

Type: research
Status: resolved

## Question

What in the V1 code base blocks an offline target browser, and which bugs must not survive the rewrite?

## Answer

Thermo-nuclear review (both passes) — full report in `docs/review/thermonuclear-review.md`.
Blocking: no type model (structs one level, arrays ignored), wrong PLC paths, Pattern tier, duplicated
type maps, whole-store subscriptions. Bugs: duplicate file names overwrite each other in the ZIP,
unbounded counter expansion, invalid templates exported, project not persisted.
