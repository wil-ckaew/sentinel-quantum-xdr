const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// =============================================================================
// Core
// =============================================================================

export async function fetchHealth(): Promise<string> {
  const res = await fetch(`${API_URL}/health`);
  return res.text();
}

export async function fetchHealthDetailed(): Promise<HealthDetailed> {
  const res = await fetch(`${API_URL}/health/detailed`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao buscar health");
  return res.json();
}

export async function fetchMetricsRaw(): Promise<string> {
  const res = await fetch(`${API_URL}/metrics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao buscar métricas");
  return res.text();
}

// =============================================================================
// Types
// =============================================================================

export interface HealthDetailed {
  status: string;
  service: string;
  version: string;
  checks: {
    postgres: boolean;
    redis: boolean;
    rabbitmq: boolean;
    detection_service: boolean;
  };
}

export interface Asset {
  id: string;
  tenant_id?: string;
  hostname: string;
  ip_address?: string;
  operating_system?: string;
  status?: string;
  criticality?: string;
  risk_score?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  category?: string;
  source?: string;
  detected_at: string;
  metadata?: {
    event_id?: string;
    hostname?: string;
    correlation_count?: number;
    mitre?: {
      tactic?: string;
      technique_id?: string;
      technique?: string;
      confidence?: number;
    };
    playbook?: string;
    detection?: {
      score?: number;
      source?: string;
      mitre_all?: string[];
    };
  };
}

export interface SecurityEvent {
  id: string;
  tenant_id?: string;
  source: string;
  source_ip?: string;
  hostname?: string;
  severity: string;
  event_type: string;
  category?: string;
  message?: string;
  payload?: Record<string, unknown>;
  correlation_id?: string;
  processed: boolean;
  created_at: string;
  // Campos de detecção híbrida (não persistidos diretamente, mas devolvidos no POST)
  attack?: boolean;
  technique_id?: string;
  tactic?: string;
  confidence?: number;
  recommended_action?: string;
  detection_source?: string;
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
  user_id?: string;
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PromMetrics {
  events_total: number;
  detections_total: number;
  verdict_malicious: number;
  verdict_suspicious: number;
  verdict_benign: number;
  fallbacks_total: number;
}

export interface AnalyzeResponse {
  verdict: "benign" | "suspicious" | "malicious";
  score: number;
  confidence: number;
  rule_hits: Array<{ id: string; description: string; weight: number }>;
  ml?: { score: number; label: string; model: string; confidence: number };
  mitre: string[];
}

// =============================================================================
// Endpoints existentes
// =============================================================================

export async function fetchAssets(): Promise<Asset[]> {
  const res = await fetch(`${API_URL}/api/assets`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao buscar ativos");
  return res.json();
}

export async function fetchIncidents(): Promise<Incident[]> {
  const res = await fetch(`${API_URL}/api/incidents`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao buscar incidentes");
  return res.json();
}

export async function fetchEvents(limit = 20): Promise<SecurityEvent[]> {
  const res = await fetch(`${API_URL}/api/events?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao buscar eventos");
  return res.json();
}

export async function sendSecurityEvent(event: {
  source: string;
  source_ip?: string;
  hostname?: string;
  severity: string;
  event_type: string;
  category?: string;
  is_attack?: boolean;
  auto_remediate?: boolean;
  message?: string;
  payload?: Record<string, unknown>;
  payload_text?: string;
  mime?: string;
  size?: number;
}): Promise<SecurityEvent> {
  const res = await fetch(`${API_URL}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: {}, ...event }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao enviar evento: ${res.status} ${err}`);
  }
  return res.json();
}

// =============================================================================
// Endpoints novos (fase 3)
// =============================================================================

/** Busca audit logs do SOAR (opcional: filtra por resource/hostname). */
export async function fetchAuditLogs(limit = 50, resource?: string): Promise<AuditLog[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (resource) params.set("resource", resource);
  const res = await fetch(`${API_URL}/api/audit?${params}`, { cache: "no-store" });
  if (!res.ok) {
    // Endpoint pode não existir ainda — devolve array vazio em vez de quebrar
    if (res.status === 404) return [];
    throw new Error("Falha ao buscar audit logs");
  }
  return res.json();
}

/** Envia um payload arbitrário para o detection-service via gateway. */
export async function testDetection(payload: {
  payload_text: string;
  source: string;
  mime?: string;
  severity?: string;
  event_type?: string;
  category?: string;
}): Promise<SecurityEvent> {
  return sendSecurityEvent({
    source: payload.source,
    severity: payload.severity || "medium",
    event_type: payload.event_type || "MANUAL_TEST",
    category: payload.category || "test",
    payload_text: payload.payload_text,
    mime: payload.mime,
    payload: {},
  });
}

/** Parse do endpoint /metrics do Prometheus para objeto estruturado. */
export function parsePromMetrics(raw: string): PromMetrics {
  const get = (regex: RegExp): number => {
    const match = raw.match(regex);
    return match ? Number(match[1]) : 0;
  };

  return {
    events_total: get(/sentinel_events_total\s+(\d+)/),
    detections_total: get(/sentinel_detections_total\s+(\d+)/),
    verdict_malicious: get(/sentinel_detections_by_verdict\{verdict="malicious"\}\s+(\d+)/),
    verdict_suspicious: get(/sentinel_detections_by_verdict\{verdict="suspicious"\}\s+(\d+)/),
    verdict_benign: get(/sentinel_detections_by_verdict\{verdict="benign"\}\s+(\d+)/),
    fallbacks_total: get(/sentinel_detection_fallbacks_total\s+(\d+)/),
  };
}

/** Helper: formata tempo relativo. */
export function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s atrás`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m atrás`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h atrás`;
  return `${Math.round(seconds / 86400)}d atrás`;
}
