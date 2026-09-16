"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Filter, RefreshCw, Search, Server,
  ShieldOff, ShieldCheck, Lock, Unlock,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { fetchAssets, updateAssetStatus, relativeTime, Asset } from "@/lib/api";

type FilterStatus = "all" | "active" | "isolated" | "quarantined";

export default function AssetsPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAssets();
      setAssets(data);
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

  async function toggleStatus(asset: Asset) {
    const isIsolated = asset.status?.toLowerCase() === "isolated";
    const newStatus = isIsolated ? "active" : "isolated";
    setBusy((prev) => new Set(prev).add(asset.id));
    try {
      const updated = await updateAssetStatus(asset.id, newStatus);
      setAssets((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  }

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const status = (a.status || "active").toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          a.hostname.toLowerCase().includes(q) ||
          (a.ip_address?.toLowerCase().includes(q) ?? false) ||
          (a.operating_system?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [assets, query, statusFilter]);

  const stats = useMemo(() => {
    const total = assets.length;
    const active = assets.filter((a) => (a.status || "active").toLowerCase() === "active").length;
    const isolated = assets.filter((a) => a.status?.toLowerCase() === "isolated").length;
    const highRisk = assets.filter((a) => (a.risk_score ?? 0) >= 75).length;
    return { total, active, isolated, highRisk };
  }, [assets]);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <main className={`flex-1 transition-all ${collapsed ? "lg:pl-24" : "lg:pl-72"}`}>
        {/* Header */}
        <div className="border-b border-[#1b3552] bg-[#07101d]/80 px-8 py-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-sky-400">
                <Server className="h-3 w-3" />
                Inventário
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-white">Ativos</h1>
              <p className="mt-1 text-sm text-slate-400">
                Hosts monitorados e seu status de contenção
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
            <StatCard label="Total" value={stats.total} tone="sky" icon={Server} />
            <StatCard label="Ativos" value={stats.active} tone="emerald" icon={ShieldCheck} />
            <StatCard label="Isolados" value={stats.isolated} tone="rose" icon={ShieldOff} />
            <StatCard label="Alto Risco" value={stats.highRisk} tone="amber" icon={AlertTriangle} />
          </div>

          {/* Filtros */}
          <div className="mt-6 flex flex-col gap-3 border border-[#1b3552] bg-[#0a1626]/60 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filtrar por hostname, IP ou OS..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-[#1b3552] bg-[#07101d] py-2 pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-[#2c83d4] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              {(["all", "active", "isolated", "quarantined"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                    statusFilter === s
                      ? "bg-[#0a6cff]/20 text-[#62b4ff] ring-1 ring-[#1c8dff]/45"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela */}
          <div className="mt-4 overflow-hidden border border-[#1b3552] bg-[#0a1626]/60">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1b3552] bg-[#07101d]/80 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">OS</th>
                  <th className="px-4 py-3">Criticidade</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      {loading ? "Carregando ativos..." : "Nenhum ativo encontrado"}
                    </td>
                  </tr>
                )}
                {filtered.map((asset) => {
                  const status = (asset.status || "active").toLowerCase();
                  const isIsolated = status === "isolated";
                  const isBusy = busy.has(asset.id);
                  const risk = asset.risk_score ?? 0;

                  return (
                    <tr
                      key={asset.id}
                      className="border-b border-[#1b3552]/50 transition hover:bg-[#102238]/50"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-200">
                          {asset.hostname}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {asset.ip_address || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {asset.operating_system || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <CriticalityBadge value={asset.criticality} />
                      </td>
                      <td className="px-4 py-3">
                        <RiskBar value={risk} />
                      </td>
                      <td className="px-4 py-3">
                        {isIsolated ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-rose-300 ring-1 ring-rose-500/40">
                            <Lock className="h-3 w-3" />
                            Isolated
                          </span>
                        ) : status === "quarantined" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/40">
                            <Lock className="h-3 w-3" />
                            Quarantined
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/40">
                            <ShieldCheck className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleStatus(asset)}
                          disabled={isBusy}
                          title={isIsolated ? "Reativar host" : "Isolar host"}
                          className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                            isIsolated
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                              : "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                          }`}
                        >
                          {isIsolated ? (
                            <>
                              <Unlock className="h-3 w-3" />
                              {isBusy ? "..." : "Reativar"}
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              {isBusy ? "..." : "Isolar"}
                            </>
                          )}
                        </button>
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

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: typeof Server;
}) {
  const colors = {
    sky: "border-sky-500/30 bg-sky-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
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

function CriticalityBadge({ value }: { value?: string }) {
  const v = (value || "medium").toLowerCase();
  const cls =
    v === "critical" ? "bg-rose-500/15 text-rose-300 ring-rose-500/40" :
    v === "high"     ? "bg-orange-500/15 text-orange-300 ring-orange-500/40" :
    v === "medium"   ? "bg-amber-500/15 text-amber-300 ring-amber-500/40" :
                       "bg-sky-500/15 text-sky-300 ring-sky-500/40";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${cls}`}>
      {v}
    </span>
  );
}

function RiskBar({ value }: { value: number }) {
  const color =
    value >= 75 ? "bg-rose-500" :
    value >= 50 ? "bg-amber-500" :
    value >= 25 ? "bg-sky-500" :
                  "bg-slate-600";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#1b3552]">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-[10px] text-slate-400">{value}</span>
    </div>
  );
}
