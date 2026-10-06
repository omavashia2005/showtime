import { useSceneStore } from "./store/sceneStore";
import type { SceneDocument } from "./types/scene";

const STORAGE_KEY = "dsw-scene-v1";
const AUTOSAVE_DEBOUNCE_MS = 500;

function isSceneDocument(value: unknown): value is SceneDocument {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 1;
}

/** Restores the autosaved scene from localStorage, if any. Returns whether it restored one. */
export function restoreAutosave(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!isSceneDocument(parsed)) return false;
    useSceneStore.getState().replaceDoc(parsed);
    return true;
  } catch {
    return false;
  }
}

/** Debounced 500ms-after-change autosave to localStorage (spec section 13). */
export function installAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = useSceneStore.subscribe((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.doc));
      } catch {
        // Storage can be full or unavailable (private browsing); autosave is best-effort.
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

export function exportScene(): void {
  const doc = useSceneStore.getState().doc;
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.trim() || "scene"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importSceneFromFile(file: File): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!isSceneDocument(parsed)) throw new Error("Unrecognized scene file");
  useSceneStore.getState().replaceDoc(parsed);
}

/** Opens a native file picker and imports the chosen scene JSON (spec section 13). */
export function triggerImportPicker(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    importSceneFromFile(file).catch((err) => {
      console.error("Scene import failed:", err);
    });
  };
  input.click();
}
