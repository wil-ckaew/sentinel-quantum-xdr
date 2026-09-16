"use client";

import { useEffect, useState } from "react";
import {
  Activity, AlertTriangle, Brain, CheckCircle2, Cpu, RefreshCw,
  Radio, Shield, XCircle, Zap,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import {
  fetchDetectionStatus,
  relativeTime,
  DetectionStatus,
  ComponentStatus,
} from "@/lib/api";

export default function DetectionPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<DetectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDetectionStatus();
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <main className={`flex-1 transition-all ${collapsed ? "lg:pl-24" : "lg:pl-72"}`}>
        <div className="border-b border-[#1b3552] bg-[#07101d]/80 px-8 py-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-violet-400">
                <Radio className="h-3 w-3" />
                Pipeline
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-white">Status da Detecção</h1>
              <p className="mt-1 text-sm text-slate-400">
                Health check dos 3 componentes + modelo ML
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-[#1b3552] bg-[#0a1626] px-3 py-2 text-xs text-slate-300 transition hover:border-[#2c83d4] hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          {error && (
            <div className="mb-6 rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertTriangle className="mb-1 inline h-4 w-4" /> {error}
            </div>
          )}

          {status && (
            <>
              {/* Cards de componentes */}
              <div className="grid gap-4 md:grid-cols-3">
                <ComponentCard
                  icon={Shield}
                  title="Gateway"
                  subtitle="api gateway (rust/axum)"
                  status={status.gateway}
                />
                <ComponentCard
                  icon={Cpu}
                  title="Detection Service"
                  subtitle="regras + cliente ML"
                  status={status.detection_service}
                />
                <ComponentCard
                  icon={Brain}
                  title="ML Inference"
                  subtitle="onnx runtime"
                  status={status.ml_inference}
                />
              </div>

              {/* Pipeline summary */}
              <div className="mt-6 border border-[#1b3552] bg-[#0a1626]/60">
                <div className="border-b border-[#1b3552] px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <Zap className="h-4 w-4 text-[#43a8ff]" />
                    <h2 className="text-sm font-semibold text-slate-100">
                      Pipeline Atual
                    </h2>
                  </div>
                </div>
                <div className="p-5">
                  <PipelineFlow mode={status.pipeline.current_mode} />
                </div>
              </div>

              {/* Model info */}
              {status.model && (
                <div className="mt-6 border border-[#1b3552] bg-[#0a1626]/60">
                  <div className="border-b border-[#1b3552] px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <Brain className="h-4 w-4 text-[#43a8ff]" />
                      <h2 className="text-sm font-semibold text-slate-100">Modelo ONNX</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 p-5">
                    <Field label="Nome" value={status.model.name} />
                    <Field
                      label="Carregado"
                      value={status.model.loaded ? "sim" : "não (heurística)"}
                      tone={status.model.loaded ? "emerald" : "amber"}
                    />
                    <Field label="Feature dim" value={String(status.model.feature_dim)} />
                  </div>
                  {!status.model.loaded && (
                    <div className="border-t border-[#1b3552] px-5 py-3 text-xs text-amber-300/80">
                      Sem modelo ONNX — o serviço está usando heurística de entropia.
                      Rode <code className="rounded bg-[#061321] px-1.5 py-0.5 font-mono">make train</code> em
                      ml-inference/ para gerar o modelo.
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 text-center text-[11px] text-slate-500">
                Última verificação: {relativeTime(status.checked_at)}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// Componentes
// =============================================================================

function ComponentCard({
  icon: Icon,
  title,
  subtitle,
  status,
}: {
  icon: typeof Shield;
  title: string;
  subtitle: string;
  status: ComponentStatus;
}) {
  const healthy = status.healthy;
  return (
    <div
      className={`border p-5 ${
        healthy
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-rose-500/40 bg-rose-500/5"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`rounded-lg p-2 ${healthy ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
          <Icon className="h-5 w-5" />
        </div>
        {healthy ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        ) : (
          <XCircle className="h-5 w-5 text-rose-400" />
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-white">{title}</p>
      <p className="text-[11px] text-slate-400">{subtitle}</p>
      {status.latency_ms !== undefined && (
        <p className="mt-2 text-[11px] text-slate-500">
          Latência: {status.latency_ms}ms
        </p>
      )}
      {status.error && (
        <p className="mt-2 truncate text-[10px] text-rose-400" title={status.error}>
          {status.error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber";
}) {
  const color =
    tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-slate-200";
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-1 font-mono text-sm ${color}`}>{value}</p>
    </div>
  );
}

function PipelineFlow({ mode }: { mode: string }) {
  const isRemote = mode === "detection_service";
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <Step label="POST /api/events" tone="sky" />
      <Arrow />
      <Step label="regras locais" tone="emerald" />
      <Arrow />
      <Step
        label="detection-service"
        tone={isRemote ? "emerald" : "slate"}
      />
      <Arrow />
      <Step label="ml-inference" tone={isRemote ? "emerald" : "slate"} />
      <span className="ml-3 rounded bg-[#0a6cff]/10 px-2 py-1 text-[10px] text-[#62b4ff]">
        modo: {mode}
      </span>
    </div>
  );
}

function Step({ label, tone }: { label: string; tone: string }) {
  const colors: Record<string, string> = {
    sky: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    slate: "border-slate-500/40 bg-slate-500/10 text-slate-400",
  };
  return (
    <span className={`rounded border px-3 py-1.5 font-mono ${colors[tone] || colors.slate}`}>
      {label}
    </span>
  );
}

function Arrow() {
  return <span className="text-slate-600">→</span>;
}
