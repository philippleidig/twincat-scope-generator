# Which ADS symbol paths and port does a TwinCAT NC axis expose to Scope?

Type: task
Status: resolved

## Question

The prototype builds NC paths as `<axis>.<Inputs|Outputs>.<var>` and `<axis>.<Enc|Drive>.<Inputs|Outputs>.<var>`
on port 501 (NC SAF). This is an assumption: the files describe the variables, not their ADS names.

Checklist for someone with a running TwinCAT 3 system (HITL):

1. Open TwinCAT Scope → Target Browser, select the target, port 501 (and 500).
2. Expand an axis; copy the full symbol name of e.g. the actual position.
3. Drag that symbol onto an axis group of the Scope Generator, or paste the drag XML into the ticket.
4. Record the exact naming scheme here (separator, axis name, `Enc`/`Drive` segments).

## Answer

Resolved by research (public `.tcscopex` files saved by TwinCAT Scope, Beckhoff Infosys) instead of
a live target; confirm on a real system when convenient.

- NC symbols are `Axes.<axis name>.<member>` on port **501**, e.g. `Axes.Axis 1.SetPos`
  (Beckhoff/TF5550_Samples), `Axes.M3K2 X.ActPos`, `Axes.WheelLeft.ActVelo`, and for the PLC interface
  `Axes.Axis 3 Virtual.ToPlc.StateDWord.NotMoving` (the `Inputs`/`Outputs` group name is *not* part of the path).
- Axis-state members documented for symbolic access (Infosys "Index offset specification for axis
  state", IG 0x4100+ID): `ActPos`, `SetPos`, `ActVelo`, `SetVelo`, `ActAcc`, `SetAcc`, `PosDiff`, `ActTorque`, …
- Symbols exist only with the axis option "Create symbols" (Infosys TF50x0).
- The prototype's scheme (`<axis>.Outputs.ToPlc…`) was wrong and is replaced (ADR 0003).
- Still unverified: names below encoder/drive (`Axes.<axis>.<Enc>.<var>` is assumed) — see Not yet specified.
