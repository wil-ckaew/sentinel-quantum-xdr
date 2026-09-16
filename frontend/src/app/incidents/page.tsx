"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Filter, RefreshCw, Search, ShieldAlert,
  TrendingUp, Activity, Clock,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { VerdictBadge } from "@/components/VerdictBadge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { MitreTag } from "@/components/MitreTag";
import { fetchIncidents, relativeTime, Incident } from "@/lib/api";

type FilterSeverity = "all" | "critical" | "high" | "medium" | "low";

export default function IncidentsPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchIncidents();
      setIncidents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (severityFilter !== "all" && i.severity.toLowerCase() !== severityFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          i.title.toLowerCase().includes(q) ||
          (i.metadata?.hostname?.toLowerCase().includes(q) ?? false) ||
          (i.metadata?.mitre?.technique_id?.toLowerCase().includes(q) ?? false) ||
          i.severity.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [incidents, query, severityFilter]);

  const stats = useMemo(() => {
    const total = incidents.length;
    const critical = incidents.filter((i) => i.severity.toLowerCase() === "critical").length;
    const high = incidents.filter((i) => i.severity.toLowerCase() === "high").length;
    const techniques = new Set(
      incidents.map((i) => i.metadata?.mitre?.technique_id).filter(Boolean)
    );
    return { total, critical, high, techniques: techniques.size };
  }, [incidents]);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <main className={`flex-1 transition-all ${collapsed ? "lg:pl-24" : "lg:pl-72"}`}>
        {/* Header */}
        <div className="border-b border-[#1b3552] bg-[#07101d]/80 px-8 py-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-rose-400">
                <AlertTriangle className="h-3 w-3" />
                Resposta a Incidentes
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-white">Incidentes</h1>
              <p className="mt-1 text-sm text-slate-400">
                Criados automaticamente quando uma detecção cruza o threshold de ataque
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
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total" value={stats.total} tone="sky" icon={Activity} />
            <StatCard label="Críticos" value={stats.critical} tone="rose" icon={ShieldAlert} />
            <StatCard label="Alto" value={stats.high} tone="amber" icon={TrendingUp} />
            <StatCard label="Técnicas MITRE" value={stats.techniques} tone="violet" icon={Clock} />
          </div>

          {/* Filtros */}
          <div className="mt-6 flex flex-col gap-3 border border-[#1b3552] bg-[#0a1626]/60 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filtrar por título, host ou técnica..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-[#1b3552] bg-[#07101d] py-2 pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-[#2c83d4] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              {(["all", "critical", "high", "medium", "low"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                    severityFilter === s
                      ? "bg-[#0a6cff]/20 text-[#62b4ff] ring-1 ring-[#1c8dff]/45"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="mt-4 space-y-2">
            {filtered.length === 0 && (
              <div className="border border-[#1b3552] bg-[#0a1626]/60 py-16 text-center text-slate-500">
                {loading ? "Carregando incidentes..." : "Nenhum incidente encontrado"}
              </div>
            )}
            {filtered.map((incident) => {
              const mitre = incident.metadata?.mitre;
              const detection = incident.metadata?.detection;
              const isOpen = expanded === incident.id;

              return (
                <div
                  key={incident.id}
                  className="border border-[#1b3552] bg-[#0a1626]/60 transition hover:border-[#2c83d4]/40"
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : incident.id)}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left"
                  >
                    {/* Indicador de severidade */}
                    <div className="mt-1">
                      <SeverityBadge severity={incident.severity} />
                    </div>

                    {/* Título + metadata */}
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-100">
                        {incident.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-slate-500">
                          {relativeTime(incident.detected_at)}
                        </span>
                        {incident.metadata?.hostname && (
                          <span className="font-mono text-slate-400">
                            {incident.metadata.hostname}
                          </span>
                        )}
                        {mitre?.technique_id && (
                          <MitreTag techniqueId={mitre.technique_id} tactic={mitre.tactic} />
                        )}
                        {detection?.source && (
                          <span className="text-slate-500">
                            via {detection.source}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Verdict */}
                    <div className="shrink-0">
                      <VerdictBadge verdict="malicious" />
                    </div>
                  </button>

                  {/* Detalhe expansível */}
                  {isOpen && (
                    <div className="border-t border-[#1b3552] px-5 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Tática MITRE */}
                        {mitre?.tactic && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Tática
                            </p>
                            <p className="mt-1 text-sm text-slate-200">{mitre.tactic}</p>
                          </div>
                        )}

                        {/* Confiança */}
                        {mitre?.confidence !== undefined && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Confiança
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[#1b3552]">
                                <div
                                  className={`h-full ${
                                    mitre.confidence >= 90
                                      ? "bg-rose-500"
                                      : mitre.confidence >= 70
                                      ? "bg-amber-500"
                                      : "bg-sky-500"
                                  }`}
                                  style={{ width: `${mitre.confidence}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-400">
                                {mitre.confidence}%
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Ação recomendada */}
                        {incident.metadata?.playbook && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Ação SOAR
                            </p>
                            <span className="mt-1 inline-block rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-300">
                              {incident.metadata.playbook}
                            </span>
                          </div>
                        )}

                        {/* Correlação */}
                        {incident.metadata?.correlation_count !== undefined && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Correlação
                            </p>
                            <p className="mt-1 text-sm text-slate-200">
                              {incident.metadata.correlation_count} evento(s) relacionado(s)
                            </p>
                          </div>
                        )}
                      </div>

                      {/* JSON bruto */}
                      <details className="mt-4 border-t border-[#1b3552] pt-4">
                        <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300">
                          Metadata completa
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded bg-[#061321] p-3 text-[10px] text-slate-400">
                          {JSON.stringify(incident.metadata, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: typeof Activity;
}) {
  const colors = {
    sky: "border-sky-500/30 bg-sky-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
  };
  return (
    <div className={`border p-4 ${colors[tone as keyof typeof colors] || colors.sky}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
