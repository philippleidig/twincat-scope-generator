# Source icons

16×16 icons of the TwinCAT Solution Explorer nodes, cut 1:1 from screenshots in the Beckhoff
Information System (Infosys) and made transparent outside the icon. They are Beckhoff's artwork
(© Beckhoff Automation GmbH & Co. KG), used to show which runtime a source belongs to.

| File | Solution Explorer node | Used for |
|---|---|---|
| `plc.png` | PLC | PLC sources |
| `motion.png` | MOTION | NC sources |
| `device.png` | Device (EtherCAT) | I/O sources |
| `tccom.png` | SYSTEM › TcCOM Objects | TcCOM sources without an icon of their own |
| `system.png` | SYSTEM | other sources |

Sources (Infosys, "TwinCAT 3 – offline configuration" of the EL1382 documentation):

- https://infosys.beckhoff.com/content/1033/el1382/Images/png/2602490379__en-US__Web.png
  (PLC, MOTION, SYSTEM, TcCOM Objects)
- https://infosys.beckhoff.com/content/1033/el1382/Images/png/2605436299__en-US__Web.png
  (Device (EtherCAT))

Icons of terminals and TcCOM modules are not stored here: they come from the imported files
(`<ImageDatas>`, see `src/catalog/bitmap.ts`).
