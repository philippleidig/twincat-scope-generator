# What do real TMC files look like?

Type: research
Status: resolved

## Question

Which elements of a `.tmc` carry the symbols, their ADS names, types and port — for PLC projects and
for TcCOM (C++/Simulink) modules?

## Answer

From six public TMC files (see `src/catalog/__fixtures__/README.md`):

- PLC TMC: `<Module TcSmClass="TComPlcObjDef">` with `CLSID ClassFactory="TcPlc30"`. `<DataAreas>` with
  `AreaType` `InputDst` / `OutputSrc` / `MArea` / `Internal`. `<Symbol><Name>` is already the full ADS
  path (`MAIN.x`, `GVL.y`) — V1 prefixed it with the module name, which is wrong.
- ADS port: module property `ApplicationName = Port_851` (missing in old files → 851).
- `<DataTypes>`: `SubItem`s (struct/FB members, `ItemType` Input/Output), `ExtendsType` (FB
  inheritance; `PVOID` marks interfaces), `EnumInfo`, `ArrayInfo` (`LBound`, `Elements`),
  `Type PointerTo="1"`/`ReferenceTo`, `Properties` incl. `hide`, `Namespace` attributes with versions.
- No task cycle time in PLC TMCs (it lives in the `.tsproj`/`.xti`).
- TcCOM TMC describes a *class*: `Parameters` (incl. inline `SubItem` structs) and `DataAreas`; the
  instance name is not in the file.
