import { cubicBezierPoint } from "../render/edgeGeometry";
import { MinHeap } from "./heap";
import type {
  BurstEvent,
  GlobalMetricsSnapshot,
  KeyRouteDotEvent,
  NodeMetricsSnapshot,
  ParticleColorId,
  SetScenePayload,
  SimEdgeDesc,
  SimKeyspaceBarDesc,
  SimNodeDesc,
  SimReplicaGroupDesc,
} from "./protocol";
import { exponential, fullJitterBackoff, lognormal, makeRng, uniform, zipfBucket } from "./random";
import type { FaultState } from "../types/scene";
import { KEYSPACE_MAX } from "../types/scene";

const METRICS_WINDOW_MS = 10_000;
const ZIPF_BUCKETS = 200;
const MIN_VISUAL_MS = 250;
const MAX_VISUAL_MS = 1500;

interface Completion {
  t: number;
  latencyMs: number;
  error: boolean;
}

interface NodeState {
  desc: SimNodeDesc;
  queue: Task[];
  busy: number;
  completions: Completion[];
  lastArrivalAtSim: number;
  lastDropAtSim: number;
  arrivalScheduled: boolean;
}

interface Task {
  packet: Packet;
  enqueuedAtSim: number;
}

type PacketKind = "req" | "resp" | "err" | "replication" | "replicationAck";

interface Packet {
  requestId: number;
  attempt: number;
  isWrite: boolean;
  key: number;
  clientId: string;
  kind: PacketKind;
  pathEdgeIds: string[];
  cursor: number; // response/err/ack traversal: index into pathEdgeIds walking backward
}

interface PendingClientRequest {
  attempt: number;
  sentAtSim: number;
}

interface LeaderPendingWrite {
  neededFollowerAcks: number;
  acksGot: number;
  origPacket: Packet;
  leaderId: string;
}

type EngineEvent =
  | { kind: "clientArrival"; clientId: string }
  | { kind: "edgeArrive"; edgeId: string; forward: boolean; packet: Packet }
  | { kind: "serviceComplete"; nodeId: string; task: Task }
  | { kind: "clientTimeoutCheck"; clientId: string; requestId: number; attempt: number }
  | { kind: "retryFire"; clientId: string; requestId: number; attempt: number; key: number; isWrite: boolean };

interface PendingSpawn {
  edgeId: string;
  forward: boolean;
  colorId: ParticleColorId;
  durationMsWall: number;
  outcome: 0 | 1; // 0 = delivered, 1 = burst
}

const COLOR = { req: 0, resp: 1, err: 2, retry: 3, replication: 4 } as const satisfies Record<string, ParticleColorId>;

export class SimEngine {
  private nodes = new Map<string, NodeState>();
  private edges = new Map<string, SimEdgeDesc>();
  private replicaGroups = new Map<string, SimReplicaGroupDesc>();
  private memberToGroup = new Map<string, string>();
  private keyspaceBars: SimKeyspaceBarDesc[] = [];
  private adjacency = new Map<string, SimEdgeDesc[]>(); // nodeId -> incident edges
  private globalRps = 0;
  private timeDilation = 20;

  private heap = new MinHeap<EngineEvent>();
  private simTimeMs = 0;
  private rng = makeRng(12345);
  private requestSeq = 1;

  private pendingByClient = new Map<string, Map<number, PendingClientRequest>>();
  private leaderPendingWrites = new Map<number, LeaderPendingWrite>();
  private retryKeys = new Map<number, { key: number; isWrite: boolean }>();

  private globalCompletions: Completion[] = [];

  private pendingBursts: BurstEvent[] = [];
  private pendingKeyDots: KeyRouteDotEvent[] = [];
  private pendingSpawns: PendingSpawn[] = [];

  setScene(payload: SetScenePayload): void {
    const prevNodes = this.nodes;
    this.nodes = new Map();
    for (const n of payload.nodes) {
      const existing = prevNodes.get(n.id);
      this.nodes.set(n.id, {
        desc: n,
        queue: existing?.queue ?? [],
        busy: existing?.busy ?? 0,
        completions: existing?.completions ?? [],
        lastArrivalAtSim: existing?.lastArrivalAtSim ?? -Infinity,
        lastDropAtSim: existing?.lastDropAtSim ?? -Infinity,
        arrivalScheduled: existing?.arrivalScheduled ?? false,
      });
    }

    this.edges = new Map(payload.edges.map((e) => [e.id, e]));
    this.adjacency = new Map();
    for (const e of payload.edges) {
      this.pushAdj(e.sourceId, e);
      this.pushAdj(e.targetId, e);
    }

    this.replicaGroups = new Map(payload.replicaGroups.map((g) => [g.id, g]));
    this.memberToGroup = new Map();
    for (const g of payload.replicaGroups) {
      for (const m of g.memberIds) this.memberToGroup.set(m, g.id);
    }

    this.keyspaceBars = payload.keyspaceBars;
    this.globalRps = payload.globalRps;

    this.ensureClientArrivals();
  }

