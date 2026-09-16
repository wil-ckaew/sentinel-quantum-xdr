"use client";

import { useState } from "react";
import { Play, Terminal, Zap, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { VerdictBadge } from "@/components/VerdictBadge";
import { MitreTag } from "@/components/MitreTag";
import { sendSecurityEvent, SecurityEvent } from "@/lib/api";

const PRESETS = [
  {
    label: "Webshell PHP",
    payload: "<?php system($_GET['cmd']); ?>",
    mime: "application/x-php",
    severity: "critical",
    auto_remediate: true,
  },
  {
    label: "MZ header (PE)",
    payload: "4d5a90000300000004000000ffffe0000000b800000000000000",
    mime: "application/x-dosexec",
    severity: "high",
    auto_remediate: true,
  },
  {
    label: "Shellcode (NOP sled)",
    payload: "90" + "90".repeat(32) + "cc" + "ebfe",
    mime: "application/octet-stream",
    severity: "high",
    auto_remediate: false,
  },
  {
    label: "Texto benigno",
    payload: "The quick brown fox jumps over the lazy dog",
    mime: "text/plain",
    severity: "low",
    auto_remediate: false,
  },
];

export default function PlaygroundPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [payload, setPayload] = useState(PRESETS[0].payload);
  const [mime, setMime] = useState(PRESETS[0].mime);
  const [severity, setSeverity] = useState(PRESETS[0].severity);
  const [autoRemediate, setAutoRemediate] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SecurityEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await sendSecurityEvent({
        source: "playground",
        severity,
        event_type: "MANUAL_TEST",
        category: "test",
        payload_text: payload,
        mime,
        is_attack: true,
        auto_remediate: autoRemediate,
        payload: { playground: true },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <main className={`flex-1 transition-all ${collapsed ? "lg:pl-24" : "lg:pl-72"}`}>
        <div className="border-b border-[#1b3552] bg-[#07101d]/80 px-8 py-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-sky-400">
            <Terminal className="h-3 w-3" />
            Laboratório
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-white">Playground de Detecção</h1>
          <p className="mt-1 text-sm text-slate-400">
            Envie um payload e veja o veredito do pipeline híbrido em tempo real
          </p>
        </div>

        <div className="grid gap-6 px-8 py-6 lg:grid-cols-2">
          {/* Formulário */}
          <div className="border border-[#1b3552] bg-[#0a1626]/60">
            <div className="border-b border-[#1b3552] px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-100">Payload</h2>
            </div>
            <div className="space-y-4 p-5">
              {/* Presets */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Presets
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setPayload(p.payload);
                        setMime(p.mime);
                        setSeverity(p.severity);
                        setAutoRemediate(p.auto_remediate);
                      }}
                      className="rounded border border-[#1b3552] bg-[#07101d] px-3 py-1.5 text-xs text-slate-300 transition hover:border-[#2c83d4] hover:text-white"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payload */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  payload_text
                </label>
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  rows={5}
                  className="mt-2 w-full rounded border border-[#1b3552] bg-[#07101d] px-3 py-2 font-mono text-xs text-slate-200 focus:border-[#2c83d4] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    MIME
                  </label>
                  <input
                    value={mime}
                    onChange={(e) => setMime(e.target.value)}
                    className="mt-2 w-full rounded border border-[#1b3552] bg-[#07101d] px-3 py-2 font-mono text-xs text-slate-200 focus:border-[#2c83d4] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="mt-2 w-full rounded border border-[#1b3552] bg-[#07101d] px-3 py-2 text-xs text-slate-200 focus:border-[#2c83d4] focus:outline-none"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={autoRemediate}
                  onChange={(e) => setAutoRemediate(e.target.checked)}
                  className="h-4 w-4 accent-[#0a6cff]"
                />
                auto_remediate (dispara SOAR se malicious)
              </label>

              <button
                onClick={send}
                disabled={sending || !payload}
                className="flex w-full items-center justify-center gap-2 rounded bg-[#0a6cff] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0060e6] disabled:opacity-50"
              >
                <Play className={`h-4 w-4 ${sending ? "animate-pulse" : ""}`} />
                {sending ? "Analisando..." : "Enviar para análise"}
              </button>

              {error && (
                <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Resultado */}
          <div className="border border-[#1b3552] bg-[#0a1626]/60">
            <div className="border-b border-[#1b3552] px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-100">Resultado</h2>
            </div>
            <div className="p-5">
              {!result && !sending && (
                <p className="py-12 text-center text-sm text-slate-500">
                  Envie um payload para ver o resultado
                </p>
              )}
              {sending && (
                <div className="space-y-2 py-12 text-center">
                  <Zap className="mx-auto h-8 w-8 animate-pulse text-sky-400" />
                  <p className="text-sm text-slate-400">Analisando...</p>
                  <p className="text-xs text-slate-500">
                    gateway → detection-service → ml-inference
                  </p>
                </div>
              )}
              {result && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <VerdictBadge
                      verdict={
                        result.attack && (result.confidence ?? 0) >= 75
                          ? "malicious"
                          : result.attack
                          ? "suspicious"
                          : "benign"
                      }
                      size="md"
                    />
                    {result.processed && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        incidente criado
                      </span>
                    )}
                  </div>

                  <dl className="space-y-2 text-xs">
                    <Row label="ID" value={result.id} mono />
                    <Row label="event_type" value={result.event_type} mono />
                    <Row label="severity" value={result.severity} />
                    <Row label="attack" value={String(result.attack ?? false)} />
                    <Row label="confidence" value={String(result.confidence ?? "—")} />
                    <Row label="technique_id" value={result.technique_id ?? "—"} />
                    <Row label="tactic" value={result.tactic ?? "—"} />
                    <Row
                      label="recommended_action"
                      value={result.recommended_action ?? "—"}
                    />
                    <Row
                      label="detection_source"
                      value={result.detection_source ?? "—"
                      }
                    />
                  </dl>

                  {result.technique_id && (
                    <div className="flex items-center gap-2 border-t border-[#1b3552] pt-4">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">
                        MITRE
                      </span>
                      <MitreTag techniqueId={result.technique_id} tactic={result.tactic} />
                    </div>
                  )}

                  <details className="border-t border-[#1b3552] pt-4">
                    <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300">
                      JSON bruto
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-[#061321] p-3 text-[10px] text-slate-400">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#1b3552]/40 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
