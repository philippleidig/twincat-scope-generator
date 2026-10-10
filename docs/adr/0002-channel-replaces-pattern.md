# 2. A channel is a template; the Pattern tier is removed

Status: accepted (V2.0)

## Context

V1 modelled Scope File → Axis Group → Pattern → Symbol, where a pattern was only `{symbols, port}` and
every import created one pattern per symbol. Every store action needed a chain of four ids.

## Decision

Model Scope File → Axis Group → **Channel**, where a channel holds its template, data type, port and
target. All entities have globally unique ids; pure operations (`domain/project.ts` `ops`) address
entities by their own id and are bound to the zustand store automatically. The project stays a nested
tree (not normalized), because it is small, serialises 1:1 to the project file and renders top-down.

## Consequences

Generated XML is unchanged (each V1 symbol corresponds to one channel). V1 never persisted the project,
so no migration is needed; project files carry `version: 2` and are validated on load.