  private pushAdj(nodeId: string, e: SimEdgeDesc): void {
    const list = this.adjacency.get(nodeId);
    if (list) list.push(e);
    else this.adjacency.set(nodeId, [e]);
  }

  setFault(nodeId: string, fault: Partial<FaultState>): void {
    const n = this.nodes.get(nodeId);
    if (!n) return;
    n.desc = { ...n.desc, fault: { ...n.desc.fault, ...fault } };
  }

  setEdgeFault(edgeId: string, partial: { partitioned?: boolean; lossPct?: number; latencyMs?: number }): void {
    const e = this.edges.get(edgeId);
    if (!e) return;
    this.edges.set(edgeId, { ...e, ...partial });
  }

  reset(): void {
    this.heap.clear();
    this.simTimeMs = 0;
    this.pendingByClient.clear();
    this.leaderPendingWrites.clear();
    this.retryKeys.clear();
    this.globalCompletions = [];
    this.pendingBursts = [];
    this.pendingKeyDots = [];
    this.pendingSpawns = [];
    for (const n of this.nodes.values()) {
      n.queue = [];
      n.busy = 0;
      n.completions = [];
      n.lastArrivalAtSim = -Infinity;
      n.lastDropAtSim = -Infinity;
      n.arrivalScheduled = false;
    }
    this.ensureClientArrivals();
  }

  /** Advance sim by simDtMs, processing all due events. `timeDilation` affects only the
   * wall-clock visual duration assigned to particle spawns created during this call. */
  advance(simDtMs: number, timeDilation: number): void {
    this.timeDilation = timeDilation;
    const target = this.simTimeMs + simDtMs;
    for (;;) {
      const t = this.heap.peekTime();
      if (t === undefined || t > target) break;
      const ev = this.heap.pop();
      if (!ev) break;
      this.simTimeMs = t;
      this.handleEvent(ev);
    }
    this.simTimeMs = target;
  }

  private clientsWithoutOverride(): number {
    let count = 0;
    for (const n of this.nodes.values()) {
      if (n.desc.kind === "client" && n.desc.client && n.desc.client.rpsOverride == null) count++;
    }
    return count;
  }

  private effectiveRps(n: NodeState): number {
    if (!n.desc.client) return 0;
    if (n.desc.client.rpsOverride != null) return n.desc.client.rpsOverride;
    const denom = this.clientsWithoutOverride();
    return denom > 0 ? this.globalRps / denom : 0;
  }

  private ensureClientArrivals(): void {
    for (const n of this.nodes.values()) {
      if (n.desc.kind !== "client" || n.arrivalScheduled) continue;
      this.scheduleNextArrival(n.desc.id);
    }
  }

  private scheduleNextArrival(clientId: string): void {
    const n = this.nodes.get(clientId);
    if (!n) return;
    const rate = this.effectiveRps(n) / 1000; // per ms
    if (rate <= 0) {
      n.arrivalScheduled = false;
      return;
    }
    const dt = exponential(this.rng, rate);
    n.arrivalScheduled = true;
    this.heap.push(this.simTimeMs + dt, { kind: "clientArrival", clientId });
  }

  private handleEvent(ev: EngineEvent): void {
    switch (ev.kind) {
      case "clientArrival":
        this.onClientArrival(ev.clientId);
        break;
      case "edgeArrive":
        this.onEdgeArrive(ev.edgeId, ev.forward, ev.packet);
        break;
      case "serviceComplete":
        this.onServiceComplete(ev.nodeId, ev.task);
        break;
      case "clientTimeoutCheck":
        this.onClientTimeoutCheck(ev.clientId, ev.requestId, ev.attempt);
        break;
      case "retryFire":
        this.onRetryFire(ev.clientId, ev.requestId, ev.attempt, ev.key, ev.isWrite);
        break;
    }
  }

