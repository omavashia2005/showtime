import {
  Cable,
  Circle as CircleIcon,
  Database,
  Divide,
  Frame,
  Layers,
  MousePointer2,
  Router as RouterIcon,
  Ruler,
  Square,
  StickyNote,
  Type,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { useUiStore } from "../store/uiStore";
import type { ToolId } from "../types/scene";
import { IconButton } from "./IconButton";
import { panelSurface } from "./panelStyle";
import { Tooltip } from "./Tooltip";

interface ToolDef {
  id: ToolId;
  label: string;
  hotkey?: string;
  icon: ReactNode;
}

const ICON_SIZE = 18;
const STROKE = 1.5;

const tools: (ToolDef | "divider")[] = [
  { id: "select", label: "Select", hotkey: "V", icon: <MousePointer2 size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "connect", label: "Connect", hotkey: "C", icon: <Cable size={ICON_SIZE} strokeWidth={STROKE} /> },
  "divider",
  { id: "client", label: "Client", icon: <User size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "router", label: "Router", icon: <RouterIcon size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "shard", label: "Shard", icon: <Database size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "partition", label: "Partition", icon: <Divide size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "replicaSet", label: "Replica set", icon: <Layers size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "keyspaceBar", label: "Keyspace bar", icon: <Ruler size={ICON_SIZE} strokeWidth={STROKE} /> },
  "divider",
  { id: "box", label: "Box", icon: <Square size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "circle", label: "Circle", icon: <CircleIcon size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "groupFrame", label: "Group frame", icon: <Frame size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "text", label: "Text", icon: <Type size={ICON_SIZE} strokeWidth={STROKE} /> },
  { id: "stickyNote", label: "Sticky note", icon: <StickyNote size={ICON_SIZE} strokeWidth={STROKE} /> },
];

interface PaletteProps {
  visible: boolean;
}

export function Palette({ visible }: PaletteProps) {
  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);

  return (
    <div
      className={`chrome-panel ${visible ? "" : "chrome-hidden-left"}`}
      style={{
        ...panelSurface,
        position: "fixed",
        left: 16,
        top: "50%",
        transform: visible ? "translateY(-50%)" : "translateY(-50%) translateX(-8px)",
        width: 62,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        zIndex: 10,
      }}
    >
      {tools.map((t, i) =>
        t === "divider" ? (
          <div key={`d${i}`} style={{ width: 24, height: 1, background: "#1F3B38", margin: "6px 0" }} />
        ) : (
          <Tooltip key={t.id} label={t.label} hotkey={t.hotkey}>
            <IconButton icon={t.icon} active={tool === t.id} onClick={() => setTool(t.id)} title={t.label} />
          </Tooltip>
        ),
      )}
    </div>
  );
}
