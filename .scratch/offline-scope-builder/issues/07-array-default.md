# Should arrays be added as one pattern channel or as individual channels?

Type: grilling
Status: open

## Question

Adding `GVL.aAxis[*].fActPos` from search creates one channel `GVL.aAxis[{i:1:4}].fActPos` that expands
to 4 acquisitions; picking `[3]` in the tree adds only that element. Is "pattern by default" right, or
do you want a per-add choice (pattern vs. expanded channels vs. a sub-range)?
