import type { Pt } from "../render/edgeGeometry";
import { layout } from "../tokens";
import {
  defaultClientParams,
  defaultFaultState,
  defaultServiceParams,
  KEYSPACE_MAX,
  type NodeKind,
  type SceneDocument,
  type ToolId,
} from "../types/scene";
import { makeId } from "../util/id";
import type { SelectionRef } from "../store/uiStore";

function clampPos(pos: Pt, size: Pt): Pt {
  return {
    x: Math.max(0, Math.min(layout.stageWidth - size.x, pos.x)),
    y: Math.max(0, Math.min(layout.stageHeight - size.y, pos.y)),
  };
}

function nextName(doc: SceneDocument, kind: NodeKind): string {
  const labels: Record<NodeKind, string> = {
    client: "Client",
    router: "Router",
    shard: "Shard",
    partition: "Partition",
    box: "Service",
    circle: "Node",
  };
  const base = labels[kind];
  const count = doc.nodes.filter((n) => n.kind === kind).length;
  return `${base} ${count + 1}`;
}

function placeNode(doc: SceneDocument, kind: NodeKind, center: Pt): SelectionRef {
  const size = kind === "circle" ? { x: layout.circleDiameter, y: layout.circleDiameter } : { x: layout.nodeWidth, y: layout.nodeHeight };
  const pos = clampPos({ x: center.x - size.x / 2, y: center.y - size.y / 2 }, size);
  const id = makeId("node");
  doc.nodes.push({
    id,
    kind,
    name: nextName(doc, kind),
    pos,
    size,
    groupId: null,
    service: { ...defaultServiceParams },
    client: kind === "client" ? { ...defaultClientParams } : null,
    fault: { ...defaultFaultState },
  });
  return { kind: "node", id };
}

function placeGroupFrame(doc: SceneDocument, isReplicaSet: boolean, center: Pt): SelectionRef {
  const size = isReplicaSet ? { x: 420, y: 300 } : { x: 360, y: 240 };
  const pos = clampPos({ x: center.x - size.x / 2, y: center.y - size.y / 2 }, size);
  const id = makeId("frame");
  const count = doc.frames.filter((f) => f.kind === (isReplicaSet ? "replicaSet" : "generic")).length;
  doc.frames.push({
    id,
    kind: isReplicaSet ? "replicaSet" : "generic",
    name: isReplicaSet ? `Replica set ${count + 1}` : `Group ${count + 1}`,
    pos,
    size,
    memberIds: [],
    replicaSet: isReplicaSet ? { leaderId: null, ackQuorum: "majority" } : null,
  });
  return { kind: "frame", id };
}

function placeKeyspaceBar(doc: SceneDocument, center: Pt): SelectionRef {
  const width = layout.keyspaceBarWidth;
  const pos = clampPos({ x: center.x - width / 2, y: center.y - layout.keyspaceBarHeight / 2 }, { x: width, y: layout.keyspaceBarHeight });
  const id = makeId("keyspace");
  const owner = doc.nodes.find((n) => n.kind === "shard" || n.kind === "partition");
  const router = doc.nodes.find((n) => n.kind === "router");
  doc.keyspaceBars.push({
    id,
    pos,
    width,
    linkedRouterId: router?.id ?? null,
    ranges: owner ? [{ id: makeId("range"), start: 0, end: KEYSPACE_MAX, ownerNodeId: owner.id }] : [],
  });
  return { kind: "keyspaceBar", id };
}

function placeTextLabel(doc: SceneDocument, center: Pt): SelectionRef {
  const id = makeId("label");
  doc.labels.push({ id, text: "Text label", pos: clampPos({ x: center.x - 50, y: center.y - 10 }, { x: 100, y: 20 }) });
  return { kind: "label", id };
}

function placeStickyNote(doc: SceneDocument, center: Pt): SelectionRef {
  const width = layout.stickyNoteWidth;
  const id = makeId("note");
  doc.notes.push({ id, text: "Note", width, pos: clampPos({ x: center.x - width / 2, y: center.y - 30 }, { x: width, y: 60 }) });
  return { kind: "note", id };
}

const NODE_TOOLS: ToolId[] = ["client", "router", "shard", "partition", "box", "circle"];

/** Place the entity for a palette tool at `center` (stage coords). Mutates `doc` in place —
 * call inside sceneStore.update(). Returns the new selection, or null for tools that aren't
 * placement tools (select/connect). */
export function placeEntityForTool(doc: SceneDocument, tool: ToolId, center: Pt): SelectionRef | null {
  if (NODE_TOOLS.includes(tool)) return placeNode(doc, tool as NodeKind, center);
  switch (tool) {
    case "groupFrame":
      return placeGroupFrame(doc, false, center);
    case "replicaSet":
      return placeGroupFrame(doc, true, center);
    case "keyspaceBar":
      return placeKeyspaceBar(doc, center);
    case "text":
      return placeTextLabel(doc, center);
    case "stickyNote":
      return placeStickyNote(doc, center);
    default:
      return null;
  }
}