  private onClientArrival(clientId: string): void {
    const n = this.nodes.get(clientId);
    if (!n || !n.desc.client) return;
    const params = n.desc.client;
    const isWrite = this.rng() >= params.readWriteMix;
    const key = this.sampleKey(params.keyDistribution, params.zipfS);
    const requestId = this.requestSeq++;
    this.startAttempt(clientId, requestId, 1, key, isWrite);
    this.scheduleNextArrival(clientId);
  }

  private sampleKey(dist: "uniform" | "zipf", s: number): number {
    if (dist === "uniform") return Math.floor(this.rng() * KEYSPACE_MAX);
    const bucket = zipfBucket(this.rng, ZIPF_BUCKETS, s);
    const bucketWidth = KEYSPACE_MAX / ZIPF_BUCKETS;
    return Math.floor(bucket * bucketWidth + this.rng() * bucketWidth);
  }

  private startAttempt(clientId: string, requestId: number, attempt: number, key: number, isWrite: boolean): void {
    const n = this.nodes.get(clientId);
    if (!n || !n.desc.client) return;
    let byReq = this.pendingByClient.get(clientId);
    if (!byReq) {
      byReq = new Map();
      this.pendingByClient.set(clientId, byReq);
    }
    byReq.set(requestId, { attempt, sentAtSim: this.simTimeMs });
    this.retryKeys.set(requestId, { key, isWrite });

    const edge = this.pickEdgeFrom(clientId);
    const packet: Packet = { requestId, attempt, isWrite, key, clientId, kind: "req", pathEdgeIds: [], cursor: 0 };
    if (!edge) {
      this.completeOrFail(clientId, requestId, attempt, true);
      return;
    }
    this.sendForward(edge, clientId, packet);

    this.heap.push(this.simTimeMs + n.desc.client.timeoutMs, {
      kind: "clientTimeoutCheck",
      clientId,
      requestId,
      attempt,
    });
  }

  private pickEdgeFrom(nodeId: string): SimEdgeDesc | null {
    const list = this.adjacency.get(nodeId);
    if (!list || list.length === 0) return null;
    const idx = Math.floor(this.rng() * list.length);
    return list[idx] ?? list[0] ?? null;
  }

  /** Send a packet forward across `edge`, starting from `fromNodeId`. */
  private sendForward(edge: SimEdgeDesc, fromNodeId: string, packet: Packet): void {
    packet.pathEdgeIds.push(edge.id);
    const forward = edge.sourceId === fromNodeId;
    const colorId = packet.attempt > 1 ? COLOR.retry : COLOR.req;
    this.travelEdge(edge, forward, packet, colorId);
  }

  private travelEdge(edge: SimEdgeDesc, forward: boolean, packet: Packet, colorId: ParticleColorId): void {
    if (edge.partitioned) {
      this.spawnParticle(edge, forward, colorId, 1, 0.5);
      return;
    }
    const jitter = uniform(this.rng, -edge.jitterMs, edge.jitterMs);
    const latency = Math.max(0, edge.latencyMs + jitter);
    if (this.rng() * 100 < edge.lossPct) {
      this.spawnParticle(edge, forward, colorId, 1, uniform(this.rng, 0.3, 0.9));
      return;
    }
    this.spawnParticle(edge, forward, colorId, 0, 1);
    this.heap.push(this.simTimeMs + latency, { kind: "edgeArrive", edgeId: edge.id, forward, packet });
  }

  private spawnParticle(
    edge: SimEdgeDesc,
    forward: boolean,
    colorId: ParticleColorId,
    outcome: 0 | 1,
    fraction: number,
  ): void {
    const full = Math.min(MAX_VISUAL_MS, Math.max(MIN_VISUAL_MS, edge.latencyMs * this.timeDilation));
    this.pendingSpawns.push({ edgeId: edge.id, forward, colorId, durationMsWall: full * fraction, outcome });
  }

  private burstAtNode(nodeId: string, viaEdge?: SimEdgeDesc): void {
    const edge = viaEdge ?? this.adjacency.get(nodeId)?.[0];
    const pt = edge ? cubicBezierPoint(edge.geom, edge.sourceId === nodeId ? 0 : 1) : { x: 0, y: 0 };
    this.pendingBursts.push(pt);
  }

