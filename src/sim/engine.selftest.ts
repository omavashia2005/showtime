/**
 * Runnable self-check for SimEngine (ponytail: non-trivial sim logic needs one smoke test).
 * Run with `npm run selftest`. No framework — plain asserts against a Client -> Router -> 3
 * Shards scene, which is the scene the acceptance checklist (spec 15) exercises by hand.
 */
import assert from "node:assert";
import { computeEdgeGeometry } from "../render/edgeGeometry";
import { SimEngine } from "./engine";
import type { SetScenePayload, SimEdgeDesc, SimNodeDesc } from "./protocol";
import { defaultClientParams, defaultServiceParams, defaultFaultState, KEYSPACE_MAX } from "../types/scene";

function box(x: number, y: number) {
  return { pos: { x, y }, size: { x: 168, y: 76 } };
}

function makeScene(overrides: { shardQueueCap?: number; globalRps?: number } = {}): SetScenePayload {
  const client: SimNodeDesc = {
    id: "client",
    kind: "client",
    service: defaultServiceParams,
    client: { ...defaultClientParams },
    fault: { ...defaultFaultState },
    replicaGroupId: null,
  };
  const router: SimNodeDesc = {
    id: "router",
    kind: "router",
    service: defaultServiceParams,
    client: null,
    fault: { ...defaultFaultState },
    replicaGroupId: null,
  };
  const shards: SimNodeDesc[] = [0, 1, 2].map((i) => ({
    id: `shard${i}`,
    kind: "shard",
    service: { ...defaultServiceParams, queueCapacity: overrides.shardQueueCap ?? defaultServiceParams.queueCapacity },
    client: null,
    fault: { ...defaultFaultState },
    replicaGroupId: null,
  }));

  const clientBox = box(0, 0);
  const routerBox = box(300, 0);
  const shardBoxes = shards.map((_, i) => box(600, i * 150));

  const edges: SimEdgeDesc[] = [
    {
      id: "e_client_router",
      sourceId: "client",
      targetId: "router",
      latencyMs: 2,
      jitterMs: 0.5,
      lossPct: 0,
      partitioned: false,
      geom: computeEdgeGeometry(clientBox, routerBox),
    },
    ...shards.map((s, i) => ({
      id: `e_router_${s.id}`,
      sourceId: "router",
      targetId: s.id,
      latencyMs: 2,
      jitterMs: 0.5,
      lossPct: 0,
      partitioned: false,
      geom: computeEdgeGeometry(routerBox, shardBoxes[i]!),
    })),
  ];

  const third = KEYSPACE_MAX / 3;
  return {
    nodes: [client, router, ...shards],
    edges,
    replicaGroups: [],
    keyspaceBars: [
      {
        id: "bar1",
        linkedRouterId: "router",
        ranges: shards.map((s, i) => ({ start: Math.floor(i * third), end: Math.floor((i + 1) * third), ownerNodeId: s.id })),
      },
    ],
    globalRps: overrides.globalRps ?? 100,
  };
}

function runFor(engine: SimEngine, totalMs: number, stepMs = 16.667, timeDilation = 20): void {
  let t = 0;
  while (t < totalMs) {
    engine.advance(stepMs, timeDilation);
    t += stepMs;
  }
}

// --- Test 1: healthy load produces completed throughput and no errors ---
{
  const engine = new SimEngine();
  engine.setScene(makeScene({ globalRps: 50 }));
  runFor(engine, 5000);
  const g = engine.buildGlobalMetrics();
  assert.ok(g.throughput > 10, `expected meaningful throughput, got ${g.throughput}`);
  assert.ok(g.errorRate < 0.05, `expected low error rate under light load, got ${g.errorRate}`);
  assert.ok(g.p99 >= g.p50, "p99 should be >= p50");
  console.log("test 1 ok: light load ->", g);
}

// --- Test 2: overload fills queues and produces drops/errors ---
{
  const engine = new SimEngine();
  engine.setScene(makeScene({ globalRps: 5000, shardQueueCap: 8 }));
  runFor(engine, 5000);
  const g = engine.buildGlobalMetrics();
  const nodeMetrics = engine.buildNodeMetrics();
  const anyCritical = Object.values(nodeMetrics).some((m) => m.health === "critical" || m.queueLen > 0);
  assert.ok(g.errorRate > 0, `expected drops under heavy overload, got errorRate=${g.errorRate}`);
  assert.ok(anyCritical, "expected at least one node to show queue pressure under overload");
  console.log("test 2 ok: overload ->", g);
}

// --- Test 3: killed node stops completing its share of traffic ---
{
  const engine = new SimEngine();
  engine.setScene(makeScene({ globalRps: 100 }));
  engine.setFault("shard0", { killed: true });
  runFor(engine, 5000);
  const nodeMetrics = engine.buildNodeMetrics();
  assert.strictEqual(nodeMetrics["shard0"]!.throughput, 0, "killed shard should complete nothing");
  console.log("test 3 ok: killed node metrics ->", nodeMetrics["shard0"]);
}

// --- Test 4: reset clears in-flight state and metrics ---
{
  const engine = new SimEngine();
  engine.setScene(makeScene({ globalRps: 100 }));
  runFor(engine, 3000);
  engine.reset();
  const g = engine.buildGlobalMetrics();
  assert.strictEqual(g.throughput, 0, "metrics should be zeroed right after reset");
  assert.strictEqual(engine.simTime, 0, "sim time should be zeroed after reset");
  console.log("test 4 ok: reset clears state");
}

console.log("All SimEngine self-tests passed.");
