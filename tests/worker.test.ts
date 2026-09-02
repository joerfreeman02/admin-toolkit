import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createWorker,
  type PublicationBucket,
  type WorkerEnv,
} from "../worker/src/index";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
});

class MemoryR2 implements PublicationBucket {
  values = new Map<string, string>();
  get(key: string) {
    const value = this.values.get(key);
    return Promise.resolve(
      value === undefined
        ? null
        : {
            text: () => Promise.resolve(value),
          },
    );
  }
  put(key: string, value: string) {
    this.values.set(key, value);
    return Promise.resolve();
  }
  delete(key: string) {
    this.values.delete(key);
    return Promise.resolve();
  }
}

const publication = {
  format: "eas-employee-publication",
  version: 1,
  month: "2026-08",
  kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 310_000, salt: "salt" },
  cipher: { name: "AES-GCM", iv: "iv" },
  ciphertext: "encrypted-only",
};
const id = "2026-08-1234567890123456789012";

async function environment() {
  const hash = [
    ...new Uint8Array(
      await webcrypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("admin-code"),
      ),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return {
    PUBLICATIONS: new MemoryR2(),
    ADMIN_TOKEN_SHA256: hash,
    SESSION_SECRET: "test-secret",
    ALLOWED_ORIGIN: "https://joerfreeman02.github.io",
  } satisfies WorkerEnv;
}

async function session(env: WorkerEnv) {
  const response = await createWorker().fetch(
    new Request("https://worker.test/v1/sessions", {
      method: "POST",
      headers: {
        Origin: env.ALLOWED_ORIGIN,
        "X-NEXUS-Admin-Code": "admin-code",
      },
    }),
    env,
  );
  return ((await response.json()) as { token: string }).token;
}

describe("encrypted publication worker", () => {
  it("authenticates upload, stores only encrypted JSON, and serves it by random ID", async () => {
    const env = await environment();
    const token = await session(env);
    const upload = await createWorker().fetch(
      new Request(`https://worker.test/v1/publications/${id}`, {
        method: "POST",
        headers: {
          Origin: env.ALLOWED_ORIGIN,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(publication),
      }),
      env,
    );
    expect(upload.status).toBe(201);
    expect(env.PUBLICATIONS.values.get(`publication:${id}.json`)).toBe(
      JSON.stringify(publication),
    );
    expect(JSON.stringify([...env.PUBLICATIONS.values.values()])).not.toContain(
      "admin-code",
    );

    const read = await createWorker().fetch(
      new Request(`https://worker.test/v1/publications/${id}`, {
        headers: { Origin: env.ALLOWED_ORIGIN },
      }),
      env,
    );
    expect(read.status).toBe(200);
    expect(read.headers.get("Cache-Control")).toBe("no-store");
    expect(await read.json()).toEqual(publication);
  });

  it("rejects unauthenticated writes, malformed/cross-origin requests, and has no public listing", async () => {
    const env = await environment();
    const worker = createWorker();
    const unauthorised = await worker.fetch(
      new Request(`https://worker.test/v1/publications/${id}`, {
        method: "POST",
        headers: {
          Origin: env.ALLOWED_ORIGIN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(publication),
      }),
      env,
    );
    expect(unauthorised.status).toBe(401);
    const token = await session(env);
    const malformed = await worker.fetch(
      new Request(`https://worker.test/v1/publications/${id}`, {
        method: "POST",
        headers: {
          Origin: env.ALLOWED_ORIGIN,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{not-json}",
      }),
      env,
    );
    expect(malformed.status).toBe(422);
    const tooLarge = await worker.fetch(
      new Request(`https://worker.test/v1/publications/${id}`, {
        method: "POST",
        headers: {
          Origin: env.ALLOWED_ORIGIN,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": "1000001",
        },
        body: JSON.stringify(publication),
      }),
      env,
    );
    expect(tooLarge.status).toBe(413);
    expect(
      (
        await worker.fetch(
          new Request("https://worker.test/v1/publications", {
            headers: { Origin: env.ALLOWED_ORIGIN },
          }),
          env,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await worker.fetch(
          new Request("https://worker.test/v1/publications/bad", {
            headers: { Origin: env.ALLOWED_ORIGIN },
          }),
          env,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await worker.fetch(
          new Request(`https://worker.test/v1/publications/${id}`, {
            headers: { Origin: "https://attacker.example" },
          }),
          env,
        )
      ).status,
    ).toBe(403);
  });

  it("returns missing after authenticated revocation", async () => {
    const env = await environment();
    const token = await session(env);
    env.PUBLICATIONS.values.set(
      `publication:${id}.json`,
      JSON.stringify(publication),
    );
    const deleted = await createWorker().fetch(
      new Request(`https://worker.test/v1/publications/${id}`, {
        method: "DELETE",
        headers: {
          Origin: env.ALLOWED_ORIGIN,
          Authorization: `Bearer ${token}`,
        },
      }),
      env,
    );
    expect(deleted.status).toBe(204);
    expect(
      (
        await createWorker().fetch(
          new Request(`https://worker.test/v1/publications/${id}`, {
            headers: { Origin: env.ALLOWED_ORIGIN },
          }),
          env,
        )
      ).status,
    ).toBe(404);
  });

  it("rejects unauthenticated revocation", async () => {
    const env = await environment();
    const deleted = await createWorker().fetch(
      new Request(`https://worker.test/v1/publications/${id}`, {
        method: "DELETE",
        headers: { Origin: env.ALLOWED_ORIGIN },
      }),
      env,
    );
    expect(deleted.status).toBe(401);
  });
});
