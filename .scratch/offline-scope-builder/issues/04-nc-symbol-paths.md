# Which ADS symbol paths and port does a TwinCAT NC axis expose to Scope?

Type: task
Status: open

## Question

The prototype builds NC paths as `<axis>.<Inputs|Outputs>.<var>` and `<axis>.<Enc|Drive>.<Inputs|Outputs>.<var>`
on port 501 (NC SAF). This is an assumption: the files describe the variables, not their ADS names.

Checklist for someone with a running TwinCAT 3 system (HITL):

1. Open TwinCAT Scope → Target Browser, select the target, port 501 (and 500).
2. Expand an axis; copy the full symbol name of e.g. the actual position.
3. Drag that symbol onto an axis group of the Scope Generator, or paste the drag XML into the ticket.
4. Record the exact naming scheme here (separator, axis name, `Enc`/`Drive` segments).
