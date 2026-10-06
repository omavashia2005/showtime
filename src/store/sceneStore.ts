import { create } from "zustand";
import type { SceneDocument } from "../types/scene";
import { emptyScene } from "../types/scene";

const HISTORY_LIMIT = 100;

interface SceneStore {
  doc: SceneDocument;
  past: SceneDocument[];
  future: SceneDocument[];
  /** Apply a mutation to a clone of the current doc. Pass checkpoint:false to coalesce
   * continuous edits (e.g. drag) into the checkpoint already pushed by the caller. */
  update: (mutator: (doc: SceneDocument) => void, opts?: { checkpoint?: boolean }) => void;
  /** Push the current doc onto the undo stack without changing it yet. Call once at the
   * start of a continuous gesture (drag start), then use update(..., {checkpoint:false}). */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  replaceDoc: (doc: SceneDocument) => void;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  doc: emptyScene(),
  past: [],
  future: [],

  checkpoint: () => {
    const { doc, past } = get();
    const next = [...past, structuredClone(doc)];
    if (next.length > HISTORY_LIMIT) next.shift();
    set({ past: next, future: [] });
  },

  update: (mutator, opts) => {
    const { doc, past } = get();
    const checkpoint = opts?.checkpoint ?? true;
    const next = structuredClone(doc);
    mutator(next);
    if (checkpoint) {
      const nextPast = [...past, structuredClone(doc)];
      if (nextPast.length > HISTORY_LIMIT) nextPast.shift();
      set({ doc: next, past: nextPast, future: [] });
    } else {
      set({ doc: next });
    }
  },

  undo: () => {
    const { doc, past, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({
      doc: prev,
      past: past.slice(0, -1),
      future: [structuredClone(doc), ...future],
    });
  },

  redo: () => {
    const { doc, past, future } = get();
    const next = future[0];
    if (!next) return;
    set({
      doc: next,
      past: [...past, structuredClone(doc)],
      future: future.slice(1),
    });
  },

  replaceDoc: (doc) => set({ doc, past: [], future: [] }),
}));
