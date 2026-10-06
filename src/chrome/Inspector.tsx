import { useSceneStore } from "../store/sceneStore";
import { useUiStore } from "../store/uiStore";
import type { ClientParams, ServiceParams } from "../types/scene";
import { FieldRow, MetricRow, NumberField, SectionTitle, SelectField } from "./fields";
import { panelSurface } from "./panelStyle";
import { useNodeMetrics } from "./useLiveMetrics";

export function Inspector({ visible }: { visible: boolean }) {
  const selection = useUiStore((s) => s.selection);
  const sel = selection[0] ?? null;

  const body = !sel ? null : sel.kind === "node" ? <NodeInspector id={sel.id} /> : sel.kind === "edge" ? (
    <EdgeInspector id={sel.id} />
  ) : sel.kind === "frame" ? (
    <FrameInspector id={sel.id} />
  ) : sel.kind === "keyspaceBar" ? (
    <KeyspaceInspector id={sel.id} />
  ) : null;

  if (!body) return null;

  return (
    <div
      className={`chrome-panel ${visible ? "" : "chrome-hidden-right"}`}
      style={{
        ...panelSurface,
        position: "fixed",
        right: 16,
        top: 16,
        width: 320,
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        padding: 18,
        zIndex: 10,
      }}
    >
      {body}
    </div>
  );
}

