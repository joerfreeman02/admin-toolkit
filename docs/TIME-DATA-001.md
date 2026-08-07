# TIME-DATA-001 - Monthly total source of truth

Status: resolved for Sprint 1, with a documented limitation.

## Investigation

The supplied current-period individual timesheets were compared locally against the supplied monthly project-hours reference/manual output for three months. Two deterministic candidates were evaluated: the stored numeric total in column D and the calculated sum of daily cells from column E onwards. Comparisons were performed by anonymised month, project code and employee abbreviation; no identity, project description, filename or hour value is retained here. The reference workbook's formal completed/closed status was not independently proven.

For every cell present in both the source set and the supplied manual output, the numeric column-D rule reproduced the manual value. In the one source row where column D and the daily sum differed, the manual output matched column D and did not match the daily sum. Differences outside the overlap were manual omissions/additions, not competing values for the same populated cell. July was treated as the primary reference/manual-output comparison; May and June supplied supporting overlap evidence.

The historical 2025-26 workbook was inspected for layout and operational conventions only. Without its matching individual timesheets it cannot independently validate column D, so it is not part of the TIME-DATA-001 value evidence.

## Implemented rule

1. Use column D when it is a finite numeric value, including zero.
2. Fall back to the sum of daily cells only when column D is unavailable or non-numeric.
3. Preserve both values and the selected authority in the parsed audit record.
4. Warn whenever both are available and differ by more than 0.01 hours.

This rule is deterministic and reproduces the observed reference/manual-output convention. It does not claim that column D is intrinsically more accurate than the underlying daily entries, nor that the supplied reference was formally closed; it preserves the evidenced administrative comparison rule. Any future business decision to recalculate from daily cells requires a controlled rule change and new acceptance evidence.
