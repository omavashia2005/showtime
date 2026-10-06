import { create } from "zustand";
import type { ToolId } from "../types/scene";

export type SelectableKind = "node" | "edge" | "frame" | "label" | "note" | "keyspaceBar";
export interface SelectionRef {
  kind: SelectableKind;
  id: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  target: SelectionRef;
}

interface UiStore {
  tool: ToolId;
  setTool: (t: ToolId) => void;

  selection: SelectionRef[];
  setSelection: (refs: SelectionRef[]) => void;
  addToSelection: (ref: SelectionRef) => void;
  clearSelection: () => void;

  hovered: SelectionRef | null;
  setHovered: (ref: SelectionRef | null) => void;

  contextMenu: ContextMenuState | null;
  setContextMenu: (m: ContextMenuState | null) => void;

  renaming: SelectionRef | null;
  setRenaming: (ref: SelectionRef | null) => void;

  paused: boolean;
  setPaused: (p: boolean) => void;
  togglePaused: () => void;

  recording: boolean;
  setRecording: (r: boolean) => void;
  toggleRecording: () => void;

  connectDraft: { fromNodeId: string } | null;
  setConnectDraft: (d: { fromNodeId: string } | null) => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  tool: "select",
  setTool: (t) => set({ tool: t, connectDraft: null }),

  selection: [],
  setSelection: (refs) => set({ selection: refs }),
  addToSelection: (ref) => {
    const cur = get().selection;
    if (cur.some((r) => r.kind === ref.kind && r.id === ref.id)) return;
    set({ selection: [...cur, ref] });
  },
  clearSelection: () => set({ selection: [] }),

  hovered: null,
  setHovered: (ref) => set({ hovered: ref }),

  contextMenu: null,
  setContextMenu: (m) => set({ contextMenu: m }),

  renaming: null,
  setRenaming: (ref) => set({ renaming: ref }),

  paused: false,
  setPaused: (p) => set({ paused: p }),
  togglePaused: () => set({ paused: !get().paused }),

  recording: false,
  setRecording: (r) => set({ recording: r }),
  toggleRecording: () => set({ recording: !get().recording }),

  connectDraft: null,
  setConnectDraft: (d) => set({ connectDraft: d }),
}));
