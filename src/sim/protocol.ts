import type { EdgeGeom } from "../render/edgeGeometry";
import type { ClientParams, FaultState, NodeKind, ServiceParams } from "../types/scene";

export type ParticleColorId = 0 | 1 | 2 | 3 | 4; // request, response, error, retry, replication

export interface SimNodeDesc {
  id: string;
  kind: NodeKind;
  service: ServiceParams;
  client: ClientParams | null;
  fault: FaultState;
  replicaGroupId: string | null;
}

export interface SimReplicaGroupDesc {
  id: string;
  memberIds: string[];
  leaderId: string | null;
  ackQuorum: "majority" | number;
}

export interface SimEdgeDesc {
  id: string;
  sourceId: string;
  targetId: string;
  latencyMs: number;
  jitterMs: number;
  lossPct: number;
  partitioned: boolean;
  geom: EdgeGeom;
}

export interface SimKeyRangeDesc {
  start: number;
  end: number;
  ownerNodeId: string;
}

export interface SimKeyspaceBarDesc {
  id: string;
  linkedRouterId: string | null;
  ranges: SimKeyRangeDesc[];
}

export interface SetScenePayload {
  nodes: SimNodeDesc[];
  edges: SimEdgeDesc[]; // order is stable and used to decode particleSpawnBuffer edge indices
  replicaGroups: SimReplicaGroupDesc[];
  keyspaceBars: SimKeyspaceBarDesc[];
  globalRps: number;
}

export type MainToWorker =
  | { type: "setScene"; payload: SetScenePayload }
  | { type: "tick"; wallDtMs: number; speed: number; timeDilation: number }
  | { type: "step"; speed: number; timeDilation: number }
  | { type: "reset" }
  | { type: "setFault"; nodeId: string; fault: Partial<FaultState> }
  | { type: "setEdgeFault"; edgeId: string; partitioned?: boolean; lossPct?: number; latencyMs?: number };

export interface NodeMetricsSnapshot {
  p50: number;
  p99: number;
  throughput: number;
  errorRate: number;
  queueLen: number;
  queueCap: number;
  utilization: number;
  health: "idle" | "normal" | "warning" | "critical";
}

export interface GlobalMetricsSnapshot {
  p50: number;
  p99: number;
  throughput: number;
  errorRate: number;
}

export interface BurstEvent {
  x: number;
  y: number;
}

export interface KeyRouteDotEvent {
  barId: string;
  frac: number; // 0..1 position along the keyspace bar
}

/**
 * Particle spawn buffer layout: 5 floats per spawn, emitted once per edge per tick (section 7
 * sampling). The main thread owns position interpolation (bezier eval + wall-clock duration) so
 * animation stays smooth regardless of worker tick jitter; see sim/client.ts.
 * Fields: [edgeIndex, forwardFlag(0|1), colorId, durationMsWall, outcomeFlag(0=delivered,1=burst)]
 */
export interface SnapshotMessage {
  type: "snapshot";
  simTimeMs: number;
  spawnBuffer: ArrayBuffer;
  spawnCount: number;
  nodeMetrics: Record<string, NodeMetricsSnapshot>;
  globalMetrics: GlobalMetricsSnapshot;
  bursts: BurstEvent[];
  keyRouteDots: KeyRouteDotEvent[];
}

export type WorkerToMain = SnapshotMessage;

export const SPAWN_FLOATS_PER_ENTRY = 5;
