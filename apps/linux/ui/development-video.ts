import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const root = "/__development_video/";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const lifetimeSeconds = 4 * 60 * 60;

export function developmentVideo() {
  const grants = new Map<string, { id: string; authorization: string; expires: number }>();
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (!request.url?.startsWith(root)) return next();

    const id = request.url.slice(root.length);
    const origin = request.headers.origin;
    const sameOrigin = request.headers["sec-fetch-site"];
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (
      request.headers.host !== "127.0.0.1:23110" ||
      (origin && origin !== "http://127.0.0.1:23110") ||
      (sameOrigin && sameOrigin !== "same-origin")
    ) {
      response.writeHead(403).end();
      return;
    }
    if (!uuid.test(id)) {
      response.writeHead(404).end();
      return;
    }

    if (request.method === "POST") {
      const authorization = request.headers.authorization;
      if (
        origin !== "http://127.0.0.1:23110" ||
        !authorization ||
        !/^Bearer [\w.~-]{1,1024}$/.test(authorization)
      ) {
        response.writeHead(401).end();
        return;
      }
      const now = Date.now();
      for (const [key, grant] of grants) {
        if (grant.expires <= now) grants.delete(key);
      }
      if (grants.size >= 128) {
        response.writeHead(429).end();
        return;
      }
      const grant = randomUUID();
      const proof = randomUUID();
      const url = root + grant;
      grants.set(`${grant}:${proof}`, { id, authorization, expires: now + lifetimeSeconds * 1000 });
      response.setHeader(
        "Set-Cookie",
        `nahhasio_video=${proof}; Path=${url}; HttpOnly; SameSite=Strict; Max-Age=${lifetimeSeconds}`,
      );
      response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify({ url }));
      return;
    }

    const proof = request.headers.cookie?.match(/(?:^|;\s*)nahhasio_video=([\w-]+)(?:;|$)/)?.[1];
    const key = `${id}:${proof ?? ""}`;
    const grant = grants.get(key);
    if (request.method === "DELETE" && origin === "http://127.0.0.1:23110") {
      grants.delete(key);
      response.setHeader(
        "Set-Cookie",
        `nahhasio_video=; Path=${root}${id}; HttpOnly; SameSite=Strict; Max-Age=0`,
      );
      response.writeHead(204).end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    if (!grant || grant.expires <= Date.now()) {
      grants.delete(key);
      response.writeHead(404).end();
      return;
    }

    // Reuse Vite's verified upstream and preserve Range. The server rechecks authorization.
    delete request.headers.cookie;
    request.headers.authorization = grant.authorization;
    request.url = `/__development_api/v1/media/${grant.id}/content`;
    next();
  };
}
