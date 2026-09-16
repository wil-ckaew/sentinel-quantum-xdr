"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, Filter, RefreshCw, Search, Terminal, FileText, Lock, Unlock, UserPlus,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { fetchAuditLogs, relativeTime, AuditLog } from "@/lib/api";

const ACTION_ICONS: Record<string, typeof Activity> = {
  SOAR_ISOLATE_HOST: Lock,
  SOAR_DISABLE_ACCOUNT: UserPlus,
  SOAR_CREATE_CASE: FileText,
  SOAR_UNISOLATE_HOST: Unlock,
};

const ACTION_COLORS: Record<string, string> = {
  SOAR_ISOLATE_HOST: "text-rose-300 bg-rose-500/10 ring-rose-500/40",
  SOAR_DISABLE_ACCOUNT: "text-amber-300 bg-amber-500/10 ring-amber-500/40",
  SOAR_CREATE_CASE: "text-sky-300 bg-sky-500/10 ring-sky-500/40",
  SOAR_UNISOLATE_HOST: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/40",
};

const ACTION_PRESETS = [
  { label: "Todos", value: undefined },
  { label: "SOAR_*", value: "SOAR_" },
  { label: "Isolar", value: "SOAR_ISOLATE_HOST" },
  { label: "Casos", value: "SOAR_CREATE_CASE" },
];

export default function AuditPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAuditLogs(200, actionFilter);
      setLogs(data);
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
  }, [actionFilter]);

  const filtered = useMemo(() => {
    if (!query) return logs;
    const q = query.toLowerCase();
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        (l.resource?.toLowerCase().includes(q) ?? false) ||
        JSON.stringify(l.metadata).toLowerCase().includes(q)
    );
  }, [logs, query]);

  const stats = useMemo(() => {
    const total = logs.length;
    const isolates = logs.filter((l) => l.action === "SOAR_ISOLATE_HOST").length;
    const unisolates = logs.filter((l) => l.action === "SOAR_UNISOLATE_HOST").length;
    const cases = logs.filter((l) => l.action === "SOAR_CREATE_CASE").length;
    return { total, isolates, unisolates, cases };
  }, [logs]);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <main className={`flex-1 transition-all ${collapsed ? "lg:pl-24" : "lg:pl-72"}`}>
        <div className="border-b border-[#1b3552] bg-[#07101d]/80 px-8 py-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-400">
                <Terminal className="h-3 w-3" />
                Conformidade
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-white">Audit Logs</h1>
              <p className="mt-1 text-sm text-slate-400">
                Ações automatizadas do SOAR e administrativas
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total" value={stats.total} tone="sky" icon={Activity} />
            <StatCard label="Isolamentos" value={stats.isolates} tone="rose" icon={Lock} />
            <StatCard label="Reativações" value={stats.unisolates} tone="emerald" icon={Unlock} />
            <StatCard label="Casos" value={stats.cases} tone="amber" icon={FileText} />
          </div>

          <div className="mt-6 flex flex-col gap-3 border border-[#1b3552] bg-[#0a1626]/60 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filtrar por ação, host ou metadata..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-[#1b3552] bg-[#07101d] py-2 pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-[#2c83d4] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              {ACTION_PRESETS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setActionFilter(a.value)}
                  className={`rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                    actionFilter === a.value
                      ? "bg-[#0a6cff]/20 text-[#62b4ff] ring-1 ring-[#1c8dff]/45"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {filtered.length === 0 && (
              <div className="border border-[#1b3552] bg-[#0a1626]/60 py-16 text-center text-slate-500">
                {loading ? "Carregando audit logs..." : "Nenhum log encontrado"}
              </div>
            )}
            {filtered.map((log) => {
              const Icon = ACTION_ICONS[log.action] || Activity;
              const color =
                ACTION_COLORS[log.action] || "text-slate-300 bg-slate-500/10 ring-slate-500/40";
              const isOpen = expanded === log.id;

              return (
                <div
                  key={log.id}
                  className="border border-[#1b3552] bg-[#0a1626]/60 transition hover:border-[#2c83d4]/40"
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                    className="flex w-full items-start gap-4 px-5 py-3 text-left"
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold text-slate-100">
                          {log.action}
                        </span>
                        {log.resource && (
                          <span className="font-mono text-xs text-slate-400">
                            → {log.resource}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>{relativeTime(log.created_at)}</span>
                        {log.user_id ? (
                          <span>user: {log.user_id.slice(0, 8)}...</span>
                        ) : (
                          <span className="text-slate-600">automático</span>
                        )}
                      </div>
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <span className="shrink-0 rounded bg-[#0a6cff]/10 px-2 py-0.5 text-[10px] text-[#62b4ff]">
                        {Object.keys(log.metadata).length} campos
                      </span>
                    )}
                  </button>

                  {isOpen && Object.keys(log.metadata).length > 0 && (
                    <div className="border-t border-[#1b3552] px-5 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Metadata
                      </p>
                      <pre className="mt-2 max-h-64 overflow-auto rounded bg-[#061321] p-3 text-[10px] text-slate-400">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
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
    emerald: "border-emerald-500/30 bg-emerald-500/5",
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
