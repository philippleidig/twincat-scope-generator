# Which real TwinCAT files do we test against?

Type: research
Status: resolved

## Question

Collect a large, diverse corpus of public `.tmc`/`.xti`/`.tsproj` files (Beckhoff samples, open-source
libraries and machines) with licences, as a manifest the test suite can fetch.

## Answer

352 real files from 120 public repos (128 PLC TMC, 30 TcCOM TMC, 120 TSPROJ, 74 XTI; 90 MB), all
well-formed XML; manifest with commit-pinned URLs and SPDX licences in `scripts/corpus/manifest.json`
(255 permissively licensed). Running the current importer over all of them: **0 import errors**, 57k
roots, 642k index entries, every sampled path resolves. Defects found: 870 scalar entries with invalid
templates — 832 arrays larger than the 5,000 expansion limit (mostly `POINTER TO ARRAY[0..65535]`
types declared in `<DataTypes>` and resolved as arrays instead of pointers) and 38 empty arrays
(`Elements` 0 → upper < lower).
