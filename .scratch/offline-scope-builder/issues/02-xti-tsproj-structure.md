# What do real XTI and TSPROJ files look like?

Type: research
Status: resolved

## Question

Which parts of System Manager exports (`.xti`) and projects (`.tsproj`) contain recordable symbols,
ports and target addresses?

## Answer

- Root `TcSmItem` (`ClassName` = `CNcAxisDef`, `CNcSafTaskDef`, `CNestedPlcProjDef`, `CTComObjDef`,
  `CDevEtherCATDef`, `CFlbTermDef`) or `TcSmProject`. The item's own name is often `__FILENAME__`.
- PLC: `<Project AmsPort="851"><Instance><Vars VarGrpType="1|2|8">` — only I/O-linked variables, full names.
- TcCOM objects: `<Module><Name>…</Name><TmcDesc>` with the class's `Parameters`/`DataAreas`.
- NC: `<SafTask AmsPort="501">`, `<Axis>` (inline or `File="X.xti"`) with `Vars` on the axis and on
  `Encoder`/`Drive`.
- `.tsproj`: `<Project TargetNetId="…">` gives the target's AMS Net ID; split projects reference
  `NC.xti`, `Library.xti`, … via `File` attributes.
- Task cycle time: `Task/@CycleTime` in 100 ns, `Context/CycleTime` in ns.
- EtherCAT `Pdo/Entry` data is not symbol-addressable for Scope.
