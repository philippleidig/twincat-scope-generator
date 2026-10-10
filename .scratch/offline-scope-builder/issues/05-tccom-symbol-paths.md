# Which ADS symbol paths and port does a TcCOM object instance expose?

Type: task
Status: open

## Question

TcCOM classes (`.tmc`) and objects (`.xti`) are mapped to `<instance>.<data area>.<symbol>` and
`<instance>.<parameter>` on port 350 in the prototype; the instance name and port are editable per
source. Verify on a real target (Target Browser, the task's port) what the names and port really are,
and whether parameters are reachable by symbol at all.
