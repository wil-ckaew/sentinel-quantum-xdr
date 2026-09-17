// mobile/src/screens/DashboardScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import {
  getBackendStatus,
  getDetectionStatus,
  fetchEvents,
  fetchAssets,
  fetchIncidents,
  DetectionStatus,
} from "../services/api";
import { VerdictBadge, SeverityBadge, MitreTag } from "../components/Badges";

export function DashboardScreen() {
  const [status, setStatus] = useState("Carregando...");
  const [detection, setDetection] = useState<DetectionStatus | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    const [health, det, ev, as, inc] = await Promise.all([
      getBackendStatus(),
      getDetectionStatus(),
      fetchEvents(10),
      fetchAssets(),
      fetchIncidents(),
    ]);
    setStatus(health);
    setDetection(det);
    setEvents(ev);
    setAssets(as);
    setIncidents(inc);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);

  const isolated = assets.filter((a) => (a.status || "").toLowerCase() === "isolated").length;
  const malicious = events.filter((e) => e.attack && (e.confidence ?? 0) >= 75).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#58a6ff" />}
    >
      {/* Metrics */}
      <View style={styles.metricsRow}>
        <Metric label="STATUS" value={status.includes("Online") ? "ONLINE" : "OFFLINE"} tone="sky" />
        <Metric label="EVENTOS" value={String(events.length)} tone="sky" />
        <Metric label="MALICIOSOS" value={String(malicious)} tone="rose" />
        <Metric label="ISOLADOS" value={String(isolated)} tone="rose" />
      </View>

      {/* Detection pipeline */}
      {detection && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Pipeline de Detecção</Text>
          <Row label="Gateway" healthy={detection.gateway.healthy} />
          <Row label="Detection Service" healthy={detection.detection_service.healthy} />
          <Row label="ML Inference" healthy={detection.ml_inference.healthy} />
          {detection.model && (
            <Text style={styles.modelInfo}>
              Modelo: {detection.model.name} · {detection.model.feature_dim} features
              {detection.model.loaded ? " · carregado" : " · heurística"}
            </Text>
          )}
        </View>
      )}

      {/* Recent events */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Eventos Recentes</Text>
        {events.slice(0, 5).map((e) => {
          const verdict =
            e.attack && (e.confidence ?? 0) >= 75
              ? "malicious"
              : e.attack
              ? "suspicious"
              : "benign";
          return (
            <View key={e.id} style={styles.eventRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventType}>{e.event_type}</Text>
                <Text style={styles.eventMeta}>
                  {e.hostname || e.source} · {e.severity}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <SeverityBadge severity={e.severity} />
                <VerdictBadge verdict={verdict} />
              </View>
            </View>
          );
        })}
        {events.length === 0 && <Text style={styles.empty}>Nenhum evento</Text>}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "sky" | "rose" }) {
  const color = tone === "rose" ? "#ff6b81" : "#7cc7ff";
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function Row({ label, healthy }: { label: string; healthy: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: healthy ? "#34d399" : "#ff6b81" }]}>
        {healthy ? "● healthy" : "● down"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117", paddingHorizontal: 16 },
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  metric: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: "#161b22",
    borderWidth: 1,
    borderColor: "#30363d",
    borderRadius: 8,
    padding: 12,
  },
  metricLabel: { fontSize: 10, color: "#8b949e", letterSpacing: 1, fontWeight: "600" },
  metricValue: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  panel: {
    backgroundColor: "#161b22",
    borderWidth: 1,
    borderColor: "#30363d",
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
  },
  panelTitle: { fontSize: 14, fontWeight: "700", color: "#c9d1d9", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowLabel: { fontSize: 12, color: "#8b949e" },
  rowValue: { fontSize: 12, fontWeight: "600" },
  modelInfo: { fontSize: 11, color: "#7cc7ff", marginTop: 8, fontFamily: "monospace" },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2933",
  },
  eventType: { fontSize: 12, color: "#e6edf3", fontWeight: "600" },
  eventMeta: { fontSize: 10, color: "#8b949e", marginTop: 2 },
  empty: { color: "#8b949e", fontSize: 12, textAlign: "center", paddingVertical: 20 },
});
