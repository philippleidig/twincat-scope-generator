# 6. I/O devices: the process image by ADS symbol name

Status: accepted (V2.2). EtherCAT verified against a real ADS symbol table; other fieldbuses and
modules assumed.

## Context

Users want to record I/O directly, without a PLC variable linked to it: an EtherCAT terminal's
`Value`, a drive's status word, a PROFINET box's inputs. TwinCAT offers this per I/O device: on the
**ADS** tab of the device's **Image** ("Enable ADS Server", "Create symbols", port shown as
`27905 (0x6D01)`), the process image gets its own ADS server and symbol table, which Scope's Target
Browser shows as "AdsPort of Image 1 (27905)". The devices are part of the `.tsproj` or exported as
`.xti` files (`Device 1 (EtherCAT).xti`, also single terminals).

## Evidence

- Beckhoff Infosys: Scope oversampling ("ADS tab of the EtherCAT process image … Create symbols …
  AdsPort of Image X (27905)", full names like `Term 5 (EL3702).Ch1 Sample 0[T20].Ch1 Value`); OPC UA
  server "EtherCAT Master" (ADS server in the image, `Port_27905.tmc`, option "Generate hierarchical
  symbol names"); OPC UA port table (EtherCAT master 27905, 27906, …; all symbols released).
- Beckhoff-USA-Community/TcDynamicIO (enables the image's ADS server through the Automation Interface;
  screenshot of the Target Browser: `27906: AdsPort of Image 2` with `Inputs`, `Outputs`,
  `Term 6 (EK1818).Channel 1.Input`, boxes at top level even behind an EK1914).
- **Reference symbol table**: a public project (SeanyCash/TwinCAT_CNC) committed its boot folder. Its
  `CurrentConfig.xml` holds the symbol table TwinCAT downloads to port 27905 (`IO: Download Symbols`,
  index group 0xF00D) for `Device 2 (EtherCAT) › Image` (`<Image Id="1" ImageFlags="#x00000030">`).
  The corpus run (`npm run test:corpus`) parses it and requires the importer to produce exactly its
  149 leaf paths.

## Decision

`catalog/io.ts` makes one source of kind **IO** per process image (`<Device><Image>`) that has
symbols:

| What | ADS symbol path | Notes |
|---|---|---|
| port | 27904 + `Image/@Id` (`0x6D00 + id`) | editable per source; preset 27905/27906 |
| EtherCAT device | `Inputs.Frm0State`, `Inputs.Frm0WcState`, `Inputs.Frm0InputToggle`, `Outputs.Frm0Ctrl`, `Outputs.Frm0WcCtrl` | not in the file, added by TwinCAT |
| EtherCAT box, per PDO **assigned to a sync manager** (`<Pdo SyncMan>`) | `<box>.<PDO>` as struct `<PDO>_TYPE`; entries split at `__` into nested structs (`Status__Error` → `.Status.Error`), `X__ARRAY [i]` → array `X`; unnamed entries and `X__` are padding | boxes flat at top level, whatever coupler they sit behind |
| EtherCAT box with process data | `<box>.WcState` (BOOL), `<box>.InputToggle` (BOOL, with inputs) | InfoData has no symbol |
| PDO whose single entry has its name | `<box>.<PDO>` scalar | from the EL3702 screenshot |
| PDO of a module (`<Slot><Module><PdoIndex>`) | `<box>.<module>.<PDO>` | **assumed**, note on the root |
| other fieldbuses (PROFINET, PROFIBUS, CANopen, EtherNet/IP, …) | `<box>[.<sub-item>].<Vars group>.<var>`; device `<Vars>` as `<group>.<var>` | **assumed**, source warning |

- **Enabled or not**: `ImageFlags` with bits `0x30` = ADS server and symbols on (the reference
  project); without them the source is still listed, with a warning to enable both on the Image.
- **Several images** (one per task accessing the device, `Image`, `Image-2`): with links in the same
  file, boxes linked to the NC (`<Mappings>` `TINC^…` ↔ `TIID^<device>^<box>`) go to the first image,
  all others to the second (as in the reference project); without links all go to the first, with a
  warning. Each image is its own source with its own port.
- A **terminal exported alone** (`.xti` with a `<Box>`) becomes an IO source on 27905 with a warning:
  its device and image are not in the file.
- Disabled boxes are skipped; a disabled device is listed with a warning.
- "Generate hierarchical symbol names" changes the names (nested boxes, `SM_0` levels); not supported —
  the hint asks to keep it off.
- Member names may contain dots (`Current actual value Ch.1`); `resolvePath` matches the longest member
  name, so such paths resolve.

## Consequences

EtherCAT I/O can be browsed, searched and added like PLC symbols, on the image's port. The exporter
writes I/O channels like all others (`IndexGroup` 0x4040, offset 0, symbol based); whether Scope
re-resolves them from the symbol name is the same open question as for NC/TcCOM (wayfinder ticket 11).
Every project with an EtherCAT master now also yields an IO source (with the "not enabled" warning
when the file says so); remove it if not needed.

Side finding from the same boot project's NC table (port 501): the NC has symbols for more axis state
values than the importer lists (`AxisState`, `ErrState`, `ControlDWord`, `StateDWord`, `SetTorque`, …),
and **no** `Axes.<axis>.Enc.*`/`Drive.*` symbols — the encoder/drive paths of ADR 0003 are not ADS
symbols there. Not changed yet.
