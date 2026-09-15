"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { fetchAssets, fetchEvents, fetchHealth, fetchIncidents, sendSecurityEvent, Asset, Incident, SecurityEvent } from "@/lib/api";
import {
  Activity, AlertTriangle, ArrowUpRight, Bell, CheckCircle2, ChevronDown, CircleDot,
  Clock3, Cloud, Cpu, Globe2, LockKeyhole, Menu, MoreHorizontal, Search, Server,
  Shield, ShieldAlert, Terminal, Users, Wifi, Zap,
} from "lucide-react";

const chartPoints = "0,90 32,84 64,95 96,60 128,68 160,42 192,56 224,28 256,38 288,18 320,34 352,10 384,25 416,7 448,20 480,3 512,14 544,0";

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function severityTone(severity: string) {
  const normalized = severity.toLowerCase();
  return normalized === "critical" ? "rose" : normalized === "high" ? "amber" : "sky";
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`border border-[#1b3552] bg-[#0a1626]/90 shadow-[0_10px_35px_rgba(0,0,0,0.16)] ${className}`}>{children}</section>;
}

function PanelHeading({ icon: Icon, title, action }: { icon: typeof Activity; title: string; action?: string }) {
  return <div className="flex items-center justify-between border-b border-[#1b3552] px-5 py-4"><div className="flex items-center gap-2.5"><Icon className="h-4 w-4 text-[#43a8ff]" /><h2 className="text-sm font-semibold text-slate-100">{title}</h2></div>{action && <button className="text-[11px] text-[#5faeff] hover:text-white">{action}</button>}</div>;
}

function Stat({ label, value, change, icon: Icon, tone }: { label: string; value: string | number; change: string; icon: typeof Shield; tone: string }) {
  return <div className="relative overflow-hidden border border-[#1b3552] bg-[#0a1626] p-4"><div className={`absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl ${tone}`} /><div className="relative flex items-start justify-between"><div><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400"><ArrowUpRight className="h-3 w-3" />{change}</p></div><Icon className="h-5 w-5 text-slate-500" /></div></div>;
}

