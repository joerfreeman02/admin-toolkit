export interface PublicationKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface WorkerEnv {
  PUBLICATIONS: PublicationKv;
  ADMIN_TOKEN_SHA256: string;
  SESSION_SECRET: string;
  ALLOWED_ORIGIN: string;
}

const PUBLICATION_ID = /^\d{4}-\d{2}-[A-Za-z0-9_-]{22,64}$/;
const MAX_PAYLOAD_BYTES = 1_000_000;
const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function equals(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1)
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function digest(value: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
  );
}

async function createSession(env: WorkerEnv) {
  const payload = base64Url(
    encoder.encode(
      JSON.stringify({
        exp: Date.now() + 5 * 60_000,
        nonce: base64Url(crypto.getRandomValues(new Uint8Array(16))),
      }),
    ),
  );
  return `${payload}.${await sign(payload, env.SESSION_SECRET)}`;
}

async function validSession(request: Request, env: WorkerEnv) {
  const value = request.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (
    !payload ||
    !signature ||
    !equals(signature, await sign(payload, env.SESSION_SECRET))
  )
    return false;
  try {
    const padded = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const data = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

function cors(request: Request, env: WorkerEnv) {
  const origin = request.headers.get("Origin");
  const headers = new Headers();
  if (origin === env.ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-NEXUS-Admin-Code",
    );
    headers.set("Vary", "Origin");
  }
  return headers;
}

function response(
  request: Request,
  env: WorkerEnv,
  status: number,
  body?: unknown,
) {
  const headers = cors(request, env);
  headers.set("Content-Type", "application/json");
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers,
  });
}

function validPublication(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const publication = value as Record<string, unknown>;
  const keys = Object.keys(publication).sort().join(",");
  if (keys !== "cipher,ciphertext,format,kdf,month,version") return false;
  const kdf = publication.kdf as Record<string, unknown> | undefined;
  const cipher = publication.cipher as Record<string, unknown> | undefined;
  return (
    publication.format === "eas-employee-publication" &&
    publication.version === 1 &&
    typeof publication.month === "string" &&
    /^\d{4}-\d{2}$/.test(publication.month) &&
    !!kdf &&
    typeof kdf === "object" &&
    Object.keys(kdf).sort().join(",") === "hash,iterations,name,salt" &&
    kdf.name === "PBKDF2" &&
    kdf.hash === "SHA-256" &&
    typeof kdf.iterations === "number" &&
    Number.isInteger(kdf.iterations) &&
    kdf.iterations >= 100_000 &&
    typeof kdf.salt === "string" &&
    !!cipher &&
    typeof cipher === "object" &&
    Object.keys(cipher).sort().join(",") === "iv,name" &&
    cipher.name === "AES-GCM" &&
    typeof cipher.iv === "string" &&
    typeof publication.ciphertext === "string"
  );
}

export function createWorker() {
  return {
    async fetch(request: Request, env: WorkerEnv) {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") return response(request, env, 204);
      if (
        request.headers.get("Origin") &&
        request.headers.get("Origin") !== env.ALLOWED_ORIGIN
      )
        return response(request, env, 403, { error: "Origin is not allowed." });

      if (url.pathname === "/v1/sessions") {
        if (request.method !== "POST")
          return response(request, env, 405, { error: "Method not allowed." });
        const supplied = request.headers.get("X-NEXUS-Admin-Code");
        if (
          !supplied ||
          !equals(await digest(supplied), env.ADMIN_TOKEN_SHA256)
        )
          return response(request, env, 401, {
            error: "Publishing access was not accepted.",
          });
        return response(request, env, 201, { token: await createSession(env) });
      }

      const publicationId = url.pathname.match(
        /^\/v1\/publications\/([^/]+)$/,
      )?.[1];
      if (!publicationId || !PUBLICATION_ID.test(publicationId))
        return response(request, env, 404, { error: "Not found." });
      const key = `publication:${publicationId}`;
      if (request.method === "GET") {
        const publication = await env.PUBLICATIONS.get(key);
        return publication
          ? new Response(
              publication,
              (() => {
                const headers = cors(request, env);
                headers.set("Content-Type", "application/json");
                headers.set("Cache-Control", "public, max-age=300");
                return { status: 200, headers };
              })(),
            )
          : response(request, env, 404, { error: "Not found." });
      }
      if (request.method === "POST") {
        if (!(await validSession(request, env)))
          return response(request, env, 401, {
            error: "Publishing access was not accepted.",
          });
        if (
          !request.headers
            .get("Content-Type")
            ?.toLowerCase()
            .startsWith("application/json")
        )
          return response(request, env, 415, { error: "JSON is required." });
        const declaredLength = Number(
          request.headers.get("Content-Length") ?? 0,
        );
        if (declaredLength > MAX_PAYLOAD_BYTES)
          return response(request, env, 413, {
            error: "Publication is too large.",
          });
        const text = await request.text();
        if (encoder.encode(text).byteLength > MAX_PAYLOAD_BYTES)
          return response(request, env, 413, {
            error: "Publication is too large.",
          });
        try {
          if (!validPublication(JSON.parse(text))) throw new Error();
        } catch {
          return response(request, env, 422, {
            error: "Publication format is invalid.",
          });
        }
        await env.PUBLICATIONS.put(key, text);
        return response(request, env, 201, { id: publicationId });
      }
      if (request.method === "DELETE") {
        if (!(await validSession(request, env)))
          return response(request, env, 401, {
            error: "Publishing access was not accepted.",
          });
        await env.PUBLICATIONS.delete(key);
        return response(request, env, 204);
      }
      return response(request, env, 405, { error: "Method not allowed." });
    },
  };
}

export default createWorker();
