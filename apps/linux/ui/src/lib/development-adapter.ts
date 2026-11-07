import {
  LoginRequestSchema,
  LoginResponseSchema,
  ServerInfoSchema,
  SessionSchema,
} from "@nahhasio/api-contract";
import { z } from "zod";

import packageInfo from "../../package.json";
import { queryClient } from "../app/query-client";
import { preferencesSchema } from "../features/catalog/browse-preferences-model";
import { ArtworkQueue, DevelopmentArtwork } from "./development-artwork";
import { developmentBrowserAvailable } from "./development-platform";

const origin = import.meta.env.VITE_NAHHASIO_BROWSER_SERVER_URL ?? "http://127.0.0.1:23103/";
const expectedServerId =
  import.meta.env.VITE_NAHHASIO_BROWSER_SERVER_ID ?? "97900000-0000-4000-8000-000000000001";
const nameKey = `nahhasio:development:server-name:${expectedServerId}`;
const prefix = "/__development_api";
type DevelopmentReply = z.infer<typeof z.json>;
let token: string | null = null;
let session: z.infer<typeof SessionSchema> | null = null;
let requests = new AbortController();
let generation = 0;
const artwork = new DevelopmentArtwork(queryClient.getQueryCache());
const artworkQueue = new ArtworkQueue();

