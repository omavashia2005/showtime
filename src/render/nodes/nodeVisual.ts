import { color } from "../../tokens";
import type { NodeMetricsSnapshot } from "../../sim/protocol";
import type { FaultState, NodeKind } from "../../types/scene";

export interface RimTarget {
  colorHex: string;
  alpha: number;
  pulsing: boolean;
  width: number;
}

/** Section 9.1 rim-state rules, plus the 5.1 hover/selected overrides. */
export function computeRimTarget(
  fault: FaultState,
  health: NodeMetricsSnapshot["health"] | null,
  hovered: boolean,
  selected: boolean,
): RimTarget {
  if (selected) return { colorHex: color.primary, alpha: 1, pulsing: false, width: 2 };

  let colorHex: string = color.primary;
  let alpha = 0.7;
  let pulsing = false;

  if (fault.killed) {
    colorHex = color.stateIdle;
    alpha = 1;
  } else {
    const h = health ?? "idle";
    if (h === "idle") {
      colorHex = color.stateIdle;
      alpha = 1;
    } else if (h === "warning") {
      colorHex = color.stateWarning;
      alpha = 1;
    } else if (h === "critical") {
      colorHex = color.stateCritical;
      alpha = 1;
      pulsing = true;
    } else {
      colorHex = color.primary;
      alpha = 0.7;
    }
  }

  if (hovered) alpha = 1;
  return { colorHex, alpha, pulsing, width: 1.5 };
}

export function typeTagFor(kind: NodeKind): string | null {
  switch (kind) {
    case "client":
      return "CLIENT";
    case "router":
      return "ROUTER";
    case "shard":
      return "SHARD";
    case "partition":
      return "PARTITION";
    case "box":
      return "SERVICE";
    case "circle":
      return null;
  }
}
