import { useState, type ReactNode } from "react";
import { color } from "../tokens";

interface IconButtonProps {
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}

/** 32x32 icon button, radius 8, hover background bg.raised (spec section 10). */
export function IconButton({ icon, active, onClick, title }: IconButtonProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{ background: hover ? color.bgRaised : "transparent" }}
    >
      <span style={{ color: active ? color.primary : color.textDim, display: "flex" }}>{icon}</span>
    </button>
  );
}
