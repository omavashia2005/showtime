import { Graphics } from "pixi.js";
import type { ContentLayer } from "../render/ContentLayer";
import { distanceToBezier, type Pt } from "../render/edgeGeometry";
import { hitTestEntities, rectsIntersect } from "../render/hitTest";
import type { RippleLayer } from "../render/RippleLayer";
import type { SceneRenderer } from "../render/SceneRenderer";
import { color, hexToNumber, layout } from "../tokens";
import { useSceneStore } from "../store/sceneStore";
import { useUiStore, type SelectionRef } from "../store/uiStore";
import type { SceneDocument } from "../types/scene";
import { makeId } from "../util/id";
import { placeEntityForTool } from "./createEntity";

const EDGE_HIT_PX = 10;
const DRAG_THRESHOLD_PX = 4;
const GRID = layout.gridSnap;

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

interface DragOriginal {
  ref: SelectionRef;
  pos: Pt;
}

/** Owns all pointer/keyboard-free stage interaction: tool placement, select/marquee/drag,
 * connect-drag, hover, and the native contextmenu hook. Hotkeys live in hotkeys.ts. */
export class InteractionController {
  private overlay = new Graphics();
  private dragState: { startStage: Pt; originals: DragOriginal[]; moved: boolean } | null = null;
  private marqueeStart: Pt | null = null;
  private marqueeCurrent: Pt | null = null;

