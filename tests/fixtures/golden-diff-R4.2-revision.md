# Golden diff — motor-golden-r4.json, R4.2 native review fixes

Reason: native review `review-98de80990eaba357` found that `flujosMes.reposicionExcedente` was
reported for future (scheduled) months while every other realized field is zero there.

Change: `reposicionExcedente` is now realized-only; future months report the same amount in the new
field `reposicionExcedenteProg` (decision D11 classification unchanged; no money changes).

Verified mechanically (script comparing the previous fixture with the new engine output):

| Change | Count | Mapping |
|---|---|---|
| New field `reposicionExcedenteProg` | 324 (27 datasets × 12 months) | review finding 2, D11 |
| `reposicionExcedente` moved to `reposicionExcedenteProg` in a future month | 3 | review finding 2, D3/Q5 (scheduled ≠ realized) |
| Any other difference | 0 | — |

The legacy fixture `motor-golden.json` is untouched.
