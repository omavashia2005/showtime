import { useState, type ReactNode } from "react";
import { color } from "../tokens";
import { panelSurface } from "./panelStyle";

interface TooltipProps {
  label: string;
  hotkey?: string;
  side?: "right" | "top";
  children: ReactNode;
}

/** Hover tooltip per spec section 10.1: appears after 400ms, panel surface, 8px offset. */
export function Tooltip({ label, hotkey, side = "right", children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => {
        timer = setTimeout(() => setVisible(true), 400);
      }}
      onMouseLeave={() => {
        if (timer) clearTimeout(timer);
        setVisible(false);
      }}
    >
      {children}
      {visible && (
        <div
          style={{
            ...panelSurface,
            position: "absolute",
            ...(side === "right" ? { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" } : {}),
            ...(side === "top" ? { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" } : {}),
            borderRadius: 8,
            padding: "6px 10px",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 1000,
          }}
        >
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: color.text }}>{label}</span>
          {hotkey && (
            <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 13, color: color.textDim }}>{hotkey}</span>
          )}
        </div>
      )}
    </div>
  );
}