  constructor(
    private renderer: SceneRenderer,
    private content: ContentLayer,
    private ripples: RippleLayer,
  ) {
    renderer.layers.overlay.addChild(this.overlay);
    const canvas = renderer.app.canvas as HTMLCanvasElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("dblclick", this.onDblClick);
    canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  private toStage(clientX: number, clientY: number): Pt {
    const rect = (this.renderer.app.canvas as HTMLCanvasElement).getBoundingClientRect();
    return this.renderer.viewportToStage(clientX, clientY, rect);
  }

  /** Cursor affordance: what will clicking/dragging here do. Recording mode's auto-hide
   * (CursorAutoHide) only touches the cursor while idle, so this doesn't fight it. */
  private setCursor(cursor: string): void {
    (this.renderer.app.canvas as HTMLCanvasElement).style.cursor = cursor;
  }

  private updateIdleCursor(tool: string, hit: SelectionRef | null): void {
    if (tool === "connect" || tool !== "select") {
      this.setCursor("crosshair");
      return;
    }
    if (!hit) {
      this.setCursor("default");
      return;
    }
    this.setCursor(hit.kind === "edge" ? "pointer" : "grab");
  }

  private hitEdge(doc: SceneDocument, p: Pt): SelectionRef | null {
    for (const e of doc.edges) {
      const geom = this.content.getEdgeGeom(e.id);
      if (geom && distanceToBezier(geom, p) <= EDGE_HIT_PX) return { kind: "edge", id: e.id };
    }
    return null;
  }

  private hitAny(doc: SceneDocument, p: Pt): SelectionRef | null {
    return hitTestEntities(doc, p) ?? this.hitEdge(doc, p);
  }

  private onPointerDown = (e: PointerEvent): void => {
    const p = this.toStage(e.clientX, e.clientY);
    this.ripples.trigger(p.x, p.y, performance.now());
    if (e.button !== 0) return;
    const ui = useUiStore.getState();
    const doc = useSceneStore.getState().doc;

    if (ui.tool === "connect") {
      const hit = hitTestEntities(doc, p);
      if (hit?.kind === "node") {
        useUiStore.getState().setConnectDraft({ fromNodeId: hit.id });
        this.setCursor("crosshair");
      }
      return;
    }

    if (ui.tool !== "select") {
      const result: { ref: SelectionRef | null } = { ref: null };
      useSceneStore.getState().update((d) => {
        result.ref = placeEntityForTool(d, ui.tool, p);
      });
      const placed = result.ref;
      if (placed) {
        useUiStore.getState().setSelection([placed]);
        useUiStore.getState().setTool("select");
        if (placed.kind === "label" || placed.kind === "note") useUiStore.getState().setRenaming(placed);
      }
      return;
    }

    const hit = this.hitAny(doc, p);
    if (hit) {
      const already = ui.selection.some((r) => r.kind === hit.kind && r.id === hit.id);
      if (e.shiftKey) {
        if (already) useUiStore.getState().setSelection(ui.selection.filter((r) => !(r.kind === hit.kind && r.id === hit.id)));
        else useUiStore.getState().addToSelection(hit);
      } else if (!already) {
        useUiStore.getState().setSelection([hit]);
      }
      this.beginDrag(p, doc);
      if (this.dragState) this.setCursor("grabbing");
    } else {
      if (!e.shiftKey) useUiStore.getState().clearSelection();
      this.marqueeStart = p;
      this.marqueeCurrent = p;
      this.setCursor("crosshair");
    }
  };

  private beginDrag(startStage: Pt, doc: SceneDocument): void {
    const selection = useUiStore.getState().selection;
    const draggable = selection.filter((r) => r.kind === "node" || r.kind === "frame" || r.kind === "label" || r.kind === "note" || r.kind === "keyspaceBar");
    if (draggable.length === 0) return;

    const originals: DragOriginal[] = [];
    const addNode = (id: string) => {
      const n = doc.nodes.find((x) => x.id === id);
      if (n && !originals.some((o) => o.ref.kind === "node" && o.ref.id === id)) originals.push({ ref: { kind: "node", id }, pos: { ...n.pos } });
    };

    for (const ref of draggable) {
      if (ref.kind === "node") addNode(ref.id);
      else if (ref.kind === "frame") {
        const f = doc.frames.find((x) => x.id === ref.id);
        if (f) {
          originals.push({ ref, pos: { ...f.pos } });
          for (const memberId of f.memberIds) addNode(memberId);
        }
      } else if (ref.kind === "label") {
        const l = doc.labels.find((x) => x.id === ref.id);
        if (l) originals.push({ ref, pos: { ...l.pos } });
      } else if (ref.kind === "note") {
        const n = doc.notes.find((x) => x.id === ref.id);
        if (n) originals.push({ ref, pos: { ...n.pos } });
      } else if (ref.kind === "keyspaceBar") {
        const b = doc.keyspaceBars.find((x) => x.id === ref.id);
        if (b) originals.push({ ref, pos: { ...b.pos } });
      }
    }

    if (originals.length === 0) return;
    useSceneStore.getState().checkpoint();
    this.dragState = { startStage, originals, moved: false };
  }

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.toStage(e.clientX, e.clientY);

    if (this.dragState) {
      const dx = p.x - this.dragState.startStage.x;
      const dy = p.y - this.dragState.startStage.y;
      if (!this.dragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      this.dragState.moved = true;
      useSceneStore.getState().update((d) => this.applyDrag(d, dx, dy), { checkpoint: false });
      return;
    }

    if (this.marqueeStart) {
      this.marqueeCurrent = p;
      this.drawMarquee();
      return;
    }

    const ui = useUiStore.getState();
    const doc = useSceneStore.getState().doc;

    // Hover must stay live even mid-connect-drag: onPointerUp reads `hovered` to know what
    // node is under the cursor at release (there's no pointer position on the up event).
    const hit = this.hitAny(doc, p);
    const cur = ui.hovered;
    const same = cur && hit && cur.kind === hit.kind && cur.id === hit.id;
    const bothNull = !cur && !hit;
    if (!same && !bothNull) useUiStore.getState().setHovered(hit);

    if (ui.connectDraft) {
      this.drawConnectDraft(doc, ui.connectDraft.fromNodeId, p);
      const validTarget = hit?.kind === "node" && hit.id !== ui.connectDraft.fromNodeId;
      this.setCursor(validTarget ? "crosshair" : "not-allowed");
      return;
    }

    this.updateIdleCursor(ui.tool, hit);

    if (hit?.kind === "keyspaceBar") {
      const bar = doc.keyspaceBars.find((b) => b.id === hit.id);
      const range = bar?.ranges.find((r) => p.x - bar.pos.x >= (r.start / 2 ** 32) * bar.width && p.x - bar.pos.x <= (r.end / 2 ** 32) * bar.width);
      this.content.setHoveredKeyRange(range?.id ?? null);
    } else {
      this.content.setHoveredKeyRange(null);
    }
  };

  private applyDrag(d: SceneDocument, dx: number, dy: number): void {
    if (!this.dragState) return;
    for (const o of this.dragState.originals) {
      const rawX = o.pos.x + dx;
      const rawY = o.pos.y + dy;
      if (o.ref.kind === "node") {
        const n = d.nodes.find((x) => x.id === o.ref.id);
        if (n) n.pos = this.clamp(snap(rawX), snap(rawY), n.size);
      } else if (o.ref.kind === "frame") {
        const f = d.frames.find((x) => x.id === o.ref.id);
        if (f) f.pos = this.clamp(snap(rawX), snap(rawY), f.size);
      } else if (o.ref.kind === "label") {
        const l = d.labels.find((x) => x.id === o.ref.id);
        if (l) l.pos = this.clamp(snap(rawX), snap(rawY), { x: 100, y: 20 });
      } else if (o.ref.kind === "note") {
        const n = d.notes.find((x) => x.id === o.ref.id);
        if (n) n.pos = this.clamp(snap(rawX), snap(rawY), { x: n.width, y: 60 });
      } else if (o.ref.kind === "keyspaceBar") {
        const b = d.keyspaceBars.find((x) => x.id === o.ref.id);
        if (b) b.pos = this.clamp(snap(rawX), snap(rawY), { x: b.width, y: layout.keyspaceBarHeight });
      }
    }
  }

  private clamp(x: number, y: number, size: Pt): Pt {
    return {
      x: Math.max(0, Math.min(layout.stageWidth - size.x, x)),
      y: Math.max(0, Math.min(layout.stageHeight - size.y, y)),
    };
  }

  private onPointerUp = (): void => {
    if (this.dragState) {
      if (this.dragState.moved) this.reassignFrameMembership();
      this.dragState = null;
    }

    if (this.marqueeStart && this.marqueeCurrent) {
      this.finishMarquee(this.marqueeStart, this.marqueeCurrent);
    }
    this.marqueeStart = null;
    this.marqueeCurrent = null;
    this.overlay.clear();

    const ui = useUiStore.getState();
    if (ui.connectDraft) {
      const doc = useSceneStore.getState().doc;
      // Reuse last known pointer position via hover test is unavailable here (no event arg),
      // so connect completion is handled by whatever the most recent pointermove hit-tested;
      // re-derive using the current mouse position stored on hovered, if it was a node.
      if (ui.hovered?.kind === "node" && ui.hovered.id !== ui.connectDraft.fromNodeId) {
        useSceneStore.getState().update((d) => {
          d.edges.push({
            id: makeId("edge"),
            sourceId: ui.connectDraft!.fromNodeId,
            targetId: ui.hovered!.id,
            latencyMs: 2,
            jitterMs: 0.5,
            lossPct: 0,
            partitioned: false,
          });
        });
      }
      void doc;
      useUiStore.getState().setConnectDraft(null);
    }
  };

  private reassignFrameMembership(): void {
    if (!this.dragState) return;
    const draggedFrameIds = new Set(this.dragState.originals.filter((o) => o.ref.kind === "frame").map((o) => o.ref.id));
    const directlyDraggedNodeIds = this.dragState.originals.filter((o) => o.ref.kind === "node").map((o) => o.ref.id);
    if (directlyDraggedNodeIds.length === 0 || draggedFrameIds.size > 0) return;

    useSceneStore.getState().update((d) => {
      for (const nodeId of directlyDraggedNodeIds) {
        const n = d.nodes.find((x) => x.id === nodeId);
        if (!n) continue;
        const cx = n.pos.x + n.size.x / 2;
        const cy = n.pos.y + n.size.y / 2;
        const frame = d.frames.find((f) => cx >= f.pos.x && cx <= f.pos.x + f.size.x && cy >= f.pos.y && cy <= f.pos.y + f.size.y);
        for (const f of d.frames) f.memberIds = f.memberIds.filter((id) => id !== nodeId);
        if (frame) {
          frame.memberIds.push(nodeId);
          n.groupId = frame.id;
        } else {
          n.groupId = null;
        }
      }
    });
  }

  private finishMarquee(start: Pt, end: Pt): void {
    const rect = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      w: Math.abs(end.x - start.x),
      h: Math.abs(end.y - start.y),
    };
    if (rect.w < 2 && rect.h < 2) return;
    const doc = useSceneStore.getState().doc;
    const hits: SelectionRef[] = [];
    for (const n of doc.nodes) {
      if (rectsIntersect(rect, { x: n.pos.x, y: n.pos.y, w: n.size.x, h: n.size.y })) hits.push({ kind: "node", id: n.id });
    }
    for (const f of doc.frames) {
      if (rectsIntersect(rect, { x: f.pos.x, y: f.pos.y, w: f.size.x, h: f.size.y })) hits.push({ kind: "frame", id: f.id });
    }
    const ui = useUiStore.getState();
    useUiStore.getState().setSelection(ui.selection.length > 0 ? [...ui.selection, ...hits] : hits);
  }

