# How do channel display names work?

Type: grilling
Status: resolved

## Answer

User: **name with counters**. Optional `name` on a channel; it may contain the template's counter names
in braces (`Axis {i} ActPos` with symbol `GVL.aAxis[{i:1:4}].fActPos` → "Axis 1 ActPos" …). Empty name =
symbol path (today's behaviour).
