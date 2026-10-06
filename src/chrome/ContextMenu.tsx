import { useState, type CSSProperties } from "react";
import { useSceneStore } from "../store/sceneStore";
import { useUiStore } from "../store/uiStore";
import { color } from "../tokens";
import { panelSurface } from "./panelStyle";

const ITEM_STYLE: CSSProperties = {
  height: 32,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 10px",
  fontFamily: "Inter, sans-serif",
  fontSize: 13,
  cursor: "pointer",
  borderRadius: 6,
  background: "transparent",
  border: "none",
  width: "100%",
  textAlign: "left" as const,
};

function MenuItem({ label, destructive, onClick }: { label: string; destructive?: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{ ...ITEM_STYLE, background: hover ? color.bgRaised : "transparent", color: destructive ? color.stateCritical : color.text }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function InputRow({ label, defaultValue, onApply }: { label: string; defaultValue: number; onApply: (v: number) => void }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div style={{ ...ITEM_STYLE, gap: 6 }}>
      <span style={{ color: color.textDim, flex: 1 }}>{label}</span>
      <input
        className="chrome-input"
        style={{ width: 56, background: color.bgStage, border: `1px solid ${color.border}`, color: color.text, fontFamily: "Geist Mono, monospace", fontSize: 12 }}
        type="number"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <button
        style={{ background: "transparent", border: "none", color: color.primary, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12 }}
        onClick={() => onApply(value)}
      >
        Apply
      </button>
    </div>
  );
}

export function ContextMenu() {
  const menu = useUiStore((s) => s.contextMenu);
  const setMenu = useUiStore((s) => s.setContextMenu);
  const update = useSceneStore((s) => s.update);
  const doc = useSceneStore((s) => s.doc);

  if (!menu) return null;
  const close = () => setMenu(null);

  if (menu.target.kind === "node") {
    const node = doc.nodes.find((n) => n.id === menu.target.id);
    if (!node) return null;
    return (
      <>
        <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
        <div style={{ ...panelSurface, position: "fixed", left: menu.x, top: menu.y, borderRadius: 10, padding: 4, width: 220, zIndex: 1000 }}>
          <MenuItem
            label={node.fault.killed ? "Revive" : "Kill"}
            destructive={!node.fault.killed}
            onClick={() => {
              update((d) => {
                const n = d.nodes.find((x) => x.id === node.id);
                if (n) n.fault.killed = !n.fault.killed;
              });
              close();
            }}
          />
          <InputRow
            label="Add latency (ms)"
            defaultValue={node.fault.extraLatencyMs}
            onApply={(v) => {
              update((d) => {
                const n = d.nodes.find((x) => x.id === node.id);
                if (n) n.fault.extraLatencyMs = v;
              });
              close();
            }}
          />
          <InputRow
            label="Slow down (x)"
            defaultValue={node.fault.slowdownMultiplier}
            onApply={(v) => {
              update((d) => {
                const n = d.nodes.find((x) => x.id === node.id);
                if (n) n.fault.slowdownMultiplier = v;
              });
              close();
            }}
          />
          <MenuItem
            label="Delete"
            destructive
            onClick={() => {
              update((d) => {
                d.nodes = d.nodes.filter((x) => x.id !== node.id);
                d.edges = d.edges.filter((e) => e.sourceId !== node.id && e.targetId !== node.id);
              });
              close();
            }}
          />
        </div>
      </>
    );
  }

  if (menu.target.kind === "edge") {
    const edge = doc.edges.find((e) => e.id === menu.target.id);
    if (!edge) return null;
    return (
      <>
        <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
        <div style={{ ...panelSurface, position: "fixed", left: menu.x, top: menu.y, borderRadius: 10, padding: 4, width: 220, zIndex: 1000 }}>
          <MenuItem
            label={edge.partitioned ? "Heal" : "Partition"}
            destructive={!edge.partitioned}
            onClick={() => {
              update((d) => {
                const e = d.edges.find((x) => x.id === edge.id);
                if (e) e.partitioned = !e.partitioned;
              });
              close();
            }}
          />
          <InputRow
            label="Add latency (ms)"
            defaultValue={edge.latencyMs}
            onApply={(v) => {
              update((d) => {
                const e = d.edges.find((x) => x.id === edge.id);
                if (e) e.latencyMs = v;
              });
              close();
            }}
          />
          <InputRow
            label="Packet loss (%)"
            defaultValue={edge.lossPct}
            onApply={(v) => {
              update((d) => {
                const e = d.edges.find((x) => x.id === edge.id);
                if (e) e.lossPct = v;
              });
              close();
            }}
          />
          <MenuItem
            label="Delete"
            destructive
            onClick={() => {
              update((d) => {
                d.edges = d.edges.filter((x) => x.id !== edge.id);
              });
              close();
            }}
          />
        </div>
      </>
    );
  }

  return null;
}