function ThreatMap({ eventCount, criticalCount, highCount }: { eventCount: number; criticalCount: number; highCount: number }) {
  const nodes = [
    { x: 21, y: 49, label: "North America", tone: "rose", value: Math.max(criticalCount, 0) },
    { x: 45, y: 40, label: "Europe", tone: "amber", value: Math.max(highCount, 0) },
    { x: 61, y: 57, label: "Middle East", tone: "sky", value: Math.max(1, Math.round(eventCount / 2)) },
    { x: 77, y: 47, label: "East Asia", tone: "rose", value: Math.max(2, eventCount + 1) },
    { x: 35, y: 72, label: "South America", tone: "emerald", value: 1 },
  ];
  const toneColor = { rose: "#fb7185", amber: "#fbbf24", sky: "#38bdf8", emerald: "#34d399" };
  const routes = [[21, 49, 45, 40], [45, 40, 77, 47], [21, 49, 61, 57], [35, 72, 45, 40]];

  return <div className="relative h-[286px] overflow-hidden bg-[#061321] px-4 py-3">
    <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(56,132,194,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(56,132,194,.22) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
    <div className="absolute inset-x-0 top-0 h-1 bg-[#1e9fff] shadow-[0_0_16px_rgba(30,159,255,.8)] animate-[scan_4s_linear_infinite]" />
    <svg viewBox="0 0 100 100" className="absolute inset-x-4 top-12 h-[194px] w-[calc(100%-2rem)]" preserveAspectRatio="none" aria-label="Global threat map">
      <path d="M5 31l9-9 10 2 7 9 9-2 6 8-4 8-10 1-6 8-10-4-8 4-7-8 4-8zM42 25l8-6 8 3 6-4 7 4 3 8 9 2 6 8-6 6-9-2-8 7-7-5-7 3-5-8-6-3 5-7zM71 61l9-4 8 5 5 10-8 6-8-5-7 2-5-7zM29 61l7 4-2 9-7 9-5-8 4-8z" fill="#0a2237" stroke="#23577c" strokeWidth=".35" />
      {routes.map(([x1, y1, x2, y2], index) => <path key={index} d={`M${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 15} ${x2} ${y2}`} fill="none" stroke="#36a6ff" strokeWidth=".35" strokeDasharray="2 2" className="animate-[dash_3s_linear_infinite]" />)}
    </svg>
    {nodes.map((node) => <div key={node.label} className="absolute" style={{ left: `${node.x}%`, top: `${node.y}%` }}>
      <span className="absolute -inset-2 animate-ping rounded-full opacity-30" style={{ backgroundColor: toneColor[node.tone as keyof typeof toneColor] }} />
      <span className="relative block h-2.5 w-2.5 rounded-full border border-white/70" style={{ backgroundColor: toneColor[node.tone as keyof typeof toneColor], boxShadow: `0 0 16px ${toneColor[node.tone as keyof typeof toneColor]}` }} />
      <span className="absolute left-4 top-[-3px] hidden whitespace-nowrap text-[9px] text-slate-400 sm:block">{node.label} <b className="text-slate-200">{node.value}</b></span>
    </div>)}
    <div className="absolute left-4 top-3 flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />Live attack surface</div>
    <div className="absolute bottom-3 left-4 flex gap-4 text-[10px] text-slate-400"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />Critical</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-300" />High</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-300" />Telemetry</span></div>
    <div className="absolute bottom-3 right-4 font-mono text-[9px] text-slate-600">{eventCount.toString().padStart(2, "0")} signals / 10 min</div>
  </div>;
}

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [status, setStatus] = useState("Connecting");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [attackSent, setAttackSent] = useState(false);
  const criticalCount = events.filter((event) => event.severity.toLowerCase() === "critical").length;
  const highCount = events.filter((event) => event.severity.toLowerCase() === "high").length;

  useEffect(() => {
    const loadTelemetry = async () => {
      try {
        await fetchHealth();
        const [assetData, incidentData, eventData] = await Promise.all([
          fetchAssets(),
          fetchIncidents(),
          fetchEvents(),
        ]);
        setAssets(assetData);
        setIncidents(incidentData);
        setEvents(eventData);
        setStatus("Operational");
      } catch {
        setStatus("Degraded");
      }
    };

    loadTelemetry();
    const refresh = window.setInterval(loadTelemetry, 15000);
    return () => window.clearInterval(refresh);
  }, []);

  const handleAttack = async () => {
    try {
      await sendSecurityEvent({ source: "EDR-Agent-Win11", severity: "CRITICAL", event_type: "RANSOMWARE_BEHAVIOR", category: "attack", is_attack: true, auto_remediate: true, hostname: "EDR-Agent-Win11", payload: { sensor: "endpoint", action: "process_injection" } });
      setAttackSent(true);
      const [incidentData, eventData] = await Promise.all([fetchIncidents(), fetchEvents()]);
      setIncidents(incidentData);
      setEvents(eventData);
    } catch { setAttackSent(true); }
  };

  return <div className="min-h-screen bg-[#050c16] text-slate-200">
    <div className={`fixed inset-0 z-30 bg-black/60 lg:hidden ${mobileMenu ? "block" : "hidden"}`} onClick={() => setMobileMenu(false)} />
    <div className={`flex min-h-screen ${mobileMenu ? "[&>aside]:translate-x-0" : ""}`}>
      <div className={`lg:block ${mobileMenu ? "block" : "hidden"}`}><Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} /></div>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#1b3552] bg-[#07101d]/95 px-4 backdrop-blur-md md:px-7">
          <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileMenu(true)} className="text-slate-400 lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden items-center gap-2 text-xs text-slate-500 md:flex"><span>Security Operations</span><span>/</span><span className="text-slate-200">Overview</span></div><div className="flex h-9 w-full max-w-[270px] items-center gap-2 border border-[#203d5e] bg-[#0b192a] px-3 md:ml-8"><Search className="h-4 w-4 text-slate-500" /><input placeholder="Search anything..." className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /></div></div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 border-r border-[#1b3552] pr-4 text-[11px] text-slate-400 sm:flex"><span className={`h-1.5 w-1.5 rounded-full ${status === "Operational" ? "bg-emerald-400" : "bg-amber-400"}`} />{status}</div><button className="relative text-slate-400 hover:text-white"><Bell className="h-4 w-4" /><span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-rose-400" /></button><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1556a0] text-[11px] font-bold text-white">SO</div><span className="hidden text-xs text-slate-300 md:block">Security Operator</span><ChevronDown className="hidden h-3 w-3 text-slate-500 md:block" /></div></div>
        </header>
        <div className="mx-auto max-w-[1600px] p-4 md:p-7">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#4ca9ff]"><Shield className="h-3.5 w-3.5" />XDR command center</div><h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Good morning, Security Operator <span className="text-[#5caeff]">.</span></h1><p className="mt-1 text-xs text-slate-500">Here is what is happening across your environment today.</p></div><div className="flex items-center gap-2"><button className="flex items-center gap-2 border border-[#254462] px-3 py-2 text-xs text-slate-300 hover:border-[#4ca9ff]"><Clock3 className="h-3.5 w-3.5" />Last 24 hours <ChevronDown className="h-3 w-3" /></button><button onClick={handleAttack} className="flex items-center gap-2 bg-[#0a6cff] px-3 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(10,108,255,.25)] hover:bg-[#2080ff]"><Zap className="h-3.5 w-3.5" />{attackSent ? "Event sent" : "Simulate event"}</button></div></div>
          <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4"><Stat label="Active incidents" value={incidents.filter((incident) => incident.status !== "resolved").length} change="from PostgreSQL" icon={ShieldAlert} tone="bg-rose-500/20" /><Stat label="Protected assets" value={assets.length} change="registered assets" icon={Server} tone="bg-sky-500/20" /><Stat label="Recent events" value={events.length} change="last 20 received" icon={Activity} tone="bg-cyan-500/20" /><Stat label="Critical signals" value={events.filter((event) => ["critical", "high"].includes(event.severity.toLowerCase())).length} change="requires triage" icon={Cpu} tone="bg-emerald-500/20" /></div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.9fr)]">
            <Panel><PanelHeading icon={Activity} title="Threat activity" action="Live telemetry" /><div className="p-5"><div className="mb-3 flex items-end justify-between"><div><span className="text-3xl font-semibold text-white">{events.length}</span><span className="ml-2 text-xs text-emerald-400">live</span><p className="mt-1 text-[11px] text-slate-500">events received from security sources</p></div><div className="flex gap-4 text-[10px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 bg-[#36a6ff]" />Events</span><span><i className="mr-1 inline-block h-2 w-2 bg-[#27d5a2]" />Alerts</span></div></div><div className="relative h-[190px] border-b border-l border-[#1b3552] bg-[linear-gradient(rgba(50,101,145,.12)_1px,transparent_1px)] bg-[size:100%_38px]"><svg viewBox="0 0 544 110" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><polyline points={events.length ? events.map((event, index) => `${index * (544 / Math.max(events.length - 1, 1))},${100 - (event.severity.toLowerCase() === "critical" ? 85 : event.severity.toLowerCase() === "high" ? 65 : 35)}`).join(" ") : chartPoints} fill="none" stroke="#39a7ff" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[9px] text-slate-600"><span>recent</span><span>latest event</span></div></div></div></Panel>
            <Panel><PanelHeading icon={Globe2} title="Global threat map" action="Expand" /><ThreatMap eventCount={events.length} criticalCount={criticalCount} highCount={highCount} /></Panel>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.85fr)]">
            <Panel><PanelHeading icon={ShieldAlert} title="Incident queue" action="Live from SIEM" /><div className="divide-y divide-[#172c43]">{incidents.slice(0, 6).map((incident) => { const tone = severityTone(incident.severity); return <div key={incident.id} className="flex items-center gap-3 px-5 py-3.5"><div className={`h-2 w-2 shrink-0 rounded-full ${tone === "rose" ? "bg-rose-400 shadow-[0_0_9px_#fb7185]" : tone === "amber" ? "bg-amber-300" : "bg-sky-300"}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{incident.title}</p><p className="mt-1 text-[10px] text-slate-500">{incident.source || "security gateway"} <span className="mx-1">•</span> {relativeTime(incident.detected_at)}</p></div><span className={`hidden text-[10px] uppercase tracking-wider sm:block ${tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "text-sky-300"}`}>{incident.severity}</span><MoreHorizontal className="h-4 w-4 text-slate-600" /></div>; })}</div></Panel>
            <Panel><PanelHeading icon={Terminal} title="Live event stream" action="From PostgreSQL" /><div className="divide-y divide-[#172c43]">{events.slice(0, 6).map((event) => <div key={event.id} className="flex gap-3 px-5 py-3"><div className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#245175] bg-[#0d253a] text-[8px] font-bold text-[#54b0ff]">{event.source.slice(0, 3).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] text-slate-300">{event.message || event.event_type.replaceAll("_", " ")}</p><p className="mt-1 truncate font-mono text-[9px] text-slate-600">{event.hostname || event.source}</p></div><span className="font-mono text-[9px] text-slate-600">{relativeTime(event.created_at)}</span></div>)}</div></Panel>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <Panel><PanelHeading icon={AlertTriangle} title="Vulnerability exposure" action="View report" /><div className="p-5"><div className="mb-5 flex items-center gap-5"><div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[8px] border-[#163955] border-t-rose-400 border-r-amber-300"><div className="text-center"><strong className="block text-xl text-white">74</strong><span className="text-[9px] text-slate-500">SCORE</span></div></div><div className="space-y-2 text-[10px] text-slate-400"><p><i className="mr-2 inline-block h-2 w-2 bg-rose-400" />Critical <strong className="ml-5 text-white">8</strong></p><p><i className="mr-2 inline-block h-2 w-2 bg-amber-300" />High <strong className="ml-8 text-white">24</strong></p><p><i className="mr-2 inline-block h-2 w-2 bg-sky-300" />Medium <strong className="ml-3 text-white">116</strong></p></div></div><div className="h-1.5 bg-[#172d43]"><div className="h-full w-[74%] bg-gradient-to-r from-rose-400 via-amber-300 to-sky-300" /></div><p className="mt-2 text-[10px] text-slate-500">Risk score improved by <span className="text-emerald-400">6.2%</span> this week</p></div></Panel>
            <Panel><PanelHeading icon={Cloud} title="Asset health" action="Manage assets" /><div className="space-y-4 p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded bg-emerald-400/10 p-2 text-emerald-400"><CheckCircle2 className="h-4 w-4" /></div><div><p className="text-xs text-slate-200">Healthy endpoints</p><p className="text-[10px] text-slate-500">Last check 30s ago</p></div></div><strong className="text-lg text-white">92%</strong></div><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded bg-amber-400/10 p-2 text-amber-300"><Wifi className="h-4 w-4" /></div><div><p className="text-xs text-slate-200">Needs attention</p><p className="text-[10px] text-slate-500">72 assets</p></div></div><strong className="text-lg text-white">5.6%</strong></div><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded bg-sky-400/10 p-2 text-sky-300"><Users className="h-4 w-4" /></div><div><p className="text-xs text-slate-200">Active users</p><p className="text-[10px] text-slate-500">Across 8 workspaces</p></div></div><strong className="text-lg text-white">438</strong></div></div></Panel>
            <Panel><PanelHeading icon={LockKeyhole} title="Post-quantum security" action="Configure" /><div className="p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-2xl font-semibold text-white">96.8%</p><p className="mt-1 text-[10px] text-slate-500">coverage with PQC algorithms</p></div><CircleDot className="h-8 w-8 text-[#45d6ae]" /></div><div className="mb-4 h-1.5 bg-[#172d43]"><div className="h-full w-[96.8%] bg-[#34d6a5] shadow-[0_0_10px_#34d6a5]" /></div><div className="flex items-center justify-between border-t border-[#1b3552] pt-3 text-[10px]"><span className="text-slate-500">Active standard</span><span className="font-mono text-[#55b3ff]">ML-KEM-768</span></div></div></Panel>
          </div>
        </div>
      </main>
    </div>
  </div>;
}
