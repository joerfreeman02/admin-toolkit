import { z } from "zod";
import type {
  ConsolidationResult,
  EncryptedEmployeePublication,
  PublicDataset,
} from "./domain";

export const EMPLOYEE_VIEWER_TOKEN_KEY = "eas-employee-viewer-token-v1";
export const PUBLICATION_FRAGMENT_PREFIX = "#employee-viewer=";
export const PBKDF2_ITERATIONS = 310_000;

const EncryptedPublicationSchema = z.object({
  format: z.literal("eas-employee-publication"),
  version: z.literal(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  kdf: z.object({
    name: z.literal("PBKDF2"),
    hash: z.literal("SHA-256"),
    iterations: z.number().int().min(100_000),
    salt: z.string().min(1),
  }),
  cipher: z.object({
    name: z.literal("AES-GCM"),
    iv: z.string().min(1),
  }),
  ciphertext: z.string().min(1),
});

const PublicDatasetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  projects: z.array(
    z.object({
      code: z.string().optional(),
      description: z.string().min(1),
      contributors: z.array(
        z.object({
          employee: z.string().min(1),
          hours: z.number().nonnegative(),
        }),
      ),
      total: z.number().nonnegative(),
    }),
  ),
});

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function exactBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveKey(token: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: exactBuffer(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function generateEmployeeViewerToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function createEmployeeDataset(
  result: ConsolidationResult,
): PublicDataset {
  if (!result.canExport)
    throw new Error(
      "Employee publication is blocked until every review control passes.",
    );
  return {
    month: result.month,
    projects: result.projects.map((project) => ({
      code: project.code,
      description: project.description,
      contributors: result.employees
        .filter((employee) => (project.hoursByEmployee[employee.id] ?? 0) > 0)
        .map((employee) => ({
          employee: employee.fullName,
          hours: project.hoursByEmployee[employee.id],
        })),
      total: project.total,
    })),
  };
}

export async function encryptEmployeeDataset(
  dataset: PublicDataset,
  token: string,
): Promise<EncryptedEmployeePublication> {
  PublicDatasetSchema.parse(dataset);
  if (!token) throw new Error("Employee Viewer token is required.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(token, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(dataset));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: exactBuffer(iv) },
    key,
    plaintext,
  );
  return {
    format: "eas-employee-publication",
    version: 1,
    month: dataset.month,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64Url(salt),
    },
    cipher: { name: "AES-GCM", iv: bytesToBase64Url(iv) },
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptEmployeePublication(
  value: unknown,
  token: string,
): Promise<PublicDataset> {
  const publication = EncryptedPublicationSchema.parse(value);
  const key = await deriveKey(
    token,
    base64UrlToBytes(publication.kdf.salt),
    publication.kdf.iterations,
  );
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: exactBuffer(base64UrlToBytes(publication.cipher.iv)),
      },
      key,
      exactBuffer(base64UrlToBytes(publication.ciphertext)),
    );
    return PublicDatasetSchema.parse(
      JSON.parse(new TextDecoder().decode(plaintext)),
    );
  } catch {
    throw new Error(
      "The Employee Viewer token is incorrect or the publication is damaged.",
    );
  }
}

export function encodePublicationFragment(value: EncryptedEmployeePublication) {
  const json = new TextEncoder().encode(
    JSON.stringify(EncryptedPublicationSchema.parse(value)),
  );
  return `${PUBLICATION_FRAGMENT_PREFIX}${bytesToBase64Url(json)}`;
}

export function decodePublicationFragment(hash: string) {
  if (!hash.startsWith(PUBLICATION_FRAGMENT_PREFIX)) return undefined;
  const json = new TextDecoder().decode(
    base64UrlToBytes(hash.slice(PUBLICATION_FRAGMENT_PREFIX.length)),
  );
  return EncryptedPublicationSchema.parse(JSON.parse(json));
}

export function parsePublicationFile(text: string) {
  return EncryptedPublicationSchema.parse(JSON.parse(text));
}
