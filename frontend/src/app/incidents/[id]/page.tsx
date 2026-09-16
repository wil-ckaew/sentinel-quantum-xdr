"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Brain, CheckCircle2, Clock, FileText,
  Info, Lock, RefreshCw, Shield, ShieldAlert, Terminal, Unlock, Zap,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { VerdictBadge } from "@/components/VerdictBadge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { MitreTag } from "@/components/MitreTag";
import {
  fetchIncidentDetail,
  relativeTime,
  IncidentDetail,
} from "@/lib/api";

const ACTION_ICONS: Record<string, typeof Lock> = {
  SOAR_ISOLATE_HOST: Lock,
  SOAR_CREATE_CASE: FileText,
  SOAR_DISABLE_ACCOUNT: ShieldAlert,
  SOAR_UNISOLATE_HOST: Unlock,
};

export default function IncidentDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIncidentDetail(id);
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <main className={`flex-1 transition-all ${collapsed ? "lg:pl-24" : "lg:pl-72"}`}>
        {/* Header */}
        <div className="border-b border-[#1b3552] bg-[#07101d]/80 px-8 py-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/incidents")}
                className="flex items-center gap-1 rounded-lg border border-[#1b3552] bg-[#0a1626] px-3 py-2 text-xs text-slate-300 transition hover:border-[#2c83d4] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </button>
              <div>
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-rose-400">
                  <ShieldAlert className="h-3 w-3" />
                  Incidente
                </div>
                <h1 className="mt-1 text-xl font-semibold text-white">
                  {detail?.incident.title || "Carregando..."}
                </h1>
              </div>
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
            <div className="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertTriangle className="mb-1 inline h-4 w-4" /> {error}
            </div>
          )}

          {loading && !detail && (
            <div className="py-20 text-center text-slate-500">Carregando...</div>
          )}

          {detail && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Coluna esquerda: resumo */}
              <div className="lg:col-span-2 space-y-6">
                {/* Resumo */}
                <div className="border border-[#1b3552] bg-[#0a1626]/60">
                  <div className="border-b border-[#1b3552] px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <Info className="h-4 w-4 text-[#43a8ff]" />
                      <h2 className="text-sm font-semibold text-slate-100">Resumo</h2>
                    </div>
                  </div>
                  <div className="grid gap-4 p-5 md:grid-cols-2">
                    <Field label="ID" value={detail.incident.id} mono />
                    <Field label="Status" value={detail.incident.status} />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Severidade
                      </p>
                      <div className="mt-1.5">
                        <SeverityBadge severity={detail.incident.severity} />
                      </div>
                    </div>
                    <Field label="Categoria" value={detail.incident.category || "—"} />
                    <Field label="Fonte" value={detail.incident.source || "—"} mono />
                    <Field
                      label="Detectado em"
                      value={new Date(detail.incident.detected_at).toLocaleString("pt-BR")}
                    />
                    {detail.incident.metadata?.hostname && (
                      <Field
                        label="Hostname"
                        value={detail.incident.metadata.hostname}
                        mono
                      />
                    )}
                    {detail.incident.metadata?.correlation_count !== undefined && (
                      <Field
                        label="Correlação"
                        value={`${detail.incident.metadata.correlation_count} evento(s)`}
                      />
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="border border-[#1b3552] bg-[#0a1626]/60">
                  <div className="border-b border-[#1b3552] px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-4 w-4 text-[#43a8ff]" />
                      <h2 className="text-sm font-semibold text-slate-100">Timeline</h2>
                    </div>
                  </div>
                  <div className="p-5">
                    <Timeline detail={detail} />
                  </div>
                </div>

                {/* Eventos */}
                {detail.events.length > 0 && (
                  <div className="border border-[#1b3552] bg-[#0a1626]/60">
                    <div className="border-b border-[#1b3552] px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <Shield className="h-4 w-4 text-[#43a8ff]" />
                        <h2 className="text-sm font-semibold text-slate-100">
                          Eventos Relacionados
                        </h2>
                        <span className="ml-auto rounded bg-[#0a6cff]/10 px-2 py-0.5 text-[10px] text-[#62b4ff]">
                          {detail.events.length}
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-[#1b3552]/50">
                      {detail.events.map((ev) => (
                        <div key={ev.id} className="flex items-center gap-4 px-5 py-3">
                          <SeverityBadge severity={ev.severity} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-200">
                                {ev.event_type}
                              </span>
                              {ev.hostname && (
                                <span className="font-mono text-[11px] text-slate-500">
                                  @ {ev.hostname}
                                </span>
                              )}
                            </div>
                            {ev.message && (
                              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                {ev.message}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {relativeTime(ev.created_at)}
                          </span>
                          {ev.processed && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Coluna direita: MITRE + SOAR */}
              <div className="space-y-6">
                {/* MITRE */}
                {detail.incident.metadata?.mitre && (
                  <div className="border border-[#1b3552] bg-[#0a1626]/60">
                    <div className="border-b border-[#1b3552] px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <Brain className="h-4 w-4 text-[#43a8ff]" />
                        <h2 className="text-sm font-semibold text-slate-100">MITRE ATT&CK</h2>
                      </div>
                    </div>
                    <div className="space-y-4 p-5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Técnica
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <MitreTag
                            techniqueId={detail.incident.metadata.mitre.technique_id}
                            tactic={detail.incident.metadata.mitre.tactic}
                          />
                          <span className="text-xs text-slate-300">
                            {detail.incident.metadata.mitre.technique}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Tática
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          {detail.incident.metadata.mitre.tactic}
                        </p>
                      </div>
                      {detail.incident.metadata.mitre.confidence !== undefined && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Confiança
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1b3552]">
                              <div
                                className={`h-full ${
                                  detail.incident.metadata.mitre.confidence >= 90
                                    ? "bg-rose-500"
                                    : detail.incident.metadata.mitre.confidence >= 70
                                    ? "bg-amber-500"
                                    : "bg-sky-500"
                                }`}
                                style={{
                                  width: `${detail.incident.metadata.mitre.confidence}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-400">
                              {detail.incident.metadata.mitre.confidence}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Ação SOAR */}
                {detail.incident.metadata?.playbook && (
                  <div className="border border-[#1b3552] bg-[#0a1626]/60">
                    <div className="border-b border-[#1b3552] px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <Zap className="h-4 w-4 text-[#43a8ff]" />
                        <h2 className="text-sm font-semibold text-slate-100">Ação SOAR</h2>
                      </div>
                    </div>
                    <div className="p-5">
                      <span className="inline-block rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-sm text-emerald-300">
                        {detail.incident.metadata.playbook}
                      </span>
                      {detail.incident.metadata.detection?.source && (
                        <p className="mt-3 text-xs text-slate-400">
                          Detectado via{" "}
                          <span className="font-mono text-slate-300">
                            {detail.incident.metadata.detection.source}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Audit logs do SOAR */}
                {detail.audit_logs.length > 0 && (
                  <div className="border border-[#1b3552] bg-[#0a1626]/60">
                    <div className="border-b border-[#1b3552] px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <Terminal className="h-4 w-4 text-[#43a8ff]" />
                        <h2 className="text-sm font-semibold text-slate-100">Audit Trail</h2>
                      </div>
                    </div>
                    <div className="divide-y divide-[#1b3552]/50">
                      {detail.audit_logs.map((log) => {
                        const Icon = ACTION_ICONS[log.action] || Terminal;
                        return (
                          <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                            <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs text-slate-200">
                                {log.action}
                              </p>
                              {log.resource && (
                                <p className="text-[10px] text-slate-500">
                                  {log.resource}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {relativeTime(log.created_at)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// Componentes
// =============================================================================

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-sm text-slate-200 ${mono ? "font-mono break-all" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Timeline({ detail }: { detail: IncidentDetail }) {
  const firstEvent = detail.events[0];
  const mitre = detail.incident.metadata?.mitre;
  const detection = detail.incident.metadata?.detection;

  const steps = [
    {
      icon: Shield,
      title: "Evento recebido",
      detail: firstEvent ? `${firstEvent.event_type} (${firstEvent.severity})` : "—",
      timestamp: detail.incident.detected_at,
      tone: "sky",
    },
    {
      icon: Brain,
      title: "Detecção executada",
      detail: detection
        ? `via ${detection.source}, score ${detection.score?.toFixed(2)}`
        : "—",
      timestamp: detail.incident.detected_at,
      tone: "violet",
    },
    {
      icon: AlertTriangle,
      title: "MITRE mapeado",
      detail: mitre ? `${mitre.technique_id} · ${mitre.technique}` : "—",
      timestamp: detail.incident.detected_at,
      tone: "amber",
    },
    {
      icon: FileText,
      title: "Incidente criado",
      detail: `${detail.events.length} evento(s) relacionado(s)`,
      timestamp: detail.incident.created_at,
      tone: "rose",
    },
    ...detail.audit_logs.map((log) => ({
      icon: ACTION_ICONS[log.action] || Terminal,
      title: log.action,
      detail: log.resource || "—",
      timestamp: log.created_at,
      tone: "emerald",
    })),
  ];

  const toneClasses: Record<string, string> = {
    sky: "bg-sky-500/10 text-sky-300 ring-sky-500/40",
    violet: "bg-violet-500/10 text-violet-300 ring-violet-500/40",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/40",
    rose: "bg-rose-500/10 text-rose-300 ring-rose-500/40",
    emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/40",
  };

  return (
    <ol className="relative space-y-4">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isLast = idx === steps.length - 1;
        return (
          <li key={idx} className="relative flex gap-4">
            {/* Linha vertical */}
            {!isLast && (
              <div className="absolute left-4 top-8 h-full w-px bg-[#1b3552]" />
            )}
            {/* Ícone */}
            <div
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${toneClasses[step.tone]}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            {/* Conteúdo */}
            <div className="flex-1 pt-1">
              <p className="text-sm font-medium text-slate-100">{step.title}</p>
              <p className="text-xs text-slate-400">{step.detail}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {relativeTime(step.timestamp)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
