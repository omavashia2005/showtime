import { useEffect, useRef, useState } from "react";
import { rendererCell } from "../render/rendererCell";
import { useSceneStore } from "../store/sceneStore";
import { useUiStore } from "../store/uiStore";
import { color } from "../tokens";

interface Target {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  uppercase: boolean;
}

function resolveTarget(): Target | null {
  const renaming = useUiStore.getState().renaming;
  if (!renaming) return null;
  const doc = useSceneStore.getState().doc;
  const renderer = rendererCell.current;
  if (!renderer) return null;
  const canvas = renderer.app.canvas as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();

  let local: { text: string; pos: { x: number; y: number }; width: number; height: number; fontSize: number; uppercase: boolean } | null = null;
  if (renaming.kind === "node") {
    const n = doc.nodes.find((x) => x.id === renaming.id);
    if (n) local = { text: n.name, pos: n.pos, width: n.size.x - 28, height: 24, fontSize: 20, uppercase: false };
  } else if (renaming.kind === "label") {
    const l = doc.labels.find((x) => x.id === renaming.id);
    if (l) local = { text: l.text, pos: l.pos, width: 200, height: 20, fontSize: 16, uppercase: false };
  } else if (renaming.kind === "note") {
    const note = doc.notes.find((x) => x.id === renaming.id);
    if (note) local = { text: note.text, pos: note.pos, width: note.width - 28, height: 20, fontSize: 16, uppercase: false };
  } else if (renaming.kind === "frame") {
    const f = doc.frames.find((x) => x.id === renaming.id);
    if (f) local = { text: f.name, pos: f.pos, width: f.size.x - 24, height: 18, fontSize: 13, uppercase: true };
  }
  if (!local) return null;

  const viewportPos = renderer.stageToViewport(local.pos.x, local.pos.y);
  const scale = renderer.scale;
  return {
    text: local.text,
    x: rect.left + viewportPos.x + 14 * scale,
    y: rect.top + viewportPos.y + 12 * scale,
    width: local.width * scale,
    height: local.height * scale,
    fontSize: local.fontSize * scale,
    uppercase: local.uppercase,
  };
}

/** Inline rename input (spec section 12): styled as the label it replaces, 1px primary
 * underline, committed on blur/Enter, cancelled on Escape. */
export function RenameOverlay() {
  const renaming = useUiStore((s) => s.renaming);
  const [target, setTarget] = useState<Target | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) {
      setTarget(null);
      return;
    }
    const t = resolveTarget();
    setTarget(t);
    setValue(t?.text ?? "");
  }, [renaming]);

  useEffect(() => {
    if (target) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [target]);

  if (!renaming || !target) return null;

  const commit = () => {
    useSceneStore.getState().update((d) => {
      if (renaming.kind === "node") {
        const n = d.nodes.find((x) => x.id === renaming.id);
        if (n) n.name = value;
      } else if (renaming.kind === "label") {
        const l = d.labels.find((x) => x.id === renaming.id);
        if (l) l.text = value;
      } else if (renaming.kind === "note") {
        const note = d.notes.find((x) => x.id === renaming.id);
        if (note) note.text = value;
      } else if (renaming.kind === "frame") {
        const f = d.frames.find((x) => x.id === renaming.id);
        if (f) f.name = value;
      }
    });
    useUiStore.getState().setRenaming(null);
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") useUiStore.getState().setRenaming(null);
      }}
      style={{
        position: "fixed",
        left: target.x,
        top: target.y,
        width: target.width,
        height: target.height,
        fontSize: target.fontSize,
        textTransform: target.uppercase ? "uppercase" : "none",
        fontFamily: target.uppercase ? "Geist Mono, monospace" : "Inter, sans-serif",
        color: color.text,
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${color.primary}`,
        outline: "none",
        padding: 0,
        zIndex: 1001,
      }}
    />
  );
}