  private onEdgeArrive(edgeId: string, forward: boolean, packet: Packet): void {
    const edge = this.edges.get(edgeId);
    if (!edge) return;
    const arrivingNodeId = forward ? edge.targetId : edge.sourceId;
    this.onArriveAtNode(arrivingNodeId, edge, packet);
  }

  private onArriveAtNode(nodeId: string, viaEdge: SimEdgeDesc, packet: Packet): void {
    const n = this.nodes.get(nodeId);
    if (!n) return;

    if (packet.kind === "resp" || packet.kind === "err" || packet.kind === "replicationAck") {
      this.continueBackward(nodeId, packet);
      return;
    }

    if (n.desc.fault.killed) {
      this.burstAtNode(nodeId, viaEdge);
      return;
    }

    n.lastArrivalAtSim = this.simTimeMs;

    if (packet.kind === "replication") {
      this.enqueue(n, packet);
      return;
    }

    if (n.desc.kind === "router") {
      this.routeAtRouter(n, packet);
      return;
    }

    this.enqueue(n, packet);
  }

  private routeAtRouter(n: NodeState, packet: Packet): void {
    const bar = this.keyspaceBars.find((b) => b.linkedRouterId === n.desc.id);
    const owner = bar?.ranges.find((r) => packet.key >= r.start && packet.key < r.end)?.ownerNodeId ?? null;
    if (bar) this.pendingKeyDots.push({ barId: bar.id, frac: packet.key / KEYSPACE_MAX });
    if (!owner) {
      this.burstAtNode(n.desc.id);
      return;
    }
    const edge = this.findEdgeBetween(n.desc.id, owner);
    if (!edge) {
      this.burstAtNode(n.desc.id);
      return;
    }
    this.sendForward(edge, n.desc.id, packet);
  }

  private findEdgeBetween(a: string, b: string): SimEdgeDesc | null {
    const list = this.adjacency.get(a);
    if (!list) return null;
    for (const e of list) {
      if ((e.sourceId === a && e.targetId === b) || (e.sourceId === b && e.targetId === a)) return e;
    }
    return null;
  }

  private enqueue(n: NodeState, packet: Packet): void {
    if (n.queue.length >= n.desc.service.queueCapacity) {
      n.lastDropAtSim = this.simTimeMs;
      this.burstAtNode(n.desc.id);
      if (packet.kind === "req") {
        this.continueBackward(n.desc.id, { ...packet, kind: "err" });
      }
      return;
    }
    n.queue.push({ packet, enqueuedAtSim: this.simTimeMs });
    this.tryStartService(n);
  }

  private tryStartService(n: NodeState): void {
    while (n.busy < n.desc.service.workers && n.queue.length > 0) {
      const task = n.queue.shift()!;
      n.busy++;
      const base = n.desc.service.serviceTimeMs * n.desc.fault.slowdownMultiplier;
      const dur = lognormal(this.rng, base, n.desc.service.serviceTimeSigma) + n.desc.fault.extraLatencyMs;
      this.heap.push(this.simTimeMs + dur, { kind: "serviceComplete", nodeId: n.desc.id, task });
    }
  }

  private onServiceComplete(nodeId: string, task: Task): void {
    const n = this.nodes.get(nodeId);
    if (!n) return;
    n.busy = Math.max(0, n.busy - 1);
    n.completions.push({ t: this.simTimeMs, latencyMs: this.simTimeMs - task.enqueuedAtSim, error: false });
    this.pruneCompletions(n.completions);

    const packet = task.packet;

    if (packet.kind === "replication") {
      this.continueBackward(nodeId, { ...packet, kind: "replicationAck" });
      this.tryStartService(n);
      return;
    }

    const groupId = this.memberToGroup.get(nodeId);
    const group = groupId ? this.replicaGroups.get(groupId) : undefined;
    const isLeader = !!group && group.leaderId === nodeId;

    if (isLeader && packet.isWrite && packet.kind === "req") {
      this.startReplication(group!, nodeId, packet);
    } else {
      this.continueBackward(nodeId, { ...packet, kind: "resp" });
    }
    this.tryStartService(n);
  }

