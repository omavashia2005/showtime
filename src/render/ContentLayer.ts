import type { Container } from "pixi.js";
import type { NodeMetricsSnapshot } from "../sim/protocol";
import type { GroupFrame, SceneDocument, SceneNode, StickyNote, TextLabel } from "../types/scene";
import type { SelectableKind, SelectionRef } from "../store/uiStore";
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

/** Reconciles SceneDocument nodes/frames/labels/notes into Pixi views and redraws them every
 * frame so state transitions (rim color, queue bar, critical pulse) stay smooth regardless of
 * how often the underlying data changes. */
export class ContentLayer {
  private nodeEntries = new Map<string, NodeEntry>();
  private frameEntries = new Map<string, GroupFrameView>();
  private labelEntries = new Map<string, TextLabelView>();
  private noteEntries = new Map<string, StickyNoteView>();

  private latestDoc: SceneDocument | null = null;
  private leaderIds = new Set<string>();

  private selection: SelectionRef[] = [];
  private hovered: SelectionRef | null = null;

  getMetrics: MetricsLookup = () => null;

  constructor(
    private nodesLayer: Container,
    private groupFramesLayer: Container,
    private annotationsLayer: Container,
  ) {}

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

    this.leaderIds = new Set();
    for (const f of doc.frames) {
      if (f.kind === "replicaSet" && f.replicaSet?.leaderId) this.leaderIds.add(f.replicaSet.leaderId);
    }

    this.reconcileNodes(doc.nodes);
    this.reconcileFrames(doc.frames);
    this.reconcileLabels(doc.labels);
    this.reconcileNotes(doc.notes);
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
      entry.view.container.position.set(n.pos.x, n.pos.y);
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
  }
}
