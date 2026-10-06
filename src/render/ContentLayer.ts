import type { Container } from "pixi.js";
import type { NodeMetricsSnapshot } from "../sim/protocol";
import type { GroupFrame, KeyspaceBar, SceneDocument, SceneEdge, SceneNode, StickyNote, TextLabel } from "../types/scene";
import type { SelectableKind, SelectionRef } from "../store/uiStore";
import { computeEdgeGeometry, type NodeBox } from "./edgeGeometry";
import { EdgeView } from "./EdgeView";
import { KeyspaceBarView } from "./KeyspaceBarView";
import { CircleNodeView } from "./nodes/CircleNodeView";
import { GroupFrameView } from "./nodes/GroupFrameView";
import { RectNodeView } from "./nodes/RectNodeView";
import { StickyNoteView } from "./nodes/StickyNoteView";
import { TextLabelView } from "./nodes/TextLabelView";

export type MetricsLookup = (nodeId: string) => NodeMetricsSnapshot | null;

interface NodeEntry {
  view: RectNodeView | CircleNodeView;
  isCircle: boolean;
}

const ACTIVE_WINDOW_MS = 500;

/** Reconciles SceneDocument nodes/frames/labels/notes into Pixi views and redraws them every
 * frame so state transitions (rim color, queue bar, critical pulse) stay smooth regardless of
 * how often the underlying data changes. */
export class ContentLayer {
  private nodeEntries = new Map<string, NodeEntry>();
  private frameEntries = new Map<string, GroupFrameView>();
  private labelEntries = new Map<string, TextLabelView>();
  private noteEntries = new Map<string, StickyNoteView>();
  private edgeEntries = new Map<string, EdgeView>();
  private keyspaceEntries = new Map<string, KeyspaceBarView>();

  private latestDoc: SceneDocument | null = null;
  private leaderIds = new Set<string>();
  private lastEdgeActiveAt = new Map<string, number>();
  private hoveredRangeId: string | null = null;

  private selection: SelectionRef[] = [];
  private hovered: SelectionRef | null = null;

  getMetrics: MetricsLookup = () => null;

  constructor(
    private nodesLayer: Container,
    private groupFramesLayer: Container,
    private annotationsLayer: Container,
    private edgesLayer: Container,
    private keyspaceLayer: Container,
  ) {}

  markEdgeActive(edgeId: string, nowMs: number): void {
    this.lastEdgeActiveAt.set(edgeId, nowMs);
  }

  setHoveredKeyRange(rangeId: string | null): void {
    this.hoveredRangeId = rangeId;
  }

  spawnKeyRouteDot(barId: string, frac: number, nowMs: number): void {
    this.keyspaceEntries.get(barId)?.addKeyDot(frac, nowMs);
  }

  private nodesById = new Map<string, SceneNode>();
  private edgeGeomCache = new Map<string, ReturnType<typeof computeEdgeGeometry>>();

  getEdgeGeom(edgeId: string): ReturnType<typeof computeEdgeGeometry> | undefined {
    return this.edgeGeomCache.get(edgeId);
  }

  getEdgeLatencyMs(edgeId: string): number | undefined {
    return this.latestDoc?.edges.find((e) => e.id === edgeId)?.latencyMs;
  }

  private nodeBox(id: string): NodeBox | undefined {
    const n = this.nodesById.get(id);
    return n ? { pos: n.pos, size: n.size } : undefined;
  }

  private nodeName(id: string): string {
    return this.nodesById.get(id)?.name ?? "";
  }

  setSelection(selection: SelectionRef[], hovered: SelectionRef | null): void {
    this.selection = selection;
    this.hovered = hovered;
  }

  private isSelected(kind: SelectableKind, id: string): boolean {
    return this.selection.some((r) => r.kind === kind && r.id === id);
  }

  private isHovered(kind: SelectableKind, id: string): boolean {
    return this.hovered?.kind === kind && this.hovered.id === id;
  }

  setDoc(doc: SceneDocument): void {
    this.latestDoc = doc;
    this.nodesById = new Map(doc.nodes.map((n) => [n.id, n]));

    this.leaderIds = new Set();
    for (const f of doc.frames) {
      if (f.kind === "replicaSet" && f.replicaSet?.leaderId) this.leaderIds.add(f.replicaSet.leaderId);
    }

    this.reconcileNodes(doc.nodes);
    this.reconcileFrames(doc.frames);
    this.reconcileLabels(doc.labels);
    this.reconcileNotes(doc.notes);
    this.reconcileEdges(doc.edges);
    this.reconcileKeyspaceBars(doc.keyspaceBars);
  }

  private reconcileNodes(nodes: SceneNode[]): void {
    const seen = new Set<string>();
    for (const n of nodes) {
      seen.add(n.id);
      const isCircle = n.kind === "circle";
      let entry = this.nodeEntries.get(n.id);
      if (!entry || entry.isCircle !== isCircle) {
        entry?.view.container.destroy();
        const view = isCircle ? new CircleNodeView() : new RectNodeView();
        entry = { view, isCircle };
        this.nodeEntries.set(n.id, entry);
        this.nodesLayer.addChild(view.container);
      }
      entry.view.container.position.set(n.pos.x + n.size.x / 2, n.pos.y + n.size.y / 2);
    }
    for (const [id, entry] of this.nodeEntries) {
      if (!seen.has(id)) {
        entry.view.container.destroy();
        this.nodeEntries.delete(id);
      }
    }
  }

