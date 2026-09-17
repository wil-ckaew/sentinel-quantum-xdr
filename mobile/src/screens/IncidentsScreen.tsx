// mobile/src/screens/IncidentsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { fetchIncidents, Incident, relativeTime } from "../services/api";
import { SeverityBadge, MitreTag, VerdictBadge } from "../components/Badges";

export function IncidentsScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    const data = await fetchIncidents();
    setIncidents(data);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <FlatList
      style={styles.container}
      data={incidents}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#58a6ff" />}
      ListEmptyComponent={<Text style={styles.empty}>Nenhum incidente</Text>}
      renderItem={({ item }) => {
        const mitre = item.metadata?.mitre;
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <VerdictBadge verdict="malicious" />
            </View>
            <View style={styles.metaRow}>
              <SeverityBadge severity={item.severity} />
              {mitre?.technique_id && <MitreTag techniqueId={mitre.technique_id} />}
              <Text style={styles.metaText}>{relativeTime(item.detected_at)}</Text>
            </View>
            {item.metadata?.hostname && (
              <Text style={styles.hostText}>host: {item.metadata.hostname}</Text>
            )}
            {item.metadata?.playbook && (
              <Text style={styles.playbook}>SOAR: {item.metadata.playbook}</Text>
            )}
            {mitre?.confidence !== undefined && (
              <View style={styles.confidenceRow}>
                <Text style={styles.metaText}>confiança</Text>
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${mitre.confidence}%`,
                        backgroundColor:
                          mitre.confidence >= 90
                            ? "#ff6b81"
                            : mitre.confidence >= 70
                            ? "#fbbf24"
                            : "#60a5fa",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.metaText}>{mitre.confidence}%</Text>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117" },
  card: {
    backgroundColor: "#161b22",
    borderWidth: 1,
    borderColor: "#30363d",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 13, fontWeight: "700", color: "#e6edf3", flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  metaText: { fontSize: 11, color: "#8b949e" },
  hostText: { fontSize: 11, color: "#8b949e", marginTop: 6, fontFamily: "monospace" },
  playbook: {
    fontSize: 11,
    color: "#34d399",
    marginTop: 6,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  confidenceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: "#1b3552",
    borderRadius: 2,
    overflow: "hidden",
  },
  confidenceFill: { height: "100%" },
  empty: { color: "#8b949e", textAlign: "center", marginTop: 40, fontSize: 13 },
});
