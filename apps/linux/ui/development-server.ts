import { readFileSync } from "node:fs";

const demoUrl = "http://127.0.0.1:23103/";
const demoId = "97900000-0000-4000-8000-000000000001";

/** A single operator-selected upstream; browser input never selects a proxy target. */
export function developmentServer(env: Record<string, string | undefined>) {
  const url = new URL(env.NAHHASIO_BROWSER_SERVER_URL ?? demoUrl);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("The development server URL must contain only an origin.");
  const remote = url.href !== demoUrl;
  if (remote && url.protocol !== "https:")
    throw new Error("Remote development servers require HTTPS.");
  const serverId = env.NAHHASIO_BROWSER_SERVER_ID ?? (remote ? undefined : demoId);
  if (!serverId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(serverId))
    throw new Error("Configure the verified server identity with NAHHASIO_BROWSER_SERVER_ID.");
  const caPath = env.NAHHASIO_BROWSER_CA_FILE;
  return {
    origin: url.href,
    serverId,
    remote,
    ca: caPath ? readFileSync(caPath) : undefined,
  };
}
