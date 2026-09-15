const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function fetchHealth(): Promise<string> {
  const res = await fetch(`${API_URL}/health`);
  return res.text();
}

export interface Asset {
  id: string;
  hostname: string;
  ip_address?: string;
  status?: string;
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
  metadata?: Record<string, unknown>;
}

export interface SecurityEvent {
  id: string;
  source: string;
  hostname?: string;
  severity: string;
  event_type: string;
  category?: string;
  message?: string;
  created_at: string;
}

export async function fetchAssets(): Promise<Asset[]> {
  const res = await fetch(`${API_URL}/api/assets`);
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
  hostname?: string;
  severity: string;
  event_type: string;
  category?: string;
  is_attack?: boolean;
  auto_remediate?: boolean;
  payload: Record<string, unknown>;
}) {
  const res = await fetch(`${API_URL}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error("Falha ao enviar evento ao SIEM");
  return res.json();
}
