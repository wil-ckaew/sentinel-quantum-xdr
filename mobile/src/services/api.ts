const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8080";

export async function getBackendStatus(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return await res.text();
  } catch {
    return "Offline";
  }
}

export async function fetchAssets() {
  try {
    const res = await fetch(`${API_URL}/api/assets`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  category?: string;
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
  created_at: string;
}

export async function fetchIncidents(): Promise<Incident[]> {
  try {
    const res = await fetch(`${API_URL}/api/incidents`);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function fetchEvents(): Promise<SecurityEvent[]> {
  try {
    const res = await fetch(`${API_URL}/api/events?limit=10`);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function sendAttackSimulation(eventType: string) {
  const res = await fetch(`${API_URL}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "Sentinel-Mobile-Sensor",
      hostname: "mobile-test-endpoint",
      severity: "HIGH",
      event_type: eventType,
      category: "attack",
      is_attack: true,
      auto_remediate: false,
      payload: { sensor: "mobile", simulated: true },
    }),
  });
  return res.ok;
}

export async function executeSoarIsolate(assetId: string) {
  const res = await fetch(`${API_URL}/api/soar/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      asset_id: assetId,
      action_type: "ISOLATE_HOST",
      reason: "Ação de emergência via Sentinel Mobile SOC",
    }),
  });
  return res.ok;
}
