import { z } from "zod";
import type {
  ConsolidationResult,
  EncryptedEmployeePublication,
  HistoricalCarryRecord,
  PublicDataset,
  PublicProject,
  PublicTpc,
  TpcResolution,
} from "./domain";

export const EMPLOYEE_VIEWER_TOKEN_KEY = "eas-employee-viewer-token-v1";
export const PUBLICATION_FRAGMENT_PREFIX = "#employee-viewer=";
export const EMPLOYEE_VIEWER_DEMO_FRAGMENT = "#employee-viewer-demo";
export const PBKDF2_ITERATIONS = 310_000;
const PUBLICATION_ID_PATTERN = /^\d{4}-\d{2}-[A-Za-z0-9_-]{8,64}$/;

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
  employees: z
    .array(
      z.object({
        employee: z.string().min(1),
        department: z.enum([
          "Drainage",
          "Transport",
          "Mixed",
          "Sustainability",
        ]),
      }),
    )
    .default([]),
  projects: z.array(
    z.object({
      code: z.string().optional(),
      description: z.string().min(1),
      contributors: z.array(
        z.object({
          employee: z.string().min(1),
          department: z
            .enum(["Drainage", "Transport", "Mixed", "Sustainability"])
            .default("Mixed"),
          hours: z.number().nonnegative(),
        }),
      ),
      carriedHours: z
        .array(
          z.object({
            employee: z.string().min(1),
            department: z
              .enum(["Drainage", "Transport", "Mixed", "Sustainability"])
              .optional(),
            originatingMonth: z.string().regex(/^\d{4}-\d{2}$/),
            hours: z.number().positive(),
          }),
        )
        .default([]),
      outstandingTpcs: z.array(z.lazy(() => PublicTpcSchema)).default([]),
      total: z.number().nonnegative(),
    }),
  ),
  statuses: z.array(
    z.object({
      employee: z.string().min(1),
      kind: z.enum(["unknown-project", "excluded"]),
      hours: z.number().nonnegative(),
      originatingMonth: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
    }),
  ),
  tpcLoaded: z.boolean().default(false),
  unallocatedTpcs: z.array(z.lazy(() => PublicTpcSchema)).default([]),
});

const TpcMoneySchema = z.union([
  z.object({ kind: z.literal("amount"), amount: z.number() }),
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("blank") }),
]);

const PublicTpcSchema: z.ZodType<PublicTpc> = z.object({
  originatingDate: z.string().optional(),
  originatingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  supplier: z.string().min(1),
  description: z.string().min(1),
  projectNumberRaw: z.string().optional(),
  net: TpcMoneySchema,
  vat: TpcMoneySchema,
  gross: TpcMoneySchema,
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

/** A public identifier: it contains no employee or access-code information. */
export function generateEmployeePublicationId(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month))
    throw new Error("A valid reporting month is required for publication.");
  return `${month}-${bytesToBase64Url(
    crypto.getRandomValues(new Uint8Array(12)),
  )}`;
}

export function isEmployeePublicationId(value: string) {
  return PUBLICATION_ID_PATTERN.test(value);
}

export function publicationFilename(publicationId: string) {
  if (!isEmployeePublicationId(publicationId))
    throw new Error("This Employee Viewer link is invalid or incomplete.");
  return `${publicationId}.easpub`;
}

export function publicationAssetPath(publicationId: string) {
  return `publications/${publicationFilename(publicationId)}`;
}

export function employeeViewerUrl(publicationId: string, baseUrl: string) {
  if (!isEmployeePublicationId(publicationId))
    throw new Error("This Employee Viewer link is invalid or incomplete.");
  return `${baseUrl.split("#", 1)[0]}${PUBLICATION_FRAGMENT_PREFIX}${publicationId}`;
}

export type EmployeeViewerLink =
  | { kind: "demo" }
  | { kind: "publication"; publicationId: string }
  | { kind: "legacy"; publication: EncryptedEmployeePublication }
  | { kind: "none" }
  | { kind: "invalid" };

