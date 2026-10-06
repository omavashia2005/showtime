import { simClient } from "../sim/simClientSingleton";
import { useSceneStore } from "../store/sceneStore";
import { useUiStore } from "../store/uiStore";
import type { SceneDocument } from "../types/scene";
import { deleteSelection, duplicateSelection } from "./selectionOps";

const SPEEDS: SceneDocument["speed"][] = [0.25, 0.5, 1, 2, 4];

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

export interface HotkeyCallbacks {
  onExport?: () => void;
  onImport?: () => void;
}

/** Section 12 hotkeys. Returns a cleanup function. */
export function installHotkeys(callbacks: HotkeyCallbacks = {}): () => void {
  const handler = (e: KeyboardEvent) => {
    const ui = useUiStore.getState();
    const meta = e.metaKey || e.ctrlKey;

    if (e.key === "Escape") {
      useUiStore.getState().clearSelection();
      useUiStore.getState().setContextMenu(null);
      useUiStore.getState().setRenaming(null);
      return;
    }

    if (isTypingTarget(document.activeElement)) return;

    if (meta && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) useSceneStore.getState().redo();
      else useSceneStore.getState().undo();
      return;
    }
    if (meta && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const doc = useSceneStore.getState().doc;
      let created: ReturnType<typeof duplicateSelection> = [];
      useSceneStore.getState().update((d) => {
        created = duplicateSelection(d, ui.selection);
      });
      void doc;
      if (created.length) useUiStore.getState().setSelection(created);
      return;
    }
    if (meta && e.key.toLowerCase() === "s") {
      e.preventDefault();
      callbacks.onExport?.();
      return;
    }
    if (meta && e.key.toLowerCase() === "o") {
      e.preventDefault();
      callbacks.onImport?.();
      return;
    }

    switch (e.key) {
      case " ":
        e.preventDefault();
        useUiStore.getState().togglePaused();
        break;
      case ".": {
        const doc = useSceneStore.getState().doc;
        simClient.step(doc.speed, doc.timeDilation);
        break;
      }
      case "[": {
        const doc = useSceneStore.getState().doc;
        const idx = Math.max(0, SPEEDS.indexOf(doc.speed) - 1);
        useSceneStore.getState().update((d) => void (d.speed = SPEEDS[idx]!), { checkpoint: false });
        break;
      }
      case "]": {
        const doc = useSceneStore.getState().doc;
        const idx = Math.min(SPEEDS.length - 1, SPEEDS.indexOf(doc.speed) + 1);
        useSceneStore.getState().update((d) => void (d.speed = SPEEDS[idx]!), { checkpoint: false });
        break;
      }
      case "h":
      case "H":
        useUiStore.getState().toggleRecording();
        break;
      case "v":
      case "V":
        useUiStore.getState().setTool("select");
        break;
      case "c":
      case "C":
        useUiStore.getState().setTool("connect");
        break;
      case "Delete":
      case "Backspace":
        if (ui.selection.length > 0) {
          useSceneStore.getState().update((d) => deleteSelection(d, ui.selection));
          useUiStore.getState().clearSelection();
        }
        break;
    }
  };

  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}
