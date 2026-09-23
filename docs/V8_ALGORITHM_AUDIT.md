# Algorithm v8 audit

This branch contains the v8 matching algorithm candidate.

## Changes

- Character calibration offsets compensate for oversized/undersized Voronoi cells in the 25-character result space.
- Music is a soft specialist signal for Iliodor/Evstatiy, not a hard gate.
- Clarification is only considered for the actual #1 and #2 candidates.
- A clarification is never shown unless different possible answers can produce different winners for that pair.
- The generic G question is no longer forced as a fallback.
- Clarification evidence has a stronger local weight (3.0).
- At most two clarification questions are used.
- The old rule that discarded clarification answers and restored the original winner has been removed.

## Monte Carlo validation

100,000 seeded random runs using uniformly random answer choices:

- Result frequency range: **2.080% to 7.153%**
- No clarification: **58.16%**
- Exactly one clarification: **39.27%**
- Two clarifications: **2.56%**
- Any clarification: **41.84%**
- Clarification changed the pre-clarification winner in **19.50%** of all runs.
- Exhaustive branch audit on sampled clarification states found **0 useless clarification questions**.

The requested lower-frequency characters all exceed 2% in this audit:
Yarko 4.290%, Sanko 7.153%, Urko 3.394%, Bernat 4.432%, Turka 2.674%,
Gasparh 2.284%, Ravi 2.474%, Amodikh 2.178%, Anso 2.080%.

The old pathological examples are corrected:
- ADADADADADAD: no clarification is shown.
- CBCBCBCBCBDB: divider J is shown; A/C lead to Dzhara, B/D lead to Nadir.