  private startReplication(group: SimReplicaGroupDesc, leaderId: string, origPacket: Packet): void {
    const followers = group.memberIds.filter((m) => m !== leaderId);
    const total = group.memberIds.length;
    const majority = Math.floor(total / 2) + 1;
    const quorum = group.ackQuorum === "majority" ? majority : group.ackQuorum;
    const neededFollowerAcks = Math.max(0, quorum - 1);

    if (neededFollowerAcks <= 0 || followers.length === 0) {
      this.continueBackward(leaderId, { ...origPacket, kind: "resp" });
      return;
    }

    const key = origPacket.requestId * 1000 + origPacket.attempt;
    this.leaderPendingWrites.set(key, { neededFollowerAcks, acksGot: 0, origPacket, leaderId });

    for (const followerId of followers) {
      const edge = this.findEdgeBetween(leaderId, followerId);
      if (!edge) continue;
      const replPacket: Packet = { ...origPacket, kind: "replication", pathEdgeIds: [edge.id], cursor: 0 };
      this.sendForward(edge, leaderId, replPacket);
    }
  }

  /** Walk a response/err/replicationAck packet back along its recorded path, one hop at a time. */
  private continueBackward(fromNodeId: string, packet: Packet): void {
    if (packet.kind === "replicationAck") {
      const key = packet.requestId * 1000 + packet.attempt;
      const pending = this.leaderPendingWrites.get(key);
      if (pending) {
        pending.acksGot++;
        if (pending.acksGot >= pending.neededFollowerAcks) {
          this.leaderPendingWrites.delete(key);
          this.continueBackward(pending.leaderId, { ...pending.origPacket, kind: "resp" });
        }
      }
      return;
    }

    const idx = packet.pathEdgeIds.length - 1 - packet.cursor;
    if (idx < 0) {
      this.deliverToClient(packet);
      return;
    }
    const edgeId = packet.pathEdgeIds[idx]!;
    const edge = this.edges.get(edgeId);
    if (!edge) {
      this.deliverToClient(packet);
      return;
    }
    const nextPacket: Packet = { ...packet, cursor: packet.cursor + 1 };
    const colorId = this.colorFor(packet);
    // Returning along `edge`: if fromNodeId is the edge's target, we travel target->source (forward=false).
    const forward = edge.sourceId === fromNodeId;
    this.travelEdge(edge, forward, nextPacket, colorId);
  }

  private colorFor(packet: Packet): ParticleColorId {
    if (packet.kind === "err") return COLOR.err;
    if (packet.kind === "replication" || packet.kind === "replicationAck") return COLOR.replication;
    if (packet.kind === "resp") return COLOR.resp;
    return packet.attempt > 1 ? COLOR.retry : COLOR.req;
  }

  private deliverToClient(packet: Packet): void {
    this.completeOrFail(packet.clientId, packet.requestId, packet.attempt, packet.kind === "err");
  }

  private completeOrFail(clientId: string, requestId: number, attempt: number, isError: boolean): void {
    const byReq = this.pendingByClient.get(clientId);
    const pending = byReq?.get(requestId);
    if (!pending || pending.attempt !== attempt) return; // superseded by a later attempt/timeout already
    byReq!.delete(requestId);

    const n = this.nodes.get(clientId);
    const completion: Completion = { t: this.simTimeMs, latencyMs: this.simTimeMs - pending.sentAtSim, error: isError };
    if (n) {
      n.completions.push(completion);
      this.pruneCompletions(n.completions);
    }
    this.globalCompletions.push(completion);
    this.pruneCompletions(this.globalCompletions);

    if (isError) this.retryOrDrop(clientId, requestId, attempt);
    else this.retryKeys.delete(requestId);
  }

  private onClientTimeoutCheck(clientId: string, requestId: number, attempt: number): void {
    const byReq = this.pendingByClient.get(clientId);
    const pending = byReq?.get(requestId);
    if (!pending || pending.attempt !== attempt) return; // already completed via response/error
    byReq!.delete(requestId);

    const n = this.nodes.get(clientId);
    const completion: Completion = { t: this.simTimeMs, latencyMs: this.simTimeMs - pending.sentAtSim, error: true };
    if (n) {
      n.completions.push(completion);
      this.pruneCompletions(n.completions);
    }
    this.globalCompletions.push(completion);
    this.pruneCompletions(this.globalCompletions);

    this.retryOrDrop(clientId, requestId, attempt);
  }