function NodeInspector({ id }: { id: string }) {
  const node = useSceneStore((s) => s.doc.nodes.find((n) => n.id === id));
  const update = useSceneStore((s) => s.update);
  const metrics = useNodeMetrics(id);
  if (!node) return null;

  const setService = (patch: Partial<ServiceParams>) =>
    update((d) => {
      const n = d.nodes.find((x) => x.id === id);
      if (n) n.service = { ...n.service, ...patch };
    });

  const setClient = (patch: Partial<ClientParams>) =>
    update((d) => {
      const n = d.nodes.find((x) => x.id === id);
      if (n?.client) n.client = { ...n.client, ...patch };
    });

  return (
    <>
      <SectionTitle>{node.name}</SectionTitle>
      {node.kind === "client" && node.client ? (
        <>
          <FieldRow label="RPS override">
            <NumberField
              value={node.client.rpsOverride ?? 0}
              onChange={(v) => setClient({ rpsOverride: v <= 0 ? null : v })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Read fraction">
            <NumberField value={node.client.readWriteMix} step={0.05} min={0} onChange={(v) => setClient({ readWriteMix: v })} />
          </FieldRow>
          <FieldRow label="Key dist.">
            <SelectField
              value={node.client.keyDistribution}
              options={[
                { value: "uniform", label: "Uniform" },
                { value: "zipf", label: "Zipf" },
              ]}
              onChange={(v) => setClient({ keyDistribution: v })}
            />
          </FieldRow>
          {node.client.keyDistribution === "zipf" && (
            <FieldRow label="Zipf s">
              <NumberField value={node.client.zipfS} step={0.1} onChange={(v) => setClient({ zipfS: v })} />
            </FieldRow>
          )}
          <FieldRow label="Timeout (ms)">
            <NumberField value={node.client.timeoutMs} min={0} onChange={(v) => setClient({ timeoutMs: v })} />
          </FieldRow>
          <FieldRow label="Max retries">
            <NumberField value={node.client.maxRetries} min={0} onChange={(v) => setClient({ maxRetries: v })} />
          </FieldRow>
          <FieldRow label="Backoff base (ms)">
            <NumberField value={node.client.retryBackoffBaseMs} min={0} onChange={(v) => setClient({ retryBackoffBaseMs: v })} />
          </FieldRow>
          <FieldRow label="Backoff factor">
            <NumberField value={node.client.retryBackoffFactor} step={0.1} min={1} onChange={(v) => setClient({ retryBackoffFactor: v })} />
          </FieldRow>
          <SectionTitle>Metrics</SectionTitle>
          <MetricRow label="P50" value={metrics ? metrics.p50.toFixed(1) : "0.0"} unit="ms" />
          <MetricRow label="P99" value={metrics ? metrics.p99.toFixed(1) : "0.0"} unit="ms" />
          <MetricRow label="Throughput" value={metrics ? metrics.throughput.toFixed(1) : "0.0"} unit="req/s" />
          <MetricRow label="Error rate" value={metrics ? (metrics.errorRate * 100).toFixed(1) : "0.0"} unit="%" />
        </>
      ) : (
        <>
          <FieldRow label="Workers">
            <NumberField value={node.service.workers} min={1} onChange={(v) => setService({ workers: v })} />
          </FieldRow>
          <FieldRow label="Service time (ms)">
            <NumberField value={node.service.serviceTimeMs} min={0} onChange={(v) => setService({ serviceTimeMs: v })} />
          </FieldRow>
          <FieldRow label="Sigma">
            <NumberField value={node.service.serviceTimeSigma} step={0.05} min={0} onChange={(v) => setService({ serviceTimeSigma: v })} />
          </FieldRow>
          <FieldRow label="Queue capacity">
            <NumberField value={node.service.queueCapacity} min={0} onChange={(v) => setService({ queueCapacity: v })} />
          </FieldRow>
          <SectionTitle>Metrics</SectionTitle>
          <MetricRow label="P50" value={metrics ? metrics.p50.toFixed(1) : "0.0"} unit="ms" />
          <MetricRow label="P99" value={metrics ? metrics.p99.toFixed(1) : "0.0"} unit="ms" />
          <MetricRow label="Throughput" value={metrics ? metrics.throughput.toFixed(1) : "0.0"} unit="req/s" />
          <MetricRow label="Error rate" value={metrics ? (metrics.errorRate * 100).toFixed(1) : "0.0"} unit="%" />
          <MetricRow label="Queue" value={metrics ? `${metrics.queueLen}/${metrics.queueCap}` : "0/0"} />
          <MetricRow label="Utilization" value={metrics ? (metrics.utilization * 100).toFixed(0) : "0"} unit="%" />
        </>
      )}
    </>
  );
}

function EdgeInspector({ id }: { id: string }) {
  const edge = useSceneStore((s) => s.doc.edges.find((e) => e.id === id));
  const update = useSceneStore((s) => s.update);
  if (!edge) return null;
  const setEdge = (patch: Partial<typeof edge>) =>
    update((d) => {
      const e = d.edges.find((x) => x.id === id);
      if (e) Object.assign(e, patch);
    });

  return (
    <>
      <SectionTitle>Edge</SectionTitle>
      <FieldRow label="Latency (ms)">
        <NumberField value={edge.latencyMs} min={0} onChange={(v) => setEdge({ latencyMs: v })} />
      </FieldRow>
      <FieldRow label="Jitter (ms)">
        <NumberField value={edge.jitterMs} min={0} onChange={(v) => setEdge({ jitterMs: v })} />
      </FieldRow>
      <FieldRow label="Packet loss (%)">
        <NumberField value={edge.lossPct} min={0} onChange={(v) => setEdge({ lossPct: v })} />
      </FieldRow>
    </>
  );
}

function FrameInspector({ id }: { id: string }) {
  const frame = useSceneStore((s) => s.doc.frames.find((f) => f.id === id));
  const update = useSceneStore((s) => s.update);
  if (!frame) return null;

  if (frame.kind !== "replicaSet" || !frame.replicaSet) {
    return <SectionTitle>{frame.name}</SectionTitle>;
  }

  const setReplica = (patch: Partial<NonNullable<typeof frame.replicaSet>>) =>
    update((d) => {
      const f = d.frames.find((x) => x.id === id);
      if (f?.replicaSet) f.replicaSet = { ...f.replicaSet, ...patch };
    });

  return (
    <>
      <SectionTitle>{frame.name}</SectionTitle>
      <FieldRow label="Leader">
        <SelectField
          value={frame.replicaSet.leaderId ?? ""}
          options={frame.memberIds.map((m) => ({ value: m, label: m }))}
          onChange={(v) => setReplica({ leaderId: v })}
        />
      </FieldRow>
      <FieldRow label="Ack quorum">
        <SelectField
          value={frame.replicaSet.ackQuorum === "majority" ? "majority" : "custom"}
          options={[
            { value: "majority", label: "Majority" },
            { value: "custom", label: "Custom" },
          ]}
          onChange={(v) => setReplica({ ackQuorum: v === "majority" ? "majority" : frame.memberIds.length })}
        />
      </FieldRow>
      {frame.replicaSet.ackQuorum !== "majority" && (
        <FieldRow label="Quorum size">
          <NumberField
            value={frame.replicaSet.ackQuorum}
            min={1}
            max={frame.memberIds.length}
            onChange={(v) => setReplica({ ackQuorum: v })}
          />
        </FieldRow>
      )}
    </>
  );
}

function KeyspaceInspector({ id }: { id: string }) {
  const bar = useSceneStore((s) => s.doc.keyspaceBars.find((b) => b.id === id));
  const nodes = useSceneStore((s) => s.doc.nodes);
  const update = useSceneStore((s) => s.update);
  if (!bar) return null;

  const setOwner = (rangeId: string, ownerNodeId: string) =>
    update((d) => {
      const b = d.keyspaceBars.find((x) => x.id === id);
      const r = b?.ranges.find((x) => x.id === rangeId);
      if (r) r.ownerNodeId = ownerNodeId;
    });

  return (
    <>
      <SectionTitle>Keyspace bar</SectionTitle>
      {bar.ranges.map((r) => (
        <FieldRow key={r.id} label={`${((r.start / 2 ** 32) * 100).toFixed(0)}-${((r.end / 2 ** 32) * 100).toFixed(0)}%`}>
          <SelectField
            value={r.ownerNodeId}
            options={nodes.map((n) => ({ value: n.id, label: n.name }))}
            onChange={(v) => setOwner(r.id, v)}
          />
        </FieldRow>
      ))}
    </>
  );
}
