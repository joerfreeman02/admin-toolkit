import type { EncryptedEmployeePublication } from "./domain";
import { loadPublishedEmployeePublication } from "./publication";

function serviceUrl() {
  const value = import.meta.env.VITE_PUBLICATION_API_URL as string | undefined;
  if (!value)
    throw new Error("Employee Viewer publishing service is not configured.");
  return value.endsWith("/") ? value : `${value}/`;
}

async function apiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // The service deliberately returns no sensitive diagnostics.
  }
  return fallback;
}

export async function createPublishingSession(
  adminCode: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(new URL("v1/sessions", serviceUrl()), {
    method: "POST",
    headers: { "X-NEXUS-Admin-Code": adminCode },
  });
  if (!response.ok)
    throw new Error(
      await apiError(response, "Publishing access was not accepted."),
    );
  const value = (await response.json()) as { token?: unknown };
  if (typeof value.token !== "string" || !value.token)
    throw new Error("Publishing access was not accepted.");
  return value.token;
}

export async function uploadEmployeePublication(
  publicationId: string,
  publication: EncryptedEmployeePublication,
  session: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(
    new URL(`v1/publications/${publicationId}`, serviceUrl()),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(publication),
    },
  );
  if (!response.ok)
    throw new Error(
      await apiError(response, "The Employee Viewer was not published."),
    );
}

export async function revokeEmployeePublication(
  publicationId: string,
  session: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(
    new URL(`v1/publications/${publicationId}`, serviceUrl()),
    { method: "DELETE", headers: { Authorization: `Bearer ${session}` } },
  );
  if (!response.ok)
    throw new Error(
      await apiError(response, "The Employee Viewer could not be revoked."),
    );
}

export function fetchPublishedEmployeePublication(
  publicationId: string,
  fetcher: typeof fetch = fetch,
) {
  return loadPublishedEmployeePublication(publicationId, fetcher, serviceUrl());
}