export function createEmployeeDataset(
  result: ConsolidationResult,
  carries: HistoricalCarryRecord[] = [],
  tpcResolution?: TpcResolution,
): PublicDataset {
  if (!result.canExport)
    throw new Error(
      "Employee publication is blocked until every review control passes.",
    );
  const projects = new Map<string, PublicProject>();
  for (const project of result.projects) {
    const key = project.code ?? `uncoded:${project.description}`;
    projects.set(key, {
      code: project.code,
      description: project.description,
      contributors: result.employees
        .filter((employee) => (project.hoursByEmployee[employee.id] ?? 0) > 0)
        .map((employee) => ({
          employee: employee.fullName,
          department: employee.department,
          hours: project.hoursByEmployee[employee.id],
        })),
      carriedHours: [],
      outstandingTpcs: [],
      total: project.total,
    });
  }
  for (const carry of carries) {
    if (!carry.projectCode) continue;
    const project = projects.get(carry.projectCode) ?? {
      code: carry.projectCode,
      description:
        carry.projectDescription ?? "Project description not recorded",
      contributors: [],
      carriedHours: [],
      outstandingTpcs: [],
      total: 0,
    };
    project.carriedHours.push({
      employee: carry.employee,
      department: carry.department,
      originatingMonth: carry.originatingMonth,
      hours: carry.hours,
    });
    projects.set(carry.projectCode, project);
  }
  const publicTpc = (record: TpcResolution["records"][number]): PublicTpc => ({
    originatingDate: record.originatingDate,
    originatingMonth: record.originatingMonth,
    supplier: record.supplier,
    description: record.description,
    projectNumberRaw: record.projectNumberRaw,
    net: record.net,
    vat: record.vat,
    gross: record.gross,
  });
  for (const record of tpcResolution?.allocated ?? []) {
    if (!record.projectCode) continue;
    const project = projects.get(record.projectCode) ?? {
      code: record.projectCode,
      description:
        record.projectDescription ?? "Project description not recorded",
      contributors: [],
      carriedHours: [],
      outstandingTpcs: [],
      total: 0,
    };
    project.outstandingTpcs.push(publicTpc(record));
    projects.set(record.projectCode, project);
  }
  return {
    month: result.month,
    employees: result.employees.map((employee) => ({
      employee: employee.fullName,
      department: employee.department,
    })),
    projects: [...projects.values()],
    statuses: result.employees.flatMap((employee) => {
      const unknown = result.unknownHoursByEmployee[employee.id] ?? 0;
      const excluded = result.excludedHoursByEmployee[employee.id] ?? 0;
      return [
        ...(unknown
          ? [
              {
                employee: employee.fullName,
                kind: "unknown-project" as const,
                hours: unknown,
                originatingMonth: result.month,
              },
            ]
          : []),
        ...(excluded
          ? [
              {
                employee: employee.fullName,
                kind: "excluded" as const,
                hours: excluded,
                originatingMonth: result.month,
              },
            ]
          : []),
        ...carries
          .filter(
            (carry) => !carry.projectCode && carry.employeeId === employee.id,
          )
          .map((carry) => ({
            employee: employee.fullName,
            kind: "unknown-project" as const,
            hours: carry.hours,
            originatingMonth: carry.originatingMonth,
          })),
      ];
    }),
    tpcLoaded: tpcResolution?.loaded ?? false,
    unallocatedTpcs: (tpcResolution?.unallocated ?? []).map(publicTpc),
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

export function parseEmployeeViewerLink(hash: string): EmployeeViewerLink {
  if (hash === EMPLOYEE_VIEWER_DEMO_FRAGMENT) return { kind: "demo" };
  if (!hash.startsWith(PUBLICATION_FRAGMENT_PREFIX)) return { kind: "none" };
  const value = hash.slice(PUBLICATION_FRAGMENT_PREFIX.length);
  if (isEmployeePublicationId(value))
    return { kind: "publication", publicationId: value };
  try {
    return { kind: "legacy", publication: decodePublicationFragment(hash)! };
  } catch {
    return { kind: "invalid" };
  }
}

export class PublishedEmployeePublicationNotFoundError extends Error {
  constructor() {
    super("This published Employee Viewer could not be found.");
  }
}

export async function loadPublishedEmployeePublication(
  publicationId: string,
  fetcher: typeof fetch = fetch,
  baseUrl: string = document.baseURI,
) {
  let response: Response;
  try {
    response = await fetcher(
      new URL(publicationAssetPath(publicationId), baseUrl),
    );
  } catch {
    throw new Error("The encrypted publication could not be opened.");
  }
  if (response.status === 404)
    throw new PublishedEmployeePublicationNotFoundError();
  if (!response.ok)
    throw new Error("The encrypted publication could not be opened.");
  try {
    return parsePublicationFile(await response.text());
  } catch {
    throw new Error("The encrypted publication could not be opened.");
  }
}