function clearSession() {
  generation++;
  requests.abort();
  requests = new AbortController();
  artwork.clear();
  token = null;
  session = null;
}
function unsupported(): never {
  throw new Error("هذه الميزة تحتاج تطبيق Linux؛ معاينة المتصفح مخصّصة للتطوير المحلي.");
}
async function transport(
  path: string,
  method: string,
  body: z.input<typeof z.json> | undefined,
  signal?: AbortSignal,
  anonymous = false,
  binary = false,
) {
  if (!anonymous && !token) throw new Error("سجّل الدخول إلى مكتبة التطوير أولًا.");
  const headers = new Headers();
  if (token && !anonymous) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const combined = AbortSignal.any([
    requests.signal,
    AbortSignal.timeout(25000),
    ...(signal ? [signal] : []),
  ]);
  const response = await fetch(`${prefix}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: combined,
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    if (response.status === 401 && !anonymous) {
      clearSession();
      window.dispatchEvent(new Event("nahhasio:signed-out"));
    }
    const errors = {
      400: "تحقق من البيانات ثم أعد المحاولة.",
      401: anonymous
        ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        : "انتهت جلسة الاتصال؛ سجّل الدخول مجددًا.",
      403: "لا يملك حسابك صلاحية تنفيذ هذه العملية.",
      404: "العنصر المطلوب غير موجود.",
      409: "تغيّرت البيانات؛ أعد تحميل الصفحة قبل الحفظ.",
      422: "لم يقبل الخادم صيغة الطلب. تحقق من توافق إصدار التطبيق والخادم.",
      429: "محاولات كثيرة؛ انتظر قليلًا قبل المحاولة مجددًا.",
    };
    throw new Error(
      Object.entries(errors).find(([code]) => Number(code) === response.status)?.[1] ??
        "تعذّر الاتصال بخادم التطوير أو إكمال الطلب.",
      { cause: { status: response.status } },
    );
  }
  if (response.status === 204) return null;
  const value = binary ? await response.blob() : z.json().parse(await response.json());
  combined.throwIfAborted();
  return value;
}
async function request(
  path: string,
  method: string,
  body: z.input<typeof z.json> | undefined,
  signal?: AbortSignal,
  anonymous = false,
): Promise<DevelopmentReply> {
  const current = generation;
  const result = await transport(path, method, body, signal, anonymous);
  if (current !== generation) throw new DOMException("Session changed", "AbortError");
  return z.json().parse(result);
}
const getRoutes = {
  home: "/v1/catalog/home",
  filters: "/v1/catalog/filters",
  browse: "/v1/catalog/browse",
  facets: "/v1/catalog/facets",
  works: "/v1/works",
  releases: "/v1/releases",
  episodes: "/v1/catalog/episodes",
  trailers: "/v1/catalog/trailers",
  profile: "/v1/me",
  adminAccess: "/v1/admin/access",
  adminWorks: "/v1/admin/works",
  adminWorksSelection: "/v1/admin/works/selection",
  databaseSchema: "/v1/admin/database/schema",
  serverOverview: "/v1/admin/server/overview",
  serverSettings: "/v1/admin/server/settings",
  serverOperations: "/v1/admin/server/operations",
  adminMedia: "/v1/admin/media",
  adminMediaCoverage: "/v1/admin/media/coverage",
  adminMediaUnits: "/v1/admin/media/units",
  adminMediaIncoming: "/v1/admin/media/incoming",
  adminMediaJobs: "/v1/admin/media/jobs",
};
const writeRoutes = {
  editorCall: { path: "/v1/admin/editor", method: "POST" },
  workRead: { path: "/v1/admin/works/read", method: "POST" },
  workReview: { path: "/v1/admin/works/review", method: "POST" },
  workSave: { path: "/v1/admin/works/save", method: "POST" },
  renameServer: { path: "/v1/admin/server/settings", method: "PATCH" },
  updateProviders: { path: "/v1/admin/server/providers", method: "PUT" },
  updateProfile: { path: "/v1/me", method: "PATCH" },
  updatePassword: { path: "/v1/me/password", method: "POST" },
  requestServerOperation: { path: "/v1/admin/server/operations", method: "POST" },
  adminMediaImport: { path: "/v1/admin/media/jobs", method: "POST" },
  adminMediaYoutube: { path: "/v1/admin/media/youtube", method: "POST" },
};
function query(input: Record<string, z.infer<typeof z.json>>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === null) continue;
    params.set(key, String(z.union([z.string(), z.number(), z.boolean()]).parse(value)));
  }
  return params.size ? `?${params}` : "";
}
const id = z.string().uuid();

export async function developmentCall(
  command: string,
  raw: z.input<typeof z.json>,
  signal?: AbortSignal,
): Promise<DevelopmentReply> {
  if (!developmentBrowserAvailable()) throw new Error("معاينة التطوير غير متاحة في هذا الإصدار.");
  // Match the native bridge's JSON wire format, including omission of optional undefined keys.
  const payload = z.record(z.string(), z.json()).parse(JSON.parse(JSON.stringify(raw)));
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  if (command === "session") {
    if (!token) return null;
    session = SessionSchema.parse(await request("/v1/auth/session", "GET", undefined, signal));
    return session;
  }
  if (command === "login") {
    const parsed = LoginRequestSchema.parse({ ...payload, remember: false });
    // Browser sessions are temporary; omit renewal fields unsupported by installed 0.1.2 servers.
    const input =
      "email" in parsed
        ? { email: parsed.email, password: parsed.password }
        : { accountId: parsed.accountId, password: parsed.password };
    clearSession();
    const info = ServerInfoSchema.parse(
      await request("/v1/server/info", "GET", undefined, signal, true),
    );
    if (info.serverId !== expectedServerId)
      throw new Error(
        "هوية الخادم لا تطابق المكتبة المحددة لمعاينة التطوير. لم تُرسل بيانات الدخول.",
      );
    const result = LoginResponseSchema.parse(
      await request("/v1/auth/login", "POST", input, signal, true),
    );
    token = result.token;
    session = SessionSchema.parse({ user: result.user, expiresAt: result.expiresAt });
    return session;
  }
  if (command === "logout" || command === "accounts.switch") {
    if (token) await request("/v1/auth/logout", "POST", {}, signal);
    clearSession();
    return null;
  }
  if (command === "accounts.status") return { secureStorage: false };
  if (command === "loginAccounts" || command === "offline.profiles") return [];
  if (command === "servers.list")
    return {
      selected: origin,
      servers: [
        {
          url: origin,
          name:
            localStorage.getItem(nameKey) ??
            (origin === "http://127.0.0.1:23103/"
              ? (localStorage.getItem("nahhasio:development:server-name") ??
                "مكتبة التطوير المحلية")
              : "مكتبة الخادم المتصل"),
          trustedFingerprint: null,
        },
      ],
    };
  if (command === "servers.probe") {
    if (payload.url !== origin && payload.url !== origin.slice(0, -1)) unsupported();
    const info = await request("/v1/server/info", "GET", undefined, signal, true);
    await request("/health/ready", "GET", undefined, signal, true);
    return { url: origin, info };
  }
  if (command === "servers.save") {
    if (payload.url !== origin) unsupported();
    localStorage.setItem(nameKey, z.string().trim().min(1).max(80).parse(payload.name));
    return developmentCall("servers.list", {}, signal);
  }
  // The browser has no native player, transfers, secure vault or offline library.
  if (command === "offline.status")
    return {
      scope: null,
      active: false,
      offline: false,
      name: null,
      pending: 0,
      conflicts: [],
      job: null,
    };
  if (command === "player.status")
    return {
      active: false,
      sessionId: null,
      title: "",
      sourceKind: null,
      paused: false,
      position: 0,
      duration: 0,
      seekable: false,
      volume: 100,
      muted: false,
      speed: 1,
      buffering: false,
      ended: false,
      fullscreen: false,
      audioDelay: 0,
      subtitleDelay: 0,
      subtitleSize: 40,
      subtitlePosition: 100,
      tracks: [],
      hwdec: null,
      videoCodec: null,
      error: null,
    };
  if (command === "clientUpdate.status")
    return {
      available: false,
      state: "unavailable",
      availableVersion: null,
      pendingVersion: null,
      automatic: null,
      lastCheck: null,
      manager: "development",
      currentVersion: packageInfo.version,
      message: "معاينة تطوير محلية في المتصفح.",
    };
  if (!session || !token) throw new Error("سجّل الدخول إلى مكتبة التطوير أولًا.");
  if (command === "browsePreferences.load" || command === "browsePreferences.save") {
    // Browser-only preferences remain separate for each verified server and account.
    const key = `nahhasio:development:browse:${expectedServerId}:${session.user.accountId}`;
    if (command.endsWith("load")) {
      const legacy =
        expectedServerId === "97900000-0000-4000-8000-000000000001"
          ? localStorage.getItem(`nahhasio:development:browse:${session.user.accountId}`)
          : null;
      return preferencesSchema
        .nullable()
        .parse(JSON.parse(localStorage.getItem(key) ?? legacy ?? "null"));
    }
    localStorage.setItem(key, JSON.stringify(preferencesSchema.parse(payload)));
    return { ok: true };
  }
  if (command === "artwork.url") {
    const asset = id.parse(payload.id);
    const width = z
      .union([z.literal(0), z.literal(320), z.literal(640), z.literal(1280), z.literal(1920)])
      .parse(payload.width);
    const current = generation;
    const key = `${session.user.accountId}:${asset}:${width}`;
    const existing = artwork.get(key);
    if (existing) return { url: artwork.url(existing) };
    const scope = AbortSignal.any([
      requests.signal,
      AbortSignal.timeout(25000),
      ...(signal ? [signal] : []),
    ]);
    const blob = await artworkQueue.run(
      () => transport(`/v1/artwork/${asset}?width=${width}`, "GET", undefined, scope, false, true),
      scope,
    );
    if (current !== generation) throw new DOMException("Session changed", "AbortError");
    if (!(blob instanceof Blob) || !blob.type.startsWith("image/"))
      throw new Error("استجابة صورة غير صالحة.", { cause: { code: "response" } });
    artwork.store(key, blob);
    return { url: artwork.url(blob) };
  }
  const read = Object.entries(getRoutes).find(([key]) => key === command)?.[1];
  if (read) return request(read + query(payload), "GET", undefined, signal);
  const write = Object.entries(writeRoutes).find(([key]) => key === command)?.[1];
  if (write) return request(write.path, write.method, payload, signal);
  if (command === "adminMediaFile" || command === "adminMediaControl") {
    const { id: resource, ...body } = payload;
    return request(
      `/v1/admin/media/${command === "adminMediaControl" ? "jobs/" : ""}${id.parse(resource)}`,
      "POST",
      body,
      signal,
    );
  }
  if (command === "homeMedia")
    return request(`/v1/works/${id.parse(payload.id)}/media`, "GET", undefined, signal);
  if (command === "recommendations")
    return request(
      `/v1/catalog/recommendations${query({ workId: id.parse(payload.id) })}`,
      "GET",
      undefined,
      signal,
    );
  if (command === "work" || command === "workState" || command === "workDocument") {
    const work = id.parse(payload.id);
    const path =
      command === "workDocument"
        ? `/v1/admin/works/${work}`
        : `/v1/works/${work}${command === "workState" ? "/state" : ""}`;
    return request(path, "GET", undefined, signal);
  }
  if (command === "databaseRows") {
    const { table, ...rest } = payload;
    return request(
      `/v1/admin/database/${z
        .string()
        .regex(/^[a-z_][a-z0-9_]{0,62}$/)
        .parse(table)}${query(rest)}`,
      "GET",
      undefined,
      signal,
    );
  }
  if (["profileOverview", "profileEntries", "publicProfile"].includes(command)) {
    const { id: profile, ...rest } = payload;
    const suffix =
      command === "profileOverview" ? "/overview" : command === "profileEntries" ? "/entries" : "";
    return request(
      `/v1/profiles/${id.parse(profile)}${suffix}${query(rest)}`,
      "GET",
      undefined,
      signal,
    );
  }
  if (command === "setFavorite" || command === "setWatched") {
    const { workId, ...body } = payload;
    return request(
      `/v1/works/${id.parse(workId)}/${command === "setFavorite" ? "favorite" : "watched"}`,
      command === "setFavorite" ? "PUT" : "PATCH",
      body,
      signal,
    );
  }
  if (command === "workActivity" || command === "workComment") {
    const work = id.parse(payload.id);
    return request(
      `/v1/works/${work}/${command === "workActivity" ? `activity${query({ page: payload.page ?? 1 })}` : "comments"}`,
      command === "workActivity" ? "GET" : "POST",
      command === "workComment" ? payload.data : undefined,
      signal,
    );
  }
  return unsupported();
}
