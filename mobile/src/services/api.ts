// mobile/src/services/api.ts
import { Platform } from "react-native";

// Resolve URL do gateway com fallback por plataforma:
//   Android emulator: 10.0.2.2 (alias do host)
//   iOS / Web:        localhost
//   Celular físico:   defina EXPO_PUBLIC_API_URL com IP da LAN
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8080" : "http://localhost:8080");

console.log("[api] base URL:", API_URL);

// =============================================================================
// Types
// =============================================================================

export interface SecurityEvent {
  id: string;
  source: string;
  hostname?: string;
  severity: string;
  event_type: string;
  category?: string;
  message?: string;
  processed: boolean;
  created_at: string;
  // Enriquecido pelo backend (JOIN com incidents.metadata)
  attack?: boolean;
  technique_id?: string;
  tactic?: string;
  confidence?: number;
  recommended_action?: string;
  detection_source?: string;
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

export interface Asset {
  id: string;
  hostname: string;
  ip_address?: string;
  operating_system?: string;
  status?: string;
  criticality?: string;
  risk_score?: number;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resource?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DetectionStatus {
  gateway: { healthy: boolean; latency_ms?: number };
  detection_service: { healthy: boolean; latency_ms?: number };
  ml_inference: { healthy: boolean; latency_ms?: number };
  model?: { name: string; loaded: boolean; feature_dim: number };
  pipeline: { current_mode: string };
  checked_at: string;
}

// =============================================================================
// Helpers
// =============================================================================

async function getJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[api] GET ${path} failed:`, e);
    return fallback;
  }
}

async function postJSON<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[api] POST ${path} failed:`, e);
    return null;
  }
}

async function patchJSON<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[api] PATCH ${path} failed:`, e);
    return null;
  }
}

// =============================================================================
// Health
// =============================================================================

export async function getBackendStatus(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return await res.text();
  } catch {
    return "Offline";
  }
}

export async function getDetectionStatus(): Promise<DetectionStatus | null> {
  return getJSON<DetectionStatus | null>("/api/detection/status", null);
}

// =============================================================================
// Events
// =============================================================================

export async function fetchEvents(limit = 20): Promise<SecurityEvent[]> {
  return getJSON<SecurityEvent[]>(`/api/events?limit=${limit}`, []);
}

export async function sendSecurityEvent(event: {
  source: string;
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
}): Promise<SecurityEvent | null> {
  return postJSON<SecurityEvent>("/api/events", {
    payload: {},
    ...event,
  });
}

/** Alias legado: simula um ataque (usa /api/events). */
export async function sendAttackSimulation(eventType: string): Promise<boolean> {
  const res = await sendSecurityEvent({
    source: "Sentinel-Mobile-Sensor",
    hostname: "mobile-test-endpoint",
    severity: "critical",
    event_type: eventType,
    category: "test",
    is_attack: true,
    auto_remediate: false,
    payload: { sensor: "mobile", simulated: true },
  });
  return res !== null;
}

// =============================================================================
// Incidents
// =============================================================================

export async function fetchIncidents(): Promise<Incident[]> {
  return getJSON<Incident[]>("/api/incidents", []);
}

// =============================================================================
// Assets
// =============================================================================

export async function fetchAssets(): Promise<Asset[]> {
  return getJSON<Asset[]>("/api/assets", []);
}

/** Atualiza o status de um asset (reativa após isolamento SOAR). */
export async function updateAssetStatus(
  assetId: string,
  status: "active" | "isolated" | "quarantined"
): Promise<Asset | null> {
  return patchJSON<Asset>(`/api/assets/${assetId}/status`, { status });
}

/** Legado: isola via SOAR (ainda usa PATCH por trás). */
export async function executeSoarIsolate(assetId: string): Promise<boolean> {
  const res = await updateAssetStatus(assetId, "isolated");
  return res !== null;
}

// =============================================================================
// Audit
// =============================================================================

export async function fetchAuditLogs(limit = 50): Promise<AuditLog[]> {
  return getJSON<AuditLog[]>(`/api/audit?limit=${limit}`, []);
}

// =============================================================================
// Formatting helpers
// =============================================================================

export function relativeTime(value: string): string {
  try {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s atrás`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m atrás`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h atrás`;
    return `${Math.round(seconds / 86400)}d atrás`;
  } catch {
    return "—";
  }
}

export function verdictOf(event: SecurityEvent): "malicious" | "suspicious" | "benign" {
  if (event.attack && (event.confidence ?? 0) >= 75) return "malicious";
  if (event.attack) return "suspicious";
  if (event.processed) return "suspicious";
  return "benign";
}
