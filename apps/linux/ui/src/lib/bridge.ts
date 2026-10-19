import {
  DatabaseSchemaSchema,
  DatabasePageSchema,
  CatalogEditorCallSchema,
  CatalogEditorReplySchema,
  WorkDocumentSchema,
  WorkDocumentsSchema,
  WorkReviewSchema,
  WorkSavedSchema,
  WorkReadRequestSchema,
  WorkReviewRequestSchema,
  WorkSaveRequestSchema,
  AdminWorksPageSchema,
  AdminWorkSelectionSchema,
  UserSchema,
  ProfileUpdateSchema,
  PasswordUpdateSchema,
  AccountMessageSchema,
  CatalogFiltersSchema,
  CatalogPageSchema,
  FacetCatalogSchema,
  HomeFeedSchema,
  RecommendationPageSchema,
  EpisodesPageSchema,
  ReleasesPageSchema,
  SessionSchema,
  WorkDetailSchema,
  WorkPageSchema,
  WorkViewerStateSchema,
  WorkActivityPageSchema,
  CommentMutationSchema,
  CommentChangedSchema,
  FavoriteRequestSchema,
  WatchedRequestSchema,
} from "@nahhasio/api-contract";
import type { ApiClient, LoginRequest, WatchedRequest } from "@nahhasio/api-contract";
export type WatchedSelection = Pick<WatchedRequest, "isPlayed"> & {
  installmentId?: string | null;
  episodeId?: string | null;
};
import { z } from "zod";
export type AdminWorksQuery = NonNullable<Parameters<ApiClient["getAdminWorks"]>[0]>;
export type CatalogQuery = NonNullable<Parameters<ApiClient["browseCatalog"]>[0]>;
export type EpisodesQuery = NonNullable<Parameters<ApiClient["getEpisodes"]>[0]>;
export type ReleasesQuery = NonNullable<Parameters<ApiClient["getReleases"]>[0]>;
export type LibraryQuery = NonNullable<Parameters<ApiClient["listWorks"]>[0]>;
const ReplySchema = z.discriminatedUnion("ok", [
  z.object({ id: z.string(), ok: z.literal(true), result: z.json().optional() }),
  z.object({
    id: z.string(),
    ok: z.literal(false),
    error: z.object({ message: z.string(), code: z.string() }),
  }),
]);
type Reply = z.infer<typeof ReplySchema>;
declare global {
  interface Window {
    webkit?: { messageHandlers?: { nahhasio?: { postMessage(message: string): void } } };
    __nahhasioReply?: (reply: Reply) => void;
  }
}
let connectionRevision = 0;
window.addEventListener("nahhasio:server-changed", () => {
  connectionRevision++;
});
window.addEventListener("nahhasio:session-changed", () => {
  connectionRevision++;
});
window.addEventListener("nahhasio:signed-out", () => {
  connectionRevision++;
});
const pending = new Map<
  string,
  { resolve: (reply: Reply) => void; reject: (error: Error) => void }