  private retryOrDrop(clientId: string, requestId: number, attempt: number): void {
    const n = this.nodes.get(clientId);
    if (!n?.desc.client) return;
    if (attempt > n.desc.client.maxRetries) {
      this.retryKeys.delete(requestId);
      return;
    }
    const saved = this.retryKeys.get(requestId);
    if (!saved) return;
    const backoff = fullJitterBackoff(this.rng, n.desc.client.retryBackoffBaseMs, n.desc.client.retryBackoffFactor, attempt);
    this.heap.push(this.simTimeMs + backoff, {
      kind: "retryFire",
      clientId,
      requestId,
      attempt: attempt + 1,
      key: saved.key,
      isWrite: saved.isWrite,
    });
  }

  private onRetryFire(clientId: string, requestId: number, attempt: number, key: number, isWrite: boolean): void {
    this.startAttempt(clientId, requestId, attempt, key, isWrite);
  }

  private pruneCompletions(list: Completion[]): void {
    const cutoff = this.simTimeMs - METRICS_WINDOW_MS;
    let i = 0;
    while (i < list.length && list[i]!.t < cutoff) i++;
    if (i > 0) list.splice(0, i);
  }

  private metricsFor(completions: Completion[]): { p50: number; p99: number; throughput: number; errorRate: number } {
    if (completions.length === 0) return { p50: 0, p99: 0, throughput: 0, errorRate: 0 };
    const ok = completions
      .filter((c) => !c.error)
      .map((c) => c.latencyMs)
      .sort((a, b) => a - b);
    const errCount = completions.length - ok.length;
    const p50 = ok.length > 0 ? ok[Math.floor(ok.length * 0.5)]! : 0;
    const p99 = ok.length > 0 ? ok[Math.min(ok.length - 1, Math.floor(ok.length * 0.99))]! : 0;
    const windowSec = Math.min(METRICS_WINDOW_MS, Math.max(1, this.simTimeMs)) / 1000;
    const throughput = completions.length / windowSec;
    const errorRate = errCount / completions.length;
    return { p50, p99, throughput, errorRate };
  }

  private healthFor(n: NodeState): NodeMetricsSnapshot["health"] {
    if (n.desc.fault.killed) return "idle";
    const idleCutoff = this.simTimeMs - 1000;
    if (n.lastArrivalAtSim < idleCutoff) return "idle";
    const queueRatio = n.desc.service.queueCapacity > 0 ? n.queue.length / n.desc.service.queueCapacity : 0;
    const utilization = n.desc.service.workers > 0 ? n.busy / n.desc.service.workers : 0;
    const droppedRecently = n.lastDropAtSim >= idleCutoff;
    if (queueRatio > 0.85 || droppedRecently) return "critical";
    if (queueRatio > 0.6 || utilization > 0.85) return "warning";
    return "normal";
  }

  buildNodeMetrics(): Record<string, NodeMetricsSnapshot> {
    const out: Record<string, NodeMetricsSnapshot> = {};
    for (const [id, n] of this.nodes) {
      this.pruneCompletions(n.completions);
      const m = this.metricsFor(n.completions);
      out[id] = {
        ...m,
        queueLen: n.queue.length,
        queueCap: n.desc.service.queueCapacity,
        utilization: n.desc.service.workers > 0 ? n.busy / n.desc.service.workers : 0,
        health: this.healthFor(n),
      };
    }
    return out;
  }

  buildGlobalMetrics(): GlobalMetricsSnapshot {
    this.pruneCompletions(this.globalCompletions);
    return this.metricsFor(this.globalCompletions);
  }

  get simTime(): number {
    return this.simTimeMs;
  }

  /** Consume this tick's burst/key-dot/spawn events, deduping spawns to at most one per edge
   * (section 7: "at most 1 particle per edge per 16ms frame"). `edgeOrder` maps edge id -> index
   * for the encoded spawn buffer. */
  drainForSnapshot(edgeOrder: Map<string, number>): {
    bursts: BurstEvent[];
    keyRouteDots: KeyRouteDotEvent[];
    spawns: PendingSpawn[];
    edgeIndexOf: (edgeId: string) => number;
  } {
    const bursts = this.pendingBursts;
    const keyRouteDots = this.pendingKeyDots;
    const seen = new Set<string>();
    const spawns: PendingSpawn[] = [];
    for (const s of this.pendingSpawns) {
      if (seen.has(s.edgeId)) continue;
      seen.add(s.edgeId);
      spawns.push(s);
    }
    this.pendingBursts = [];
    this.pendingKeyDots = [];
    this.pendingSpawns = [];
    return { bursts, keyRouteDots, spawns, edgeIndexOf: (id) => edgeOrder.get(id) ?? -1 };
  }
}
