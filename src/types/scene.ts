/** Scene schema — persisted layout + params. Section 13. */

export type Vec2 = { x: number; y: number };

export type NodeKind =
  | "client"
  | "router"
  | "shard"
  | "partition"
  | "box"
  | "circle";

export interface ServiceParams {
  workers: number;
  serviceTimeMs: number;
  serviceTimeSigma: number;
  queueCapacity: number;
}

export const defaultServiceParams: ServiceParams = {
  workers: 4,
  serviceTimeMs: 5,
  serviceTimeSigma: 0.5,
  queueCapacity: 64,
};

export interface ClientParams {
  rpsOverride: number | null;
  readWriteMix: number; // 0..1 fraction reads, default 0.9
  keyDistribution: "uniform" | "zipf";
  zipfS: number;
  timeoutMs: number;
  maxRetries: number;
  retryBackoffBaseMs: number;
  retryBackoffFactor: number;
}

export const defaultClientParams: ClientParams = {
  rpsOverride: null,
  readWriteMix: 0.9,
  keyDistribution: "uniform",
  zipfS: 1.1,
  timeoutMs: 200,
  maxRetries: 2,
  retryBackoffBaseMs: 20,
  retryBackoffFactor: 2,
};

export interface FaultState {
  killed: boolean;
  extraLatencyMs: number;
  slowdownMultiplier: number;
}

export const defaultFaultState: FaultState = {
  killed: false,
  extraLatencyMs: 0,
  slowdownMultiplier: 1,
};

export interface SceneNode {
  id: string;
  kind: NodeKind;
  name: string;
  pos: Vec2;
  size: Vec2;
  groupId: string | null;
  service: ServiceParams;
  client: ClientParams | null; // only for kind === "client"
  fault: FaultState;
}

export interface SceneEdge {
  id: string;
  sourceId: string;
  targetId: string;
  latencyMs: number;
  jitterMs: number;
  lossPct: number;
  partitioned: boolean;
}

export type GroupFrameKind = "generic" | "replicaSet";

export interface ReplicaSetConfig {
  leaderId: string | null;
  ackQuorum: "majority" | number;
}

export interface GroupFrame {
  id: string;
  kind: GroupFrameKind;
  name: string;
  pos: Vec2;
  size: Vec2;
  memberIds: string[];
  replicaSet: ReplicaSetConfig | null;
}

export interface TextLabel {
  id: string;
  text: string;
  pos: Vec2;
}

export interface StickyNote {
  id: string;
  text: string;
  pos: Vec2;
  width: number;
}

export interface KeyRange {
  id: string;
  start: number; // 0..2^32
  end: number;
  ownerNodeId: string;
}

export interface KeyspaceBar {
  id: string;
  pos: Vec2;
  width: number;
  ranges: KeyRange[];
  linkedRouterId: string | null;
}

export type ToolId =
  | "select"
  | "connect"
  | "client"
  | "router"
  | "shard"
  | "partition"
  | "replicaSet"
  | "keyspaceBar"
  | "box"
  | "circle"
  | "groupFrame"
  | "text"
  | "stickyNote";

export interface SceneDocument {
  version: 1;
  nodes: SceneNode[];
  edges: SceneEdge[];
  frames: GroupFrame[];
  labels: TextLabel[];
  notes: StickyNote[];
  keyspaceBars: KeyspaceBar[];
  globalRps: number;
  globalRpsSliderMin: number;
  globalRpsSliderMax: number;
  speed: 0.25 | 0.5 | 1 | 2 | 4;
  timeDilation: number;
  title: string;
  subtitle: string;
  showChartsOverlay: boolean;
}

export const KEYSPACE_MAX = 2 ** 32;

export function emptyScene(): SceneDocument {
  return {
    version: 1,
    nodes: [],
    edges: [],
    frames: [],
    labels: [],
    notes: [],
    keyspaceBars: [],
    globalRps: 100,
    globalRpsSliderMin: 0,
    globalRpsSliderMax: 1000,
    speed: 1,
    timeDilation: 20,
    title: "",
    subtitle: "",
    showChartsOverlay: true,
  };
}
