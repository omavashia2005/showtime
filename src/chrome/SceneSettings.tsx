import { Settings } from "lucide-react";
import { useState } from "react";
import { useSceneStore } from "../store/sceneStore";
import { color } from "../tokens";
import { FieldRow, NumberField } from "./fields";
import { IconButton } from "./IconButton";
import { inputStyle, panelSurface } from "./panelStyle";
import { Tooltip } from "./Tooltip";

/** Scene-level settings (title/subtitle/time dilation/charts toggle) referenced by spec
 * sections 8.3 and 11 as "editable in scene settings" — not otherwise given a chrome location,
 * so this adds one gear button to the control bar using the same panel-surface styling as
 * every other popover rather than inventing a new visual language. */
export function SceneSettings() {
  const [open, setOpen] = useState(false);
  const doc = useSceneStore((s) => s.doc);
  const update = useSceneStore((s) => s.update);

  return (
    <div style={{ position: "relative" }}>
      <Tooltip label="Scene settings" side="top">
        <IconButton icon={<Settings size={18} strokeWidth={1.5} />} active={open} onClick={() => setOpen(!open)} />
      </Tooltip>
      {open && (
        <div
          style={{
            ...panelSurface,
            position: "absolute",
            bottom: "calc(100% + 8px)",
            right: 0,
            width: 260,
            padding: 14,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          <FieldRow label="Title">
            <input
              className="chrome-input"
              style={{ ...inputStyle, width: 150 }}
              value={doc.title}
              onChange={(e) => update((d) => void (d.title = e.target.value), { checkpoint: false })}
            />
          </FieldRow>
          <FieldRow label="Subtitle">
            <input
              className="chrome-input"
              style={{ ...inputStyle, width: 150 }}
              value={doc.subtitle}
              onChange={(e) => update((d) => void (d.subtitle = e.target.value), { checkpoint: false })}
            />
          </FieldRow>
          <FieldRow label="Time dilation">
            <NumberField
              value={doc.timeDilation}
              min={1}
              width={150}
              onChange={(v) => update((d) => void (d.timeDilation = v), { checkpoint: false })}
            />
          </FieldRow>
          <div className="chrome-field-row">
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: color.textDim }}>Charts overlay</span>
            <input
              type="checkbox"
              checked={doc.showChartsOverlay}
              onChange={(e) => update((d) => void (d.showChartsOverlay = e.target.checked), { checkpoint: false })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
