# Thermo-nuclear review

Method: Cursor's [Thermos plugin](https://github.com/cursor/plugins/tree/main/thermos) — the two
rubrics *thermo-nuclear-review* (bugs, breakage, security) and *thermo-nuclear-code-quality-review*
(structure, abstractions, "code judo") run as two independent reviewers, findings merged and
deduplicated.

- **Pass 1** reviewed the whole V1 code base (`main` @ `e7b357f`) and drove the V2 redesign.
- **Pass 2** reviewed the V2 branch diff (`main...claude/offline-target-browser`), as the rubric
  intends; see the second half.

## Pass 1 — V1 code base

Verdict of both reviewers: **not approved.** The code worked for manual patterns, but it had no
symbol/type model and a project model with one tier too many; both blocked the offline target browser,
and they explained most of the duplication.

### Bugs and breakage

| # | Severity | Finding | Status in V2 |
|---|---|---|---|
| H1 | High | Scope files with the same name (e.g. after delete + add, or duplicating twice) silently overwrote each other in the ZIP; names were not sanitized (`/`, `:`, `..`, trailing dot, empty). | Fixed: `nextName`/`uniqueName` on create/duplicate, `sanitizeFileName` + unique names on export, name validation in the UI (`domain/project.ts`, `export/tcscopex.ts#planProject`). |
| H2 | High | PLC `.tmc` imports produced `PLC1.MAIN.x` instead of `MAIN.x` (module name prefixed), so every imported PLC channel failed in Scope; arrays were ignored. The warning claimed PLC TMCs contain no symbols. | Fixed and tested against real PLC TMCs (`catalog/tmc.ts`, `tmc.test.ts`). |
| M1 | Medium | TcCOM `Inputs.Value` and `Outputs.Value` collided (`CModule1.Value`); class name used as instance name; TcCOM symbols got port 851. | Area name kept in the path, instance prefix and port editable per source, default 350 (`ADR 0003`); real naming still to verify (wayfinder tickets 04/05). |
| M2 | Medium | README promised local persistence, but the configuration was lost on reload. | Project persisted (validated on load); imported files in IndexedDB; project save/open as JSON. |
| M3 | Medium | Unbounded counter expansion (`{i:0:99999999}`) froze or crashed the tab. | `MAX_EXPANSION` = 5,000 per channel, enforced by validation. |
| M4 | Medium | Download enabled when *any* template was valid; invalid ones were exported literally (`MAIN.x[{i:1:5]`). | Only valid channels are planned; issues listed before export. |
| L1 | Low | Drag & drop used its own type map (no BYTE/WORD/DWORD/TIME) and wrote `NaN` ports. | One type table for everything; drop parser reports unrecordable symbols, falls back to 851. |
| L2 | Low | `{i:01:10}` produced `1`, not `01`; a counter reused with another range silently took the first. | Zero padding supported; conflicting ranges are an error. |
| L3 | Low | Invalid Net IDs only warned; record time not editable; blank sample time became 0. | Validated settings and targets; record time editable; numeric fields keep a draft and never commit invalid values. |
| L4 | Low | "Add to Scope" stayed enabled 600 ms after click (double add). | Import modal replaced; adding skips duplicates in the axis group. |
| L5–L8 | Low | Parser warnings hidden; sample import replaced all without feedback; unlabeled inputs and no focus trap; README said Node 18. | Warnings shown per source; import reports counts; labeled inputs, native `<dialog>`; README updated. |

### Structure and code quality

| Finding | Remedy taken |
|---|---|
| **No catalog/type model** — parsers flattened symbols, dropped `<DataTypes>` structs, arrays, enums; one-level struct expansion; owner fields copied onto every row. | `catalog/`: sources = roots + type table, lazy tree, wildcard index (ADR 0001). |
| **Pattern tier did not earn its keep** — `{symbols, port}` only, one pattern per imported symbol, four-id action chains, triplicated counters. | Removed: Scope file → Axis group → Channel, id-addressed pure `ops` (ADR 0002). |
| **750-line string-template generator** with 4× unit block, 2× axis style, inline GUIDs (tests could only `toContain`), domain logic in the XML layer. | Fragments deduplicated, planning separated (`planProject`), injectable ids, golden-file test; output proven identical to V1 (ADR 0004). |
| **Duplicated logic** — type map copied into a component (and diverging), size tables ×3, default settings ×2, TMC/XTI parsers near-duplicates, one parser importing helpers from the other, module-level id counter. | `domain/dataTypes.ts` single source; `readModuleRoots` shared by TMC and XTI; deterministic ids from source + path. |
| **Whole-store subscriptions** re-rendering everything on each keystroke; drop parsing and import state inside components. | Selector subscriptions; parsing in `catalog/`, use cases in `state/actions.ts`. |
| **CSS** — tokens only in `App.css`, hard-coded colours, undefined tokens, colliding global class names, two modal implementations. | `ui/styles/tokens.css` (light/dark), one `Dialog`, feature-scoped class names. |

