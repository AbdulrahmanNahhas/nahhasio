import type { KeyboardEvent, ReactNode, RefCallback } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

type CardNavigation = {
  ref: RefCallback<HTMLElement>;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  focusFirst: () => void;
  focusPanel: () => void;
  loadMore: (trigger: HTMLElement, load: () => Promise<void>) => Promise<void>;
};
function focusTarget(element: HTMLElement) {
  element.focus({ preventScroll: true });
  homeLayout(element).scrollIntoView({
    block: element.dataset.navigationAlign === "start" ? "start" : "nearest",
    inline: "nearest",
    behavior: "instant",
  });
}
const CardNavigationContext = createContext<CardNavigation | undefined>(undefined);
function cardLayout(element: HTMLElement) {
  return element.closest<HTMLElement>("[data-episode-card]") ?? element;
}

function homeLayout(element: HTMLElement) {
  return element.closest<HTMLElement>("[data-home-shelf-item]") ?? cardLayout(element);
}

function homeTarget(origin: HTMLElement, cards: HTMLElement[], key: string) {
  const horizontal = key === "ArrowLeft" || key === "ArrowRight";
  const forward = key === "ArrowRight" || key === "ArrowDown";
  const source = homeLayout(origin);
  const start = source.getBoundingClientRect();
  const shelf = origin.closest("[data-home-shelf]");
  const tabs = origin.closest('[role="tablist"], [data-home-toggle]');
  if (horizontal && tabs) return undefined;
  const center = start.left + start.width / 2;
  return cards
    .filter((card) => {
      if (homeLayout(card) === source) return false;
      if (horizontal) {
        return (
          card.closest("[data-home-shelf]") === shelf &&
          !card.closest('[role="tablist"], [data-home-toggle]') &&
          !card.dataset.navigationAlign
        );
      }
      return !card.matches(
        '[role="tab"][tabindex="-1"], [data-home-toggle] button[aria-pressed="false"]',
      );
    })
    .map((card) => {
      const rect = homeLayout(card).getBoundingClientRect();
      const track = card.closest("[data-home-shelf]")?.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - center;
      const dy = rect.top - start.top;
      const overlapsRow = rect.top < start.bottom - 4 && rect.bottom > start.top + 4;
      const visibleInTrack = !track || (rect.right > track.left + 8 && rect.left < track.right - 8);
      return { card, dx, dy, overlapsRow, visibleInTrack };
    })
    .filter(({ dx, dy, overlapsRow, visibleInTrack }) =>
      horizontal
        ? overlapsRow && (forward ? dx > 1 : dx < -1)
        : visibleInTrack && (forward ? dy > 10 : dy < -10),
    )
    .toSorted((a, b) =>
      horizontal
        ? Math.abs(a.dx) - Math.abs(b.dx)
        : Math.abs(a.dy) - Math.abs(b.dy) || Math.abs(a.dx) - Math.abs(b.dx),
    )[0]?.card;
}

