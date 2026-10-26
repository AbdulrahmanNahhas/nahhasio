import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import { WorkViewerStateSchema, WorkActivityPageSchema } from "../src/generated.ts";
import type { WorkViewerState, WorkActivityPage } from "../src/generated.ts";

const id = "00112233-4455-4677-8899-aabbccddeeff";
const state = WorkViewerStateSchema.parse({
  workId: id,
  isFavorite: false,
  units: [],
  installments: [],
  summary: {
    catalogUnits: 0,
    releasedUnits: 0,
    watchedReleasedUnits: 0,
    isFullyWatched: false,
    watchState: "unwatched",
  },
});
const activity = WorkActivityPageSchema.parse({
  workId: id,
  items: [],
  total: 0,
  page: 2,
  pageSize: 20,
});
const NativeMessageSchema = z.strictObject({
  id: z.string().uuid(),
  command: z.enum(["workState", "setFavorite", "setWatched", "workActivity"]),
  payload: z.json(),
});
type BridgeResult = WorkViewerState | WorkActivityPage | (WorkViewerState & { token: string });

test("GTK gateway normalizes manual targets, validates replies and supports cancelled reads", async () => {
  type Reply = { id: string; ok: true; result: BridgeResult };
  const sent: z.infer<typeof NativeMessageSchema>[] = [];
  let result: BridgeResult = state;
  const events = new EventTarget();
  type NativeWindow = {
    webkit: { messageHandlers: { nahhasio: { postMessage: (raw: string) => void } } };
    __nahhasioReply?: (reply: Reply) => void;
    dispatchEvent: (event: Event) => boolean;
    addEventListener: EventTarget["addEventListener"];
  };
  const windowStub: NativeWindow = {
    webkit: {
      messageHandlers: {
        nahhasio: {
          postMessage: (raw) => {
            const message = NativeMessageSchema.parse(JSON.parse(raw));
            sent.push(message);
            windowStub["__nahhasioReply"]?.({ id: message.id, ok: true, result });
          },
        },
      },
    },
    dispatchEvent: events.dispatchEvent.bind(events),
    addEventListener: events.addEventListener.bind(events),
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: windowStub, configurable: true });
  try {
    const { gateway } = await import("../../../apps/linux/ui/src/lib/bridge.ts");
    assert.deepEqual(await gateway.workState(id), state);
    assert.deepEqual(await gateway.setFavorite(id, true), state);
    await gateway.setWatched(id, { isPlayed: true });
    assert.deepEqual(sent[2]?.payload, {
      workId: id,
      installmentId: null,
      episodeId: null,
      isPlayed: true,
    });
    await gateway.setWatched(id, { installmentId: id, isPlayed: false });
    assert.deepEqual(sent[3]?.payload, {
      workId: id,
      installmentId: id,
      episodeId: null,
      isPlayed: false,
    });
    await gateway.setWatched(id, { installmentId: id, episodeId: id, isPlayed: true });
    result = activity;
    assert.deepEqual(await gateway.workActivity(id, 2), activity);
    assert.deepEqual(
      sent.map((message) => message.command),
      ["workState", "setFavorite", "setWatched", "setWatched", "setWatched", "workActivity"],
    );
    const count = sent.length;
    await assert.rejects(() => gateway.setWatched(id, { episodeId: id, isPlayed: true }));
    await assert.rejects(() => gateway.workActivity(id, 0));
    await assert.rejects(() => gateway.workState(id, AbortSignal.abort()), { name: "AbortError" });
    assert.equal(sent.length, count, "invalid/aborted operations never reach the native bridge");
    result = { ...state, token: "must-not-be-returned" };
    await assert.rejects(() => gateway.workState(id));
    result = state;
    const previousServerRead = gateway.workState(id);
    windowStub.dispatchEvent(new Event("nahhasio:server-changed"));
    await assert.rejects(() => previousServerRead, { name: "AbortError" });
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