>();
window["__nahhasioReply"] = (input) => {
  const parsed = ReplySchema.safeParse(input);
  if (!parsed.success) return;
  const waiter = pending.get(parsed.data.id);
  if (!waiter) return;
  pending.delete(parsed.data.id);
  waiter.resolve(parsed.data);
};
export function nativeAvailable() {
  return Boolean(window.webkit?.messageHandlers?.nahhasio);
}
export async function nativeCall(
  command: string,
  payload: z.input<typeof z.json>,
  signal?: AbortSignal,
  timeoutMs = 25000,
) {
  const revision = connectionRevision;
  const handler = window.webkit?.messageHandlers?.nahhasio;
  if (!handler) throw new Error("افتح نحّاسيو من تطبيق Linux للاتصال بمكتبتك.");
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const id = crypto.randomUUID();
  let timer: ReturnType<typeof setTimeout>;
  const response = await new Promise<Reply>((resolve, reject) => {
    const abort = () => {
      pending.delete(id);
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    timer = setTimeout(() => {
      pending.delete(id);
      signal?.removeEventListener("abort", abort);
      reject(new Error("انتهت مهلة الاتصال. تحقق من تشغيل الخادم ثم أعد المحاولة."));
    }, timeoutMs);
    const finish = (reply: Reply) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve(reply);
    };
    pending.set(id, { resolve: finish, reject });
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const send = handler.postMessage.bind(handler);
      send(JSON.stringify({ id, command, payload }));
    } catch {
      clearTimeout(timer);
      pending.delete(id);
      signal?.removeEventListener("abort", abort);
      reject(new Error("تعذر الاتصال بالتطبيق."));
    }
  });
  if (revision !== connectionRevision) throw new DOMException("Server changed", "AbortError");
  if (!response.ok) {
    if (response.error.code === "unauthorized" && command !== "login")
      window.dispatchEvent(new Event("nahhasio:signed-out"));
    if (
      response.error.message === "Unknown desktop command" ||
      response.error.message === "Invalid media request"
    ) {
      throw new Error("أعد تشغيل تطبيق نحّاسيو بالكامل لتفعيل هذه الصفحة، ثم أعد المحاولة.");
    }
    const errors = {
      unauthorized:
        command === "login"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          : "انتهت جلسة الاتصال. سجّل الدخول مرة أخرى.",
      forbidden: "لا يملك حسابك صلاحية تنفيذ هذه العملية.",
      conflict: "تغيّرت البيانات. أعد تحميل الصفحة قبل الحفظ.",
      bad_request:
        command === "updatePassword"
          ? "تحقق من البيانات وكلمة المرور الحالية ثم أعد المحاولة."
          : "تعذّر تنفيذ الطلب. تحقق من البيانات ثم أعد المحاولة.",
      server: "تعذّر إكمال الطلب. تحقق من الخادم ثم أعد المحاولة.",
      network: "تعذّر الاتصال بخادم المكتبة.",
    };
    throw new Error(
      /[\u0600-\u06ff]/.test(response.error.message)
        ? response.error.message
        : z
              .enum(["unauthorized", "forbidden", "conflict", "bad_request", "server", "network"])
              .safeParse(response.error.code).data
          ? errors[
              z
                .enum(["unauthorized", "forbidden", "conflict", "bad_request", "server", "network"])
                .parse(response.error.code)
            ]
          : response.error.message,
    );
  }
  return response.result;
}
const call = nativeCall;
export const gateway = {
  avatar: async (key: string, signal?: AbortSignal) =>
    z
      .object({ dataUrl: z.string().startsWith("data:image/svg+xml;base64,") })
      .parse(await call("avatar", { key }, signal)).dataUrl,
  profile: async (signal?: AbortSignal) => UserSchema.parse(await call("profile", {}, signal)),
  editorCall: async (input: z.input<typeof CatalogEditorCallSchema>, signal?: AbortSignal) =>
    CatalogEditorReplySchema.parse(
      await call("editorCall", CatalogEditorCallSchema.parse(input), signal),
    ).result,
  workDocument: async (id: string, signal?: AbortSignal) =>
    WorkDocumentSchema.parse(await call("workDocument", { id }, signal)),
  workRead: async (input: z.input<typeof WorkReadRequestSchema>, signal?: AbortSignal) =>
    WorkDocumentsSchema.parse(await call("workRead", WorkReadRequestSchema.parse(input), signal)),
  workReview: async (input: z.input<typeof WorkReviewRequestSchema>) =>
    WorkReviewSchema.parse(await call("workReview", WorkReviewRequestSchema.parse(input))),
  workSave: async (input: z.input<typeof WorkSaveRequestSchema>) =>
    WorkSavedSchema.parse(await call("workSave", WorkSaveRequestSchema.parse(input))),
  adminWorks: async (query: AdminWorksQuery, signal?: AbortSignal) =>
    AdminWorksPageSchema.parse(await call("adminWorks", query, signal)),
  adminWorksSelection: async (query: AdminWorksQuery, signal?: AbortSignal) =>
    AdminWorkSelectionSchema.parse(await call("adminWorksSelection", query, signal)),
  databaseSchema: async (signal?: AbortSignal) =>
    DatabaseSchemaSchema.parse(await call("databaseSchema", {}, signal)),
  databaseRows: async (table: string, page: number, q: string, signal?: AbortSignal) =>
    DatabasePageSchema.parse(await call("databaseRows", { table, page, pageSize: 25, q }, signal)),
  adminAccess: async (signal?: AbortSignal) =>
    UserSchema.parse(await call("adminAccess", {}, signal)),
  updateProfile: async (input: z.input<typeof ProfileUpdateSchema>) =>
    UserSchema.parse(await call("updateProfile", ProfileUpdateSchema.parse(input))),
  updatePassword: async (input: z.input<typeof PasswordUpdateSchema>) =>
    AccountMessageSchema.parse(await call("updatePassword", PasswordUpdateSchema.parse(input))),
  session: async (signal?: AbortSignal) =>
    SessionSchema.nullable().parse(await call("session", {}, signal)),
  login: async (payload: LoginRequest) =>
    SessionSchema.parse(await call("login", payload, undefined, 40000)),
  logout: async () => {
    await call("logout", {});
  },
  works: async (query: LibraryQuery, signal?: AbortSignal) =>
    WorkPageSchema.parse(await call("works", query, signal)),
  browse: async (query: CatalogQuery, signal?: AbortSignal) =>
    CatalogPageSchema.parse(await call("browse", query, signal)),
  facets: async (query: CatalogQuery, signal?: AbortSignal) =>
    FacetCatalogSchema.parse(await call("facets", query, signal)),

  releases: async (query: ReleasesQuery, signal?: AbortSignal) =>
    ReleasesPageSchema.parse(await call("releases", query, signal)),
  episodes: async (query: EpisodesQuery, signal?: AbortSignal) =>
    EpisodesPageSchema.parse(await call("episodes", query, signal)),
  recommendations: async (id: string, signal?: AbortSignal) =>
    RecommendationPageSchema.parse(await call("recommendations", { id }, signal)),
  home: async (signal?: AbortSignal) => HomeFeedSchema.parse(await call("home", {}, signal)),
  filters: async (signal?: AbortSignal) =>
    CatalogFiltersSchema.parse(await call("filters", {}, signal)),
  work: async (id: string, signal?: AbortSignal) =>
    WorkDetailSchema.parse(await call("work", { id }, signal)),
  workState: async (id: string, signal?: AbortSignal) =>
    WorkViewerStateSchema.parse(await call("workState", { id }, signal)),
  setFavorite: async (workId: string, isFavorite: boolean) => {
    const input = FavoriteRequestSchema.parse({ isFavorite });
    return WorkViewerStateSchema.parse(await call("setFavorite", { workId, ...input }));
  },
  setWatched: async (workId: string, selection: WatchedSelection) => {
    const input = WatchedRequestSchema.parse({
      installmentId: selection.installmentId ?? null,
      episodeId: selection.episodeId ?? null,
      isPlayed: selection.isPlayed,
    });
    if (input.episodeId !== null && input.installmentId === null)
      throw new Error("اختر الجزء الذي تنتمي إليه الحلقة.");
    return WorkViewerStateSchema.parse(await call("setWatched", { workId, ...input }));
  },
  workComment: async (id: string, data: z.infer<typeof CommentMutationSchema>) =>
    CommentChangedSchema.parse(
      await call("workComment", { id, data: CommentMutationSchema.parse(data) }),
    ),
  workActivity: async (id: string, page = 1, signal?: AbortSignal) => {
    z.number().int().min(1).max(100000).parse(page);
    return WorkActivityPageSchema.parse(await call("workActivity", { id, page }, signal));
  },
  artwork: async (id: string, signal?: AbortSignal) =>
    z
      .object({ dataUrl: z.string().regex(/^data:image\/(?:png|jpeg|webp|avif|gif);base64,/) })
      .parse(await call("artwork", { id }, signal)).dataUrl,
};
