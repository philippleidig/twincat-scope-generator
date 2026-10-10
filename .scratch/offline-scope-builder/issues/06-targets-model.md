# Where does the target (AMS Net ID) belong: channel, axis group or scope file?

Type: grilling
Status: open

## Question

The prototype stores a target per channel (projects with several IPCs; `.tsproj` imports add their
`TargetNetId` as a target). Is that the right granularity for how you actually work with multi-IPC
machines, or should a scope file / axis group be bound to one target?
