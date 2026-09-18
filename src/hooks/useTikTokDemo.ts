"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  demoComments, demoPublishingHistory,
  type DemoComment, type DemoPublishItem, type PublishStatus,
} from "@/data/tiktokDemo";

/**
 * PROTOTYPE state for the TikTok Accounts API demonstration.
 *
 * ⚠️ Entirely local: everything lives in localStorage. This hook never calls a Trend Store
 * API route and never contacts TikTok. It exists so the demo flow behaves like a real product
 * during the screen recording without touching the production integration.
 *
 * localStorage is an external store, so it is read through useSyncExternalStore rather than an
 * effect: that keeps every screen in sync (connecting on one page updates the others), avoids
 * cascading renders, and gives a correct server snapshot for hydration.
 */

const STORAGE_KEY = "tiktok-demo-state-v1";
const CHANGE_EVENT = "tiktok-demo-change";

export interface TikTokDemoState {
  connected: boolean;
  connectedAt: string | null;
  comments: DemoComment[];
  publishing: DemoPublishItem[];
}

function freshState(): TikTokDemoState {
  return {
    connected: false,
    connectedAt: null,
    // Deep copies so demo actions never mutate the source fixtures.
    comments: JSON.parse(JSON.stringify(demoComments)) as DemoComment[],
    publishing: JSON.parse(JSON.stringify(demoPublishingHistory)) as DemoPublishItem[],
  };
}

/** Stable snapshot for SSR and for the first client render. */
const SERVER_STATE: TikTokDemoState = freshState();

// useSyncExternalStore requires a referentially stable snapshot, so the parsed value is
// cached and only rebuilt when the stored string actually changes.
let cachedRaw: string | null = null;
let cachedState: TikTokDemoState = SERVER_STATE;

function parse(raw: string | null): TikTokDemoState {
  if (!raw) return freshState();
  try {
    const parsed = JSON.parse(raw) as Partial<TikTokDemoState>;
    const base = freshState();
    return {
      connected: !!parsed.connected,
      connectedAt: parsed.connectedAt ?? null,
      comments: Array.isArray(parsed.comments) ? (parsed.comments as DemoComment[]) : base.comments,
      publishing: Array.isArray(parsed.publishing) ? (parsed.publishing as DemoPublishItem[]) : base.publishing,
    };
  } catch {
    return freshState();
  }
}

function getSnapshot(): TikTokDemoState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode / blocked storage: the prototype still renders, it just cannot persist.
    return cachedState;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parse(raw);
  }
  return cachedState;
}

function getServerSnapshot(): TikTokDemoState {
  return SERVER_STATE;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(next: TikTokDemoState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not persisted, but still broadcast so the current tab updates.
    cachedRaw = null;
    cachedState = next;
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** True only after hydration, so screens can render a skeleton instead of flashing. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useTikTokDemo() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();

  const mutate = useCallback((fn: (prev: TikTokDemoState) => TikTokDemoState) => {
    write(fn(getSnapshot()));
  }, []);

  const connect = useCallback(() => {
    mutate((prev) => ({ ...prev, connected: true, connectedAt: new Date().toISOString() }));
  }, [mutate]);

  const disconnect = useCallback(() => {
    mutate((prev) => ({ ...prev, connected: false, connectedAt: null }));
  }, [mutate]);

  const resetDemo = useCallback(() => {
    write(freshState());
  }, []);

  // ── Comment actions (demo only) ─────────────────────────────────────────────

  const toggleLike = useCallback((commentId: string) => {
    mutate((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === commentId
          ? { ...c, likedByOwner: !c.likedByOwner, likes: c.likes + (c.likedByOwner ? -1 : 1) }
          : c,
      ),
    }));
  }, [mutate]);

  const setCommentStatus = useCallback((commentId: string, status: DemoComment["status"]) => {
    mutate((prev) => ({
      ...prev,
      comments: prev.comments.map((c) => (c.id === commentId ? { ...c, status } : c)),
    }));
  }, [mutate]);

  const deleteComment = useCallback((commentId: string) => {
    mutate((prev) => ({ ...prev, comments: prev.comments.filter((c) => c.id !== commentId) }));
  }, [mutate]);

  const addReply = useCallback((commentId: string, text: string, author: string) => {
    mutate((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              replies: [
                ...c.replies,
                { id: `r-${Date.now()}`, author, text, createdAt: new Date().toISOString(), byOwner: true },
              ],
            }
          : c,
      ),
    }));
  }, [mutate]);

  // ── Publishing (demo only) ──────────────────────────────────────────────────

  const addPublishItem = useCallback((item: {
    type: "video" | "photo"; caption: string; status: PublishStatus; thumb: [string, string];
  }) => {
    mutate((prev) => ({
      ...prev,
      publishing: [
        { id: `p-${Date.now()}`, createdAt: new Date().toISOString(), ...item },
        ...prev.publishing,
      ],
    }));
  }, [mutate]);

  return {
    ...state,
    hydrated,
    connect,
    disconnect,
    resetDemo,
    toggleLike,
    setCommentStatus,
    deleteComment,
    addReply,
    addPublishItem,
  };
}
