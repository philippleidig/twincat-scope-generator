# How does TwinCAT Scope store channel names and colours?

Type: research
Status: resolved

## Answer

From 20 public `.tcscopex` files (scratch research corpus):

- Display name: `<Channel><Name>Fx</Name>`; the channel-level `<NameRelationInfo>` (direct child of the
  Channel's `<SubMember>`) has `<UsedNameType>Custom</UsedNameType>`; the acquisition keeps its own name
  (`FT_Sensor[0]`) and the interpreter `Y: FT_Sensor[0]`. Without a custom name both are the acquisition
  name and `UsedNameType` is `Acquisition` (what the generator writes today).
- Colour: `<Channel><DisplayColor>` and `<SeriesStyle><DisplayColor>`/`<MarkColor>` carry the same value,
  either a signed 32-bit ARGB integer (`-16744448` = `#008000`) or a .NET colour name (`Red`).
- Side finding for ticket 05: Beckhoff's TF5500 sample records `Slave.McToPlc.Set^.Position` — pointers
  can be dereferenced in symbol paths with `^`.