export function CardNavigationProvider({
  children,
  home = false,
}: {
  children: ReactNode;
  home?: boolean;
}) {
  const cards = useRef(new Set<HTMLElement>());
  const pendingEntry = useRef(false);
  const pendingLoad = useRef<(() => void) | undefined>(undefined);
  const enterHeld = useRef(false);
  const afterEnter = useRef<(() => void) | undefined>(undefined);
  const available = useCallback(() => {
    const groups = new Map<HTMLElement, HTMLElement>();
    for (const element of [...cards.current].filter(
      (candidate) =>
        candidate.isConnected &&
        !candidate.matches(":disabled, [aria-disabled=true]") &&
        candidate.getClientRects().length > 0,
    )) {
      const layout = cardLayout(element);
      if (!groups.has(layout) || element.hasAttribute("data-episode-primary"))
        groups.set(layout, element);
    }
    return [...groups.values()];
  }, []);
  const focusFirst = useCallback(() => {
    const first = available().toSorted(
      (a, b) =>
        cardLayout(a).getBoundingClientRect().top - cardLayout(b).getBoundingClientRect().top,
    )[0];
    pendingEntry.current = !first;
    if (first) focusTarget(first);
  }, [available]);
  const focusPanel = useCallback(() => {
    const first = available()
      .filter((element) => element.closest('[role="tabpanel"]:not([hidden])'))
      .toSorted((a, b) => {
        const left = cardLayout(a).getBoundingClientRect();
        const right = cardLayout(b).getBoundingClientRect();
        return left.top - right.top || right.right - left.right;
      })[0];
    if (first) focusTarget(first);
  }, [available]);
  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Enter") enterHeld.current = true;
    };
    const release = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Enter") return;
      enterHeld.current = false;
      const next = afterEnter.current;
      afterEnter.current = undefined;
      if (next) requestAnimationFrame(next);
    };
    window.addEventListener("keyup", release);
    window.addEventListener("nahhasio:focus-content", focusFirst);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("keyup", release);
      window.removeEventListener("nahhasio:focus-content", focusFirst);
      window.removeEventListener("keydown", shortcut);
    };
  }, [focusFirst]);
  const register = useCallback<RefCallback<HTMLElement>>(
    (element) => {
      if (!element) return;
      cards.current.add(element);
      if (pendingEntry.current) queueMicrotask(focusFirst);
      if (pendingLoad.current) requestAnimationFrame(() => pendingLoad.current?.());
      return () => {
        cards.current.delete(element);
      };
    },
    [focusFirst],
  );
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.nativeEvent.isComposing
      )
        return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      if (event.target !== event.currentTarget) return;
      if (home) {
        const next = homeTarget(event.currentTarget, available(), event.key);
        if (next) {
          event.preventDefault();
          focusTarget(next);
        }
        return;
      }

      // Only explicitly registered cards participate; inputs, dialogs and native controls stay native.
      // Episode thumbnails animate; measure their stable card, and move to one primary action per episode.
      const layout = cardLayout(event.currentTarget);
      const origin = layout.getBoundingClientRect();
      const panel = event.currentTarget.closest('[role="tabpanel"]');
      const header = panel ? null : event.currentTarget.closest("header");
      const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
      const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
      const centerX = origin.left + origin.width / 2;
      const candidates = available()
        .filter(
          (card) =>
            cardLayout(card) !== layout &&
            card.isConnected &&
            !card.matches(":disabled, [aria-disabled=true]") &&
            (panel
              ? card.closest('[role="tabpanel"]') === panel
              : card.closest("header") === header),
        )
        .map((card) => ({ card, rect: cardLayout(card).getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0)
        .map(({ card, rect }) => {
          const dx = rect.left + rect.width / 2 - centerX;
          const dy = rect.top - origin.top;
          return { card, dx, dy };
        })
        .filter(({ dx, dy }) =>
          horizontal
            ? Math.abs(dy) < 4 && (forward ? dx > 1 : dx < -1)
            : forward
              ? dy > 4
              : dy < -4,
        )
        .toSorted((a, b) =>
          horizontal
            ? Math.abs(a.dx) - Math.abs(b.dx)
            : Math.abs(a.dy) - Math.abs(b.dy) || Math.abs(a.dx) - Math.abs(b.dx),
        );

      event.preventDefault();
      const next = candidates[0]?.card;
      if (next) focusTarget(next);
    },
    [available, home],
  );
  const loadMore = useCallback(async (trigger: HTMLElement, load: () => Promise<void>) => {
    const previous = new Set(cards.current);
    const hadFocus = document.activeElement === trigger;
    pendingLoad.current = () => {
      if (
        !hadFocus ||
        !(
          document.activeElement === trigger ||
          (!trigger.isConnected && document.activeElement === document.body)
        )
      )
        return;
      const firstNew = [...cards.current].find(
        (element) => !previous.has(element) && element.isConnected,
      );
      if (firstNew) {
        const transfer = () => {
          if (
            document.activeElement === trigger ||
            (!trigger.isConnected && document.activeElement === document.body)
          )
            focusTarget(firstNew);
          pendingLoad.current = undefined;
        };
        // Enter must finish on the pagination button, not activate the newly focused link.
        if (enterHeld.current) afterEnter.current = transfer;
        else transfer();
      }
    };
    await load();
    requestAnimationFrame(() => pendingLoad.current?.());
  }, []);
  const value = useMemo(
    () => ({ ref: register, onKeyDown, focusFirst, focusPanel, loadMore }),
    [register, onKeyDown, focusFirst, focusPanel, loadMore],
  );
  return <CardNavigationContext value={value}>{children}</CardNavigationContext>;
}

export function useCardNavigation() {
  const navigation = useContext(CardNavigationContext);
  return navigation
    ? { ref: navigation.ref, onKeyDown: navigation.onKeyDown, "data-card-navigation": true }
    : undefined;
}

export function useLoadMoreNavigation() {
  return useContext(CardNavigationContext)?.loadMore;
}

export function useContentEntry() {
  return useContext(CardNavigationContext)?.focusFirst;
}

export function usePanelEntry() {
  return useContext(CardNavigationContext)?.focusPanel;
}
