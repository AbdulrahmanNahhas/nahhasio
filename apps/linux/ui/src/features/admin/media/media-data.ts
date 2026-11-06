import {
  MediaIncomingSchema,
  MediaJobsSchema,
  MediaQueuedSchema,
  ServerMediaPageSchema,
  MediaCoveragePageSchema,
  MediaActionResultSchema,
  MediaUnitStatusesSchema,
  type MediaImportRequest,
} from "@nahhasio/api-contract";
import { queryOptions } from "@tanstack/react-query";

import { nativeCall } from "@/lib/bridge";
export const mediaUnitsOptions = (workId: string, installmentId: string, episodeIds: string) =>
  queryOptions({
    queryKey: ["admin", "media", "units", workId, installmentId, episodeIds],
    queryFn: async ({ signal }) =>
      MediaUnitStatusesSchema.parse(
        await nativeCall("adminMediaUnits", { workId, installmentId, episodeIds }, signal),
      ),
    enabled: Boolean(workId && installmentId && episodeIds),
    refetchInterval: 5000,
  });
export const unitFilesOptions = (
  workId: string,
  installmentId: string,
  episodeIds: string,
  page: number,
) =>
  queryOptions({
    queryKey: ["admin", "media", "unit-files", workId, installmentId, episodeIds, page],
    queryFn: async ({ signal }) =>
      ServerMediaPageSchema.parse(
        await nativeCall(
          "adminMedia",
          { workId, installmentId, episodeIds, page, pageSize: 10 },
          signal,
        ),
      ),
    refetchInterval: 5000,
  });
export const mediaInventoryOptions = (
  q: string,
  page: number,
  workId: string,
  mediaState: string,
  mediaSource: string,
) =>
  queryOptions({
    queryKey: ["admin", "media", "inventory", q, page, workId, mediaState, mediaSource],
    queryFn: async ({ signal }) =>
      ServerMediaPageSchema.parse(
        await nativeCall(
          "adminMedia",
          { q, page, pageSize: 30, workId: workId || undefined, mediaState, mediaSource },
          signal,
        ),
      ),
  });
export const mediaCoverageOptions = (q: string, page: number, workId: string, missing: boolean) =>
  queryOptions({
    queryKey: ["admin", "media", "coverage", q, page, workId, missing],
    queryFn: async ({ signal }) =>
      MediaCoveragePageSchema.parse(
        await nativeCall(
          "adminMediaCoverage",
          {
            q,
            page,
            pageSize: 30,
            workId: workId || undefined,
            mediaState: missing ? "missing" : "all",
          },
          signal,
        ),
      ),
  });
export const incomingOptions = (folder: string, sourceRoot: "incoming" | "library", page: number) =>
  queryOptions({
    queryKey: ["admin", "media", "incoming", folder, sourceRoot, page],
    queryFn: async ({ signal }) =>
      MediaIncomingSchema.parse(
        await nativeCall(
          "adminMediaIncoming",
          { q: folder, sourceRoot, page, pageSize: 100 },
          signal,
        ),
      ),
  });
export const mediaJobsOptions = () =>
  queryOptions({
    queryKey: ["admin", "media", "jobs"],
    queryFn: async ({ signal }) =>
      MediaJobsSchema.parse(await nativeCall("adminMediaJobs", { page: 1, pageSize: 50 }, signal)),
    refetchInterval: 5000,
  });
export const importMedia = async (request: MediaImportRequest) =>
  MediaQueuedSchema.parse(await nativeCall("adminMediaImport", request));
export const controlMediaJob = async (id: string, action: "cancel" | "retry") =>
  MediaActionResultSchema.parse(await nativeCall("adminMediaControl", { id, action }));
