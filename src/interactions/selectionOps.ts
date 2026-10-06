import type { SceneDocument } from "../types/scene";
import type { SelectionRef } from "../store/uiStore";
import { makeId } from "../util/id";

export function deleteSelection(doc: SceneDocument, selection: SelectionRef[]): void {
  const nodeIds = new Set(selection.filter((r) => r.kind === "node").map((r) => r.id));
  const edgeIds = new Set(selection.filter((r) => r.kind === "edge").map((r) => r.id));
  const frameIds = new Set(selection.filter((r) => r.kind === "frame").map((r) => r.id));
  const labelIds = new Set(selection.filter((r) => r.kind === "label").map((r) => r.id));
  const noteIds = new Set(selection.filter((r) => r.kind === "note").map((r) => r.id));
  const barIds = new Set(selection.filter((r) => r.kind === "keyspaceBar").map((r) => r.id));

  doc.nodes = doc.nodes.filter((n) => !nodeIds.has(n.id));
  doc.edges = doc.edges.filter((e) => !edgeIds.has(e.id) && !nodeIds.has(e.sourceId) && !nodeIds.has(e.targetId));
  doc.labels = doc.labels.filter((l) => !labelIds.has(l.id));
  doc.notes = doc.notes.filter((n) => !noteIds.has(n.id));
  doc.keyspaceBars = doc.keyspaceBars.filter((b) => !barIds.has(b.id));
  doc.frames = doc.frames
    .filter((f) => !frameIds.has(f.id))
    .map((f) => ({ ...f, memberIds: f.memberIds.filter((id) => !nodeIds.has(id)) }));
}

const DUPLICATE_OFFSET = 24;

export function duplicateSelection(doc: SceneDocument, selection: SelectionRef[]): SelectionRef[] {
  const created: SelectionRef[] = [];
  const idRemap = new Map<string, string>();

  for (const ref of selection) {
    if (ref.kind === "node") {
      const n = doc.nodes.find((x) => x.id === ref.id);
      if (!n) continue;
      const id = makeId("node");
      idRemap.set(ref.id, id);
      doc.nodes.push({ ...n, id, groupId: null, pos: { x: n.pos.x + DUPLICATE_OFFSET, y: n.pos.y + DUPLICATE_OFFSET } });
      created.push({ kind: "node", id });
    } else if (ref.kind === "label") {
      const l = doc.labels.find((x) => x.id === ref.id);
      if (!l) continue;
      const id = makeId("label");
      doc.labels.push({ ...l, id, pos: { x: l.pos.x + DUPLICATE_OFFSET, y: l.pos.y + DUPLICATE_OFFSET } });
      created.push({ kind: "label", id });
    } else if (ref.kind === "note") {
      const n = doc.notes.find((x) => x.id === ref.id);
      if (!n) continue;
      const id = makeId("note");
      doc.notes.push({ ...n, id, pos: { x: n.pos.x + DUPLICATE_OFFSET, y: n.pos.y + DUPLICATE_OFFSET } });
      created.push({ kind: "note", id });
    } else if (ref.kind === "frame") {
      const f = doc.frames.find((x) => x.id === ref.id);
      if (!f) continue;
      const id = makeId("frame");
      doc.frames.push({
        ...f,
        id,
        memberIds: [],
        pos: { x: f.pos.x + DUPLICATE_OFFSET, y: f.pos.y + DUPLICATE_OFFSET },
      });
      created.push({ kind: "frame", id });
    } else if (ref.kind === "keyspaceBar") {
      const b = doc.keyspaceBars.find((x) => x.id === ref.id);
      if (!b) continue;
      const id = makeId("keyspace");
      doc.keyspaceBars.push({
        ...b,
        id,
        pos: { x: b.pos.x + DUPLICATE_OFFSET, y: b.pos.y + DUPLICATE_OFFSET },
        ranges: b.ranges.map((r) => ({ ...r, id: makeId("range") })),
      });
      created.push({ kind: "keyspaceBar", id });
    }
  }

  return created;
}
