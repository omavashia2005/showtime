import { Pause, Play, RotateCcw, SkipForward, Video } from "lucide-react";
import { color } from "../tokens";
import { simClient } from "../sim/simClientSingleton";
import { useSceneStore } from "../store/sceneStore";
import { useUiStore } from "../store/uiStore";
import type { SceneDocument } from "../types/scene";
import { IconButton } from "./IconButton";
import { chromeValueStyle, inputStyle, panelSurface } from "./panelStyle";
import { SceneSettings } from "./SceneSettings";
import { Tooltip } from "./Tooltip";

const SPEEDS: SceneDocument["speed"][] = [0.25, 0.5, 1, 2, 4];

function Divider() {
  return <div style={{ width: 1, height: 24, background: color.border, flexShrink: 0 }} />;
}

interface ControlBarProps {
  visible: boolean;
}

export function ControlBar({ visible }: ControlBarProps) {
  const doc = useSceneStore((s) => s.doc);
  const update = useSceneStore((s) => s.update);
  const paused = useUiStore((s) => s.paused);
  const setPaused = useUiStore((s) => s.setPaused);
  const recording = useUiStore((s) => s.recording);
  const toggleRecording = useUiStore((s) => s.toggleRecording);

  const setSpeed = (speed: SceneDocument["speed"]) => update((d) => void (d.speed = speed), { checkpoint: false });

  return (
    <div
      className={`chrome-panel ${visible ? "" : "chrome-hidden-bottom"}`}
      style={{
        ...panelSurface,
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: visible ? "translateX(-50%)" : "translateX(-50%) translateY(8px)",
        height: 52,
        padding: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex: 10,
      }}
    >
      <Tooltip label={paused ? "Play" : "Pause"} hotkey="Space" side="top">
        <IconButton
          icon={paused ? <Play size={18} strokeWidth={1.5} /> : <Pause size={18} strokeWidth={1.5} />}
          onClick={() => setPaused(!paused)}
        />
      </Tooltip>
      <Tooltip label="Step" hotkey="." side="top">
        <IconButton
          icon={<SkipForward size={18} strokeWidth={1.5} />}
          onClick={() => simClient.step(doc.speed, doc.timeDilation)}
        />
      </Tooltip>

      <SpeedControl speed={doc.speed} onChange={setSpeed} />

      <Divider />

      <GlobalRpsControl />

      <Divider />

      <Tooltip label="Reset sim" side="top">
        <IconButton icon={<RotateCcw size={18} strokeWidth={1.5} />} onClick={() => simClient.reset()} />
      </Tooltip>
      <Tooltip label="Recording mode" hotkey="H" side="top">
        <IconButton icon={<Video size={18} strokeWidth={1.5} />} active={recording} onClick={toggleRecording} />
      </Tooltip>
      <Divider />
      <SceneSettings />
    </div>
  );
}

function SpeedControl({
  speed,
  onChange,
}: {
  speed: SceneDocument["speed"];
  onChange: (s: SceneDocument["speed"]) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 2, background: "transparent" }}>
      {SPEEDS.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            ...chromeValueStyle,
            border: "none",
            borderRadius: 6,
            padding: "4px 8px",
            cursor: "pointer",
            background: speed === s ? color.bgRaised : "transparent",
            color: speed === s ? color.primary : color.textDim,
          }}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}

function GlobalRpsControl() {
  const doc = useSceneStore((s) => s.doc);
  const update = useSceneStore((s) => s.update);

  const setRps = (v: number) => update((d) => void (d.globalRps = Math.max(0, Math.round(v))), { checkpoint: false });
  const setMin = (v: number) => update((d) => void (d.globalRpsSliderMin = v), { checkpoint: false });
  const setMax = (v: number) => update((d) => void (d.globalRpsSliderMax = v), { checkpoint: false });

  const pct =
    doc.globalRpsSliderMax > doc.globalRpsSliderMin
      ? ((doc.globalRps - doc.globalRpsSliderMin) / (doc.globalRpsSliderMax - doc.globalRpsSliderMin)) * 100
      : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        className="chrome-input"
        style={{ ...inputStyle, width: 64 }}
        type="number"
        min={0}
        step={1}
        value={doc.globalRps}
        onChange={(e) => setRps(Number(e.target.value))}
      />
      <input
        className="chrome-input"
        style={{ ...inputStyle, width: 44 }}
        type="number"
        value={doc.globalRpsSliderMin}
        onChange={(e) => setMin(Number(e.target.value))}
      />
      <input
        className="chrome-slider"
        style={{ width: 160, ["--pct" as string]: `${Math.min(100, Math.max(0, pct))}%` }}
        type="range"
        min={doc.globalRpsSliderMin}
        max={doc.globalRpsSliderMax}
        value={doc.globalRps}
        onChange={(e) => setRps(Number(e.target.value))}
      />
      <input
        className="chrome-input"
        style={{ ...inputStyle, width: 44 }}
        type="number"
        value={doc.globalRpsSliderMax}
        onChange={(e) => setMax(Number(e.target.value))}
      />
    </div>
  );
}
