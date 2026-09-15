"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Cpu, FileText, Server, ShieldCheck } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

const sections = {
  assets: {
    title: "Ativos & EDR",
    description: "Inventário de endpoints e telemetria dos agentes EDR.",
    icon: Server,
    status: "Sincronização ativa",
  },
  incidents: {
    title: "Incidentes",
    description: "Triagem, investigação e resposta aos incidentes detectados.",
    icon: AlertTriangle,
    status: "12 eventos aguardando análise",
  },
  pqc: {
    title: "Engine PQC",
    description: "Políticas de criptografia pós-quântica e saúde dos algoritmos.",
    icon: Cpu,
    status: "ML-KEM-768 ativo",
  },
  logs: {
    title: "Logs SIEM",
    description: "Eventos de segurança normalizados pelo pipeline do Sentinel.",
    icon: FileText,
    status: "Ingestão em tempo real",
  },
  settings: {
    title: "Configurações",
    description: "Preferências da plataforma, integrações e controles de acesso.",
    icon: ShieldCheck,
    status: "Ambiente protegido",
  },
} as const;

export default function SectionPage() {
  const [collapsed, setCollapsed] = useState(false);
  const { section } = useParams<{ section: string }>();
  const current = sections[section as keyof typeof sections] ?? sections.assets;
  const Icon = current.icon;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8">
        <div className="mx-auto w-full max-w-[1600px]">
          <header className="mb-8 rounded-[30px] border border-slate-800/80 bg-slate-900/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.8)] backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/10 text-sky-300">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-300">Sentinel Quantum XDR</p>
                <h1 className="text-2xl font-bold text-white md:text-3xl">{current.title}</h1>
                <p className="mt-2 text-sm text-slate-400">{current.description}</p>
              </div>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.7)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Visão operacional</h2>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">Operacional</span>
              </div>
              <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-center">
                <div>
                  <Icon className="mx-auto mb-3 h-8 w-8 text-sky-300" />
                  <p className="font-medium text-white">{current.status}</p>
                  <p className="mt-2 text-sm text-slate-500">Os dados desta área serão atualizados pelo gateway em tempo real.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.7)]">
              <h2 className="mb-5 text-lg font-semibold text-white">Atividade recente</h2>
              <div className="space-y-3">
                {["Pipeline conectado", "Políticas verificadas", "Última atualização agora"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
