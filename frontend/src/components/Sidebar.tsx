"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield, Server, AlertTriangle, Cpu, Terminal, Settings, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Activity, FlaskConical, Radio,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",   icon: Shield,         href: "/" },
  { label: "Eventos",     icon: Activity,       href: "/events" },
  { label: "Incidentes",  icon: AlertTriangle,  href: "/incidents" },
  { label: "Ativos",      icon: Server,         href: "/assets" },
  { label: "Playground",  icon: FlaskConical,   href: "/playground" },
  { label: "Detecção",    icon: Radio,          href: "/detection" },
  { label: "Audit Logs",  icon: Terminal,       href: "/audit" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col justify-between border-r border-[#1d314a] bg-[#07101d] py-5 shadow-[12px_0_40px_rgba(0,0,0,0.28)] transition-all duration-300 lg:sticky lg:z-20 ${collapsed ? "w-[78px] px-3" : "w-[252px] px-4"}`}>
      <div>
        <div className={`mb-8 flex items-center gap-3 border-b border-[#1d314a] pb-5 ${collapsed ? "justify-center" : "px-1"}`}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0a6cff] text-white shadow-[0_0_24px_rgba(10,108,255,0.48)]">
            <Shield className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-sky-300">Quantum</p>
              <p className="text-lg font-semibold tracking-[0.18em] text-white">SENTINEL</p>
            </div>
          )}
        </div>

        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon, href }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={label}
                href={href}
                title={collapsed ? label : undefined}
                className={`group flex items-center justify-between rounded-lg px-3 py-3 text-sm font-medium transition ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-[#0a6cff]/15 text-[#62b4ff] ring-1 ring-[#1c8dff]/45"
                    : "text-slate-400 hover:bg-[#102238] hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {!collapsed && label}
                </span>
                {!collapsed && (
                  <ChevronRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2">
        {!collapsed && (
          <div className="border-t border-[#1d314a] pt-4 text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Workspace / production
          </div>
        )}
        <Link
          title={collapsed ? "Configurações" : undefined}
          href="/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition hover:bg-[#102238] hover:text-white ${collapsed ? "justify-center" : ""} ${pathname.startsWith("/settings") ? "text-sky-300" : "text-slate-400"}`}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && "Configurações"}
        </Link>
        <button
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-lg border border-[#1d314a] py-2 text-slate-500 transition hover:border-[#2c83d4] hover:text-white"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="ml-2 text-xs">Recolher menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
