import { computeEdgeGeometry } from "../render/edgeGeometry";
import type { SceneDocument } from "../types/scene";
import type { SetScenePayload, SimEdgeDesc, SimNodeDesc, SimReplicaGroupDesc } from "./protocol";

export function buildScenePayload(doc: SceneDocument): SetScenePayload {
  const nodeBoxById = new Map(doc.nodes.map((n) => [n.id, { pos: n.pos, size: n.size }]));
  const groupIdByMember = new Map<string, string>();
  for (const f of doc.frames) {
    if (f.kind !== "replicaSet") continue;
    for (const m of f.memberIds) groupIdByMember.set(m, f.id);
  }

  const nodes: SimNodeDesc[] = doc.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    service: n.service,
    client: n.client,
    fault: n.fault,
    replicaGroupId: groupIdByMember.get(n.id) ?? null,
  }));

  const edges: SimEdgeDesc[] = doc.edges.flatMap((e) => {
    const sourceBox = nodeBoxById.get(e.sourceId);
    const targetBox = nodeBoxById.get(e.targetId);
    if (!sourceBox || !targetBox) return [];
    return [
      {
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        latencyMs: e.latencyMs,
        jitterMs: e.jitterMs,
        lossPct: e.lossPct,
        partitioned: e.partitioned,
        geom: computeEdgeGeometry(sourceBox, targetBox),
      },
    ];
  });

  const replicaGroups: SimReplicaGroupDesc[] = doc.frames
    .filter((f) => f.kind === "replicaSet")
    .map((f) => ({
      id: f.id,
      memberIds: f.memberIds,
      leaderId: f.replicaSet?.leaderId ?? null,
      ackQuorum: f.replicaSet?.ackQuorum ?? "majority",
    }));

  const keyspaceBars = doc.keyspaceBars.map((b) => ({
    id: b.id,
    linkedRouterId: b.linkedRouterId,
    ranges: b.ranges.map((r) => ({ start: r.start, end: r.end, ownerNodeId: r.ownerNodeId })),
  }));

  return { nodes, edges, replicaGroups, keyspaceBars, globalRps: doc.globalRps };
}