## Pass 2 — V2 branch diff

Both reviewers ran on `main...claude/offline-target-browser` at `078fc7e`.

- **Correctness reviewer:** no High findings; all V1 features still present; PLC paths, multi-dimensional
  and nested array templates, escaping and unique file names checked and correct.
- **Quality reviewer:** "good bones" (pure domain, id-addressed ops, stores never import features) but
  *not approvable as-is* because of four seams that would multiply with every next feature.

| Finding | Severity | Resolution |
|---|---|---|
| One channel concept, four types (`ChannelCandidate`, `ChannelSpec`, `NewChannel`, `DroppedSymbol`) with renamed fields. | Blocker | One `ChannelSpec` in `domain/project.ts`; candidates and the Target Browser drop emit it directly. |
| Picks were closures in the store: stale after a source's prefix/port changed (verified: added `CTCPServer.…` on port 350 after changing both), kept removed sources, needed a module-global drag variable and a cross-feature import. | Blocker / Medium | Picks are plain data (`sourceId`, `path`), resolved against the current catalog when added (`walk.ts#resolvePath`); drag carries JSON; selection is reset when the catalog changes. |
| Non-atomic add: one commit per new target plus one for channels; callers re-queried the store for ids. | Blocker | Pure `mergeChannelSpecs` (targets + dedupe + append) committed once; ops accept caller ids (`addScopeFile(id)`). |
| Tree, search and candidates expanded types separately; candidates for a search hit scanned the 250k-entry index; Inspector repeated it per render. | Blocker | Shared `catalog/walk.ts` (generator walk, `describe`, `memberNodes`, `elementNode`, `resolvePath`); candidates stop at the limit; Inspector memoised; one `{lower, upper}` bounds shape. |
| Active-selection invariant repaired in four places; deleting the active group left it dangling. | Medium | The store binder normalises the selection after every op; `selectActiveFile`/`selectActiveGroup` selectors; the panel effect is gone. |
| Drop handling (two protocols, toast shaping) inside `AxisGroupCard`. | Medium | `dropOnAxisGroup` use case in `state/actions.ts`. |
| `BrowserNode` a bag of optionals; `scopeType!`; untyped `kind`. | Medium | Discriminated union `FolderNode \| SymbolNode`; no non-null assertions in catalog/state. |
| Inline struct parameters ignored `PointerTo` and could collide across modules. | Low | Reuse `readMember`; inline types keyed per module. |
| `.tsproj` Net ID never reached `.xti`/`.tmc` sources of split projects (and was dropped with the redundant PLC I/O source). | Medium | `mergeSources` shares a single Net ID with sources lacking one. |
| Path prefix could not take a typed space; every keystroke re-indexed and re-persisted the catalog. | Medium | Source settings commit on blur/Enter, trimmed then. |
| Arrays over 5,000 elements became channels silently skipped at export. | Low | Reported as "too large for one channel" when adding. |
| IndexedDB restore could be overwritten by an early import. | Low | Import is disabled and a "Restoring…" state shown until hydration finishes. |
| `CreateSymbol`/`CreateSymbols` ignored. | Low | Data areas with `CreateSymbols="false"` skipped; object (`.xti`) parameters without `CreateSymbol` hidden and counted. |
| Big arrays truncated in the tree without a hint. | Low | "… n more elements" row. |
| `planProject` (a UUID per acquisition) on every keystroke; acquisition counting in five places; no project-wide limit. | Low | Domain counters everywhere; export blocked above 20,000 acquisitions. |
| Hidden file input copied four times; project file logic in the header; chevron toggle ×3; dead exports. | Low | `useFilePicker`, `saveProjectFile`/`openProjectFile` actions, `ui/Disclosure`; dead code removed. |

Deliberately **not** done (they are open product decisions, see the wayfinder map): a `Chart` level
between scope file and axis group, `.tcscopex` import, per-task sample times.

Besides the reviews, research on 20 public `.tcscopex` files corrected the NC naming: TwinCAT Scope
saves NC symbols as `Axes.<axis>.<member>` (e.g. `Axes.Axis 1.ActPos`), not `<axis>.Outputs.ToPlc…`
as the first V2 draft assumed (ADR 0003).
