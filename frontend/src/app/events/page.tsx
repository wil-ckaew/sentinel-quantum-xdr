"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, Filter, RefreshCw, Search, ShieldAlert, ShieldCheck, Zap,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { VerdictBadge } from "@/components/VerdictBadge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { MitreTag } from "@/components/MitreTag";
import { fetchEvents, relativeTime, SecurityEvent } from "@/lib/api";

type FilterVerdict = "all" | "malicious" | "suspicious" | "benign";

export default function EventsPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<FilterVerdict>("all");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchEvents(100);
      setEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  function inferVerdict(event: SecurityEvent): "malicious" | "suspicious" | "benign" {
    if (event.attack && (event.confidence ?? 0) >= 75) return "malicious";
    if (event.attack) return "suspicious";
    return "benign";
  }

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const verdict = inferVerdict(e);
      if (verdictFilter !== "all" && verdict !== verdictFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          e.event_type.toLowerCase().includes(q) ||
          (e.hostname?.toLowerCase().includes(q) ?? false) ||
          (e.technique_id?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [events, query, verdictFilter]);

  const stats = useMemo(() => {
    const total = events.length;
    const malicious = events.filter((e) => inferVerdict(e) === "malicious").length;
    const suspicious = events.filter((e) => inferVerdict(e) === "suspicious").length;
    const benign = events.filter((e) => inferVerdict(e) === "benign").length;
    return { total, malicious, suspicious, benign };
  }, [events]);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <main className={`flex-1 transition-all ${collapsed ? "lg:pl-24" : "lg:pl-72"}`}>
        <div className="border-b border-[#1b3552] bg-[#07101d]/80 px-8 py-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-sky-400">
                <Activity className="h-3 w-3" />
                Telemetria
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-white">Eventos</h1>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-[#1b3552] bg-[#0a1626] px-3 py-2 text-xs text-slate-300 transition hover:border-[#2c83d4] hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total" value={stats.total} tone="sky" />
            <StatCard label="Malicious" value={stats.malicious} tone="rose" />
            <StatCard label="Suspicious" value={stats.suspicious} tone="amber" />
            <StatCard label="Benign" value={stats.benign} tone="emerald" />
          </div>

          {/* Filtros */}
          <div className="mt-6 flex flex-col gap-3 border border-[#1b3552] bg-[#0a1626]/60 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filtrar por tipo, host ou técnica..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-[#1b3552] bg-[#07101d] py-2 pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-[#2c83d4] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              {(["all", "malicious", "suspicious", "benign"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVerdictFilter(v)}
                  className={`rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                    verdictFilter === v
                      ? "bg-[#0a6cff]/20 text-[#62b4ff] ring-1 ring-[#1c8dff]/45"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela */}
          <div className="mt-4 overflow-hidden border border-[#1b3552] bg-[#0a1626]/60">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1b3552] bg-[#07101d]/80 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Verdict</th>
                  <th className="px-4 py-3">Técnica</th>
                  <th className="px-4 py-3">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      {loading ? "Carregando..." : "Nenhum evento"}
                    </td>
                  </tr>
                )}
                {filtered.map((e) => {
                  const verdict = inferVerdict(e);
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-[#1b3552]/50 transition hover:bg-[#102238]/50"
                    >
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {relativeTime(e.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-200">{e.event_type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {e.hostname || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={e.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <VerdictBadge verdict={verdict} />
                      </td>
                      <td className="px-4 py-3">
                        <MitreTag techniqueId={e.technique_id} tactic={e.tactic} />
                      </td>
                      <td className="px-4 py-3 text-[10px] text-slate-500">
                        {e.detection_source || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const colors = {
    sky: "border-sky-500/30 bg-sky-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
  };
  return (
    <div className={`border p-4 ${colors[tone as keyof typeof colors] || colors.sky}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
