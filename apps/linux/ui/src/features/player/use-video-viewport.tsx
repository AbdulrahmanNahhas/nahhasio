import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";

import { nativeCall } from "@/lib/bridge";

import { PlayerRequestSchema } from "./bridge";
type Viewport = {
  x: number;
  y: number;
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
};
/** CSS pixels and GTK logical pixels share the unzoomed WebKit viewport. */
export function useVideoViewport(
  element: RefObject<HTMLDivElement | null>,
  sessionId: string,
  fullscreen: boolean,
) {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const sent = useRef("");
  useEffect(() => {
    let alive = true;
    let frame = 0;
    let busy = false;
    let queued: Viewport | null = null;
    sent.current = "";
    async function send() {
      if (busy || !queued || !alive) return;
      const value = queued;
      queued = null;
      const key = JSON.stringify(value);
      if (sent.current === key) return;
      busy = true;
      try {
        const request = PlayerRequestSchema.parse({
          command: "player.viewport",
          payload: { sessionId, x: value.x, y: value.y, width: value.width, height: value.height },
        });
        await nativeCall(request.command, request.payload);
        if (alive) sent.current = key;
      } catch {
        /* Session replacement can invalidate an in-flight geometry update. */
      } finally {
        busy = false;
        if (queued && alive) void send();
      }
    }
    function measure() {
      frame = 0;
      if (!element.current || !alive) return;
      const rect = fullscreen
        ? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
        : element.current.getBoundingClientRect();
      const next = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      };
      setViewport((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
      queued = next;
      void send();
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    const observer = new ResizeObserver(schedule);
    if (element.current) observer.observe(element.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    schedule();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [element, sessionId, fullscreen]);
  return viewport;
}
/** Paint the page around the native video without painting over its transparent aperture. */
export function VideoBackdrop({ viewport }: { viewport: Viewport | null }) {
  const id = useId();
  if (!viewport) return null;
  return (
    <svg className="pointer-events-none fixed inset-0 -z-10 size-full" aria-hidden="true">
      <defs>
        <mask id={id}>
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={viewport.x}
            y={viewport.y}
            width={viewport.width}
            height={viewport.height}
            rx={16}
            fill="black"
          />
        </mask>
      </defs>
      <rect width="100%" height="100%" className="fill-background" mask={`url(#${id})`} />
    </svg>
  );
}
