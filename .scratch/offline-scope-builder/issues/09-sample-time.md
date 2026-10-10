# Should sample times follow the task cycle time?

Type: grilling
Status: open
Blocked by: 06

## Question

`.tsproj`/`.xti` contain task cycle times (`Task/@CycleTime`). Today one project-wide base sample time
is written to every acquisition. Should channels inherit the cycle time of the task their symbol runs
in (per source / per target), with the project value as fallback?
