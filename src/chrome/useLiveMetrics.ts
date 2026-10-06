import { useEffect, useState } from "react";
import { simClient } from "../sim/simClientSingleton";
import type { NodeMetricsSnapshot } from "../sim/protocol";

const POLL_MS = 200;

/** Polls the worker's latest metrics for the inspector at a low rate — the stage itself reads
 * the snapshot directly every frame, but chrome is normal React and doesn't need that. */
export function useNodeMetrics(nodeId: string | null): NodeMetricsSnapshot | null {
  const [metrics, setMetrics] = useState<NodeMetricsSnapshot | null>(null);

  useEffect(() => {
    if (!nodeId) {
      setMetrics(null);
      return;
    }
    setMetrics(simClient.getNodeMetrics(nodeId));
    const id = setInterval(() => setMetrics(simClient.getNodeMetrics(nodeId)), POLL_MS);
    return () => clearInterval(id);
  }, [nodeId]);

  return metrics;
}