  private drawMarquee(): void {
    if (!this.marqueeStart || !this.marqueeCurrent) return;
    const x = Math.min(this.marqueeStart.x, this.marqueeCurrent.x);
    const y = Math.min(this.marqueeStart.y, this.marqueeCurrent.y);
    const w = Math.abs(this.marqueeCurrent.x - this.marqueeStart.x);
    const h = Math.abs(this.marqueeCurrent.y - this.marqueeStart.y);
    this.overlay.clear();
    this.overlay.rect(x, y, w, h).fill({ color: hexToNumber(color.primary), alpha: 0.08 });
    this.overlay.rect(x, y, w, h).stroke({ width: 1, color: hexToNumber(color.primary), alpha: 0.6 });
  }

  private drawConnectDraft(doc: SceneDocument, fromNodeId: string, to: Pt): void {
    const from = doc.nodes.find((n) => n.id === fromNodeId);
    if (!from) return;
    const fromCenter = { x: from.pos.x + from.size.x / 2, y: from.pos.y + from.size.y / 2 };
    this.overlay.clear();
    this.overlay.moveTo(fromCenter.x, fromCenter.y).lineTo(to.x, to.y).stroke({ width: 1.25, color: hexToNumber(color.lineDim) });
  }

  private onDblClick = (e: MouseEvent): void => {
    const p = this.toStage(e.clientX, e.clientY);
    const doc = useSceneStore.getState().doc;
    const hit = hitTestEntities(doc, p);
    if (hit && (hit.kind === "node" || hit.kind === "label" || hit.kind === "note" || hit.kind === "frame")) {
      useUiStore.getState().setRenaming(hit);
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    const p = this.toStage(e.clientX, e.clientY);
    const doc = useSceneStore.getState().doc;
    const hit = this.hitAny(doc, p);
    if (hit && (hit.kind === "node" || hit.kind === "edge")) {
      useUiStore.getState().setSelection([hit]);
      useUiStore.getState().setContextMenu({ x: e.clientX, y: e.clientY, target: hit });
    }
  };

  destroy(): void {
    const canvas = this.renderer.app.canvas as HTMLCanvasElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("dblclick", this.onDblClick);
    canvas.removeEventListener("contextmenu", this.onContextMenu);
  }
}
