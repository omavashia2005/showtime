import {
  defaultClientParams,
  defaultFaultState,
  defaultServiceParams,
  emptyScene,
  KEYSPACE_MAX,
  type SceneDocument,
} from "../types/scene";
import { makeId } from "../util/id";

/**
 * Temporary seed scene for manual visual verification while the palette/placement tools
 * (section 10.1 / 12) don't exist yet. Called from App.tsx only in dev; remove that call once
 * the palette and persistence autoload can populate the stage on their own.
 */
export function demoScene(): SceneDocument {
  const doc = emptyScene();
  const clientId = makeId("node");
  const routerId = makeId("node");
  const shardIds = [makeId("node"), makeId("node"), makeId("node")];

  doc.nodes.push({
    id: clientId,
    kind: "client",
    name: "Client",
    pos: { x: 120, y: 480 },
    size: { x: 168, y: 76 },
    groupId: null,
    service: defaultServiceParams,
    client: { ...defaultClientParams },
    fault: { ...defaultFaultState },
  });

  doc.nodes.push({
    id: routerId,
    kind: "router",
    name: "Router",
    pos: { x: 420, y: 480 },
    size: { x: 168, y: 76 },
    groupId: null,
    service: defaultServiceParams,
    client: null,
    fault: { ...defaultFaultState },
  });

  shardIds.forEach((id, i) => {
    doc.nodes.push({
      id,
      kind: "shard",
      name: `Shard ${i + 1}`,
      pos: { x: 780, y: 260 + i * 220 },
      size: { x: 168, y: 76 },
      groupId: null,
      service: { ...defaultServiceParams },
      client: null,
      fault: { ...defaultFaultState },
    });
  });

  doc.edges.push({
    id: makeId("edge"),
    sourceId: clientId,
    targetId: routerId,
    latencyMs: 2,
    jitterMs: 0.5,
    lossPct: 0,
    partitioned: false,
  });

  for (const shardId of shardIds) {
    doc.edges.push({
      id: makeId("edge"),
      sourceId: routerId,
      targetId: shardId,
      latencyMs: 2,
      jitterMs: 0.5,
      lossPct: 0,
      partitioned: false,
    });
  }

  const third = Math.floor(KEYSPACE_MAX / 3);
  doc.keyspaceBars.push({
    id: makeId("keyspace"),
    pos: { x: 360, y: 780 },
    width: 1200,
    linkedRouterId: routerId,
    ranges: shardIds.map((ownerNodeId, i) => ({
      id: makeId("range"),
      start: i * third,
      end: i === 2 ? KEYSPACE_MAX : (i + 1) * third,
      ownerNodeId,
    })),
  });

  doc.globalRps = 100;
  doc.title = "Client -> Router -> 3 Shards";
  doc.subtitle = "Demo scene";

  return doc;
}