  private reconcileFrames(frames: GroupFrame[]): void {
    const seen = new Set<string>();
    for (const f of frames) {
      seen.add(f.id);
      let view = this.frameEntries.get(f.id);
      if (!view) {
        view = new GroupFrameView();
        this.frameEntries.set(f.id, view);
        this.groupFramesLayer.addChild(view.container);
      }
      view.container.position.set(f.pos.x, f.pos.y);
      view.update({ name: f.name, width: f.size.x, height: f.size.y });
    }
    for (const [id, view] of this.frameEntries) {
      if (!seen.has(id)) {
        view.container.destroy();
        this.frameEntries.delete(id);
      }
    }
  }

  private reconcileLabels(labels: TextLabel[]): void {
    const seen = new Set<string>();
    for (const l of labels) {
      seen.add(l.id);
      let view = this.labelEntries.get(l.id);
      if (!view) {
        view = new TextLabelView();
        this.labelEntries.set(l.id, view);
        this.annotationsLayer.addChild(view.container);
      }
      view.container.position.set(l.pos.x, l.pos.y);
      view.update(l.text);
    }
    for (const [id, view] of this.labelEntries) {
      if (!seen.has(id)) {
        view.container.destroy();
        this.labelEntries.delete(id);
      }
    }
  }

  private reconcileNotes(notes: StickyNote[]): void {
    const seen = new Set<string>();
    for (const note of notes) {
      seen.add(note.id);
      let view = this.noteEntries.get(note.id);
      if (!view) {
        view = new StickyNoteView();
        this.noteEntries.set(note.id, view);
        this.annotationsLayer.addChild(view.container);
      }
      view.container.position.set(note.pos.x, note.pos.y);
      view.update(note.text, note.width);
    }
    for (const [id, view] of this.noteEntries) {
      if (!seen.has(id)) {
        view.container.destroy();
        this.noteEntries.delete(id);
      }
    }
  }

  private reconcileEdges(edges: SceneEdge[]): void {
    const seen = new Set<string>();
    for (const e of edges) {
      seen.add(e.id);
      let view = this.edgeEntries.get(e.id);
      if (!view) {
        view = new EdgeView();
        this.edgeEntries.set(e.id, view);
        this.edgesLayer.addChild(view.container);
      }
    }
    for (const [id, view] of this.edgeEntries) {
      if (!seen.has(id)) {
        view.container.destroy();
        this.edgeEntries.delete(id);
        this.lastEdgeActiveAt.delete(id);
      }
    }
  }

  private reconcileKeyspaceBars(bars: KeyspaceBar[]): void {
    const seen = new Set<string>();
    for (const bar of bars) {
      seen.add(bar.id);
      let view = this.keyspaceEntries.get(bar.id);
      if (!view) {
        view = new KeyspaceBarView();
        this.keyspaceEntries.set(bar.id, view);
        this.keyspaceLayer.addChild(view.container);
      }
      view.container.position.set(bar.pos.x, bar.pos.y);
      view.update(bar.ranges, (id) => this.nodeName(id), bar.width, this.hoveredRangeId);
    }
    for (const [id, view] of this.keyspaceEntries) {
      if (!seen.has(id)) {
        view.container.destroy();
        this.keyspaceEntries.delete(id);
      }
    }
  }

  tick(dtMs: number, nowMs: number): void {
    const doc = this.latestDoc;
    if (!doc) return;
    for (const n of doc.nodes) {
      const entry = this.nodeEntries.get(n.id);
      if (!entry) continue;
      const metrics = this.getMetrics(n.id);
      const hovered = this.isHovered("node", n.id);
      const selected = this.isSelected("node", n.id);
      if (entry.isCircle) {
        (entry.view as CircleNodeView).update(
          { name: n.name, fault: n.fault, metrics, hovered, selected },
          dtMs,
          nowMs,
        );
      } else {
        (entry.view as RectNodeView).update(
          {
            name: n.name,
            kind: n.kind,
            width: n.size.x,
            height: n.size.y,
            fault: n.fault,
            metrics,
            hovered,
            selected,
            isLeader: this.leaderIds.has(n.id),
          },
          dtMs,
          nowMs,
        );
      }
    }

    for (const e of doc.edges) {
      const view = this.edgeEntries.get(e.id);
      const sourceBox = this.nodeBox(e.sourceId);
      const targetBox = this.nodeBox(e.targetId);
      if (!view || !sourceBox || !targetBox) continue;
      const geom = computeEdgeGeometry(sourceBox, targetBox);
      this.edgeGeomCache.set(e.id, geom);
      const lastActive = this.lastEdgeActiveAt.get(e.id) ?? -Infinity;
      view.update(
        {
          geom,
          partitioned: e.partitioned,
          selected: this.isSelected("edge", e.id),
          active: nowMs - lastActive < ACTIVE_WINDOW_MS,
        },
        dtMs,
      );
    }

    for (const bar of doc.keyspaceBars) {
      this.keyspaceEntries.get(bar.id)?.tick(nowMs);
    }
  }
}
