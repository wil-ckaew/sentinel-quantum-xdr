// mobile/src/screens/EventsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { fetchEvents, SecurityEvent, relativeTime, verdictOf } from "../services/api";
import { VerdictBadge, SeverityBadge, MitreTag } from "../components/Badges";

type Filter = "all" | "malicious" | "suspicious" | "benign";

export function EventsScreen() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  async function load() {
    setRefreshing(true);
    const data = await fetchEvents(100);
    setEvents(data);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const filtered =
    filter === "all" ? events : events.filter((e) => verdictOf(e) === filter);

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        {(["all", "malicious", "suspicious", "benign"] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#58a6ff" />}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum evento</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.eventType}>{item.event_type}</Text>
              <VerdictBadge verdict={verdictOf(item)} />
            </View>
            <View style={styles.cardMeta}>
              <SeverityBadge severity={item.severity} />
              {item.technique_id && <MitreTag techniqueId={item.technique_id} />}
              <Text style={styles.metaText}>{relativeTime(item.created_at)}</Text>
            </View>
            {item.hostname && <Text style={styles.metaText}>host: {item.hostname}</Text>}
            {item.detection_source && (
              <Text style={styles.sourceText}>via {item.detection_source}</Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117" },
  filterBar: {
    flexDirection: "row",
    gap: 6,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#30363d",
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#30363d",
  },
  filterBtnActive: { backgroundColor: "#0a6cff", borderColor: "#0a6cff" },
  filterText: { fontSize: 10, fontWeight: "700", color: "#8b949e" },
  filterTextActive: { color: "#ffffff" },
  card: {
    backgroundColor: "#161b22",
    borderWidth: 1,
    borderColor: "#30363d",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventType: { fontSize: 13, fontWeight: "700", color: "#e6edf3", flex: 1 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  metaText: { fontSize: 11, color: "#8b949e", marginTop: 4 },
  sourceText: { fontSize: 10, color: "#7cc7ff", marginTop: 4, fontFamily: "monospace" },
  empty: { color: "#8b949e", textAlign: "center", marginTop: 40, fontSize: 13 },
});
