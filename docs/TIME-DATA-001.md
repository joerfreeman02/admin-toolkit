# TIME-DATA-001 - Monthly total source of truth

Status: resolved for Sprint 1, with a documented limitation.

## Investigation

The supplied individual timesheets were compared locally against the completed monthly project-hours reference for three months. Two deterministic candidates were evaluated: the stored numeric total in column D and the calculated sum of daily cells from column E onwards. Comparisons were performed by anonymised month, project code and employee abbreviation; no identity, project description, filename or hour value is retained here.

For every cell present in both the source set and the established manual output, the numeric column-D rule reproduced the manual value. In the one source row where column D and the daily sum differed, the manual output matched column D and did not match the daily sum. Differences outside the overlap were manual omissions/additions, not competing values for the same populated cell. July was treated as the primary completed reference; May and June supplied supporting overlap evidence.

## Implemented rule

1. Use column D when it is a finite numeric value, including zero.
2. Fall back to the sum of daily cells only when column D is unavailable or non-numeric.
3. Preserve both values and the selected authority in the parsed audit record.
4. Warn whenever both are available and differ by more than 0.01 hours.

This rule is deterministic and reproduces the existing completed-workbook convention. It does not claim that column D is intrinsically more accurate than the underlying daily entries; it preserves the established administrative source of truth. Any future business decision to recalculate from daily cells requires a controlled rule change and new acceptance evidence.
