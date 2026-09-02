import {
  EMPLOYEE_VIEWER_ACCESS_CODE_KEY,
  EMPLOYEE_VIEWER_KEYRING_KEY,
  EMPLOYEE_VIEWER_TOKEN_KEY,
} from "./publication";

function parseKeyring(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        ),
      ),
    ].slice(0, 12);
  } catch {
    return [];
  }
}

/** Safely promotes the single-token pilot setting in either UI entry order. */
function migrateLegacyEmployeeViewerAccess(storage: Storage) {
  const remembered = parseKeyring(storage.getItem(EMPLOYEE_VIEWER_KEYRING_KEY));
  const legacy = storage.getItem(EMPLOYEE_VIEWER_TOKEN_KEY);
  const tokens =
    legacy && !remembered.includes(legacy)
      ? [legacy, ...remembered]
      : remembered;
  if (tokens.length)
    storage.setItem(EMPLOYEE_VIEWER_KEYRING_KEY, JSON.stringify(tokens));
  const configured = storage.getItem(EMPLOYEE_VIEWER_ACCESS_CODE_KEY);
  if (!configured && legacy)
    storage.setItem(EMPLOYEE_VIEWER_ACCESS_CODE_KEY, legacy);
  if (legacy) storage.removeItem(EMPLOYEE_VIEWER_TOKEN_KEY);
  return { tokens, configured: configured ?? legacy ?? "" };
}

/** Migrates the single-token pilot setting without discarding its value. */
export function loadRememberedEmployeeViewerTokens(storage = localStorage) {
  return migrateLegacyEmployeeViewerAccess(storage).tokens;
}

export function rememberEmployeeViewerToken(
  token: string,
  storage = localStorage,
) {
  if (!token) return loadRememberedEmployeeViewerTokens(storage);
  const tokens = [
    token,
    ...loadRememberedEmployeeViewerTokens(storage).filter(
      (item) => item !== token,
    ),
  ].slice(0, 12);
  storage.setItem(EMPLOYEE_VIEWER_KEYRING_KEY, JSON.stringify(tokens));
  return tokens;
}

export function forgetRememberedEmployeeViewerTokens(storage = localStorage) {
  storage.removeItem(EMPLOYEE_VIEWER_KEYRING_KEY);
  storage.removeItem(EMPLOYEE_VIEWER_TOKEN_KEY);
}

export function loadConfiguredEmployeeViewerAccessCode(storage = localStorage) {
  return migrateLegacyEmployeeViewerAccess(storage).configured;
}

export function saveConfiguredEmployeeViewerAccessCode(
  token: string,
  storage = localStorage,
) {
  if (token) storage.setItem(EMPLOYEE_VIEWER_ACCESS_CODE_KEY, token);
  else storage.removeItem(EMPLOYEE_VIEWER_ACCESS_CODE_KEY);
}
