# Which ADS symbol paths and port does a TcCOM object instance expose?

Type: task
Status: resolved

## Question

TcCOM classes (`.tmc`) and objects (`.xti`) are mapped to `<instance>.<data area>.<symbol>` and
`<instance>.<parameter>` on port 350 in the prototype; the instance name and port are editable per
source. Verify on a real target (Target Browser, the task's port) what the names and port really are,
and whether parameters are reachable by symbol at all.

## Answer

Resolved by research (public `.tcscopex` files):

- `<object name>.<data area>.<symbol>` on the **task port** the object runs in (350, 351, …):
  `Object3 (DraftSimpleEstimator_R2021b).AdditionalInports.TcModuleInput_InCameraPose[0]` (350),
  `Object3 (create_output).Output.last_action` (351),
  `Mover Axis 2.Mover Controller 2.MoverControllerScopeVariable.ActPos` (350).
- The prefix is the object's *name*; `ObjectN (Class)` is only TwinCAT's default name. A class `.tmc`
  therefore defaults to `Object1 (<class>)`; an object `.xti` uses its own name.
- Requires "Create ADS symbols" on the data area (Infosys TE1400).
- Parameters by symbol: no evidence found either way.
