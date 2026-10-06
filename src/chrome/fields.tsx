import type { ReactNode } from "react";
import { chromeLabelStyle, chromeValueStyle, inputStyle } from "./panelStyle";

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="chrome-field-row">
      <span style={chromeLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  step = 1,
  min,
  max,
  width = 110,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  width?: number;
}) {
  return (
    <input
      className="chrome-input"
      style={{ ...inputStyle, width }}
      type="number"
      step={step}
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  width = 110,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  width?: number;
}) {
  return (
    <select
      className="chrome-input"
      style={{ ...inputStyle, width }}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ ...chromeLabelStyle, marginTop: 12, marginBottom: 4, textTransform: "uppercase" }}>{children}</div>;
}

export function MetricRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="chrome-field-row">
      <span style={chromeLabelStyle}>{label}</span>
      <span>
        <span style={chromeValueStyle}>{value}</span>
        {unit && <span style={{ ...chromeValueStyle, color: "#8AA3B8", marginLeft: 4 }}>{unit}</span>}
      </span>
    </div>
  );
}
