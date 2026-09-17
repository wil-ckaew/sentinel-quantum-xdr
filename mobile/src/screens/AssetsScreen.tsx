// mobile/src/screens/AssetsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { fetchAssets, updateAssetStatus, Asset, relativeTime } from "../services/api";
import { StatusBadge } from "../components/Badges";

export function AssetsScreen() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function load() {
    setRefreshing(true);
    const data = await fetchAssets();
    setAssets(data);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  async function toggle(asset: Asset) {
    const isIsolated = (asset.status || "").toLowerCase() === "isolated";
    const next = isIsolated ? "active" : "isolated";

    Alert.alert(
      isIsolated ? "Reativar host" : "Isolar host",
      `Confirma ${next === "active" ? "reativar" : "isolar"} ${asset.hostname}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          style: isIsolated ? "default" : "destructive",
          onPress: async () => {
            setBusy((prev) => new Set(prev).add(asset.id));
            const updated = await updateAssetStatus(asset.id, next);
            if (updated) {
              setAssets((prev) =>
                prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
              );
            } else {
              Alert.alert("Erro", "Falha ao atualizar o asset.");
            }
            setBusy((prev) => {
              const s = new Set(prev);
              s.delete(asset.id);
              return s;
            });
          },
        },
      ]
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={assets}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#58a6ff" />}
      ListEmptyComponent={<Text style={styles.empty}>Nenhum asset registrado</Text>}
      renderItem={({ item }) => {
        const isIsolated = (item.status || "").toLowerCase() === "isolated";
        const isBusy = busy.has(item.id);

        return (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.host}>{item.hostname}</Text>
              <Text style={styles.meta}>
                {item.ip_address || "—"} · {item.operating_system || "—"}
              </Text>
              <View style={styles.badgeRow}>
                <StatusBadge status={item.status} />
                <Text style={styles.meta}>
                  risk {item.risk_score ?? 0}
                </Text>
              </View>
              {item.updated_at && (
                <Text style={styles.meta}>{relativeTime(item.updated_at)}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.btn,
                isIsolated ? styles.btnActivate : styles.btnIsolate,
                isBusy && styles.btnBusy,
              ]}
              onPress={() => toggle(item)}
              disabled={isBusy}
            >
              <Text style={styles.btnText}>
                {isBusy ? "..." : isIsolated ? "REATIVAR" : "ISOLAR"}
              </Text>
            </TouchableOpacity>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  host: { fontSize: 13, fontWeight: "700", color: "#e6edf3", fontFamily: "monospace" },
  meta: { fontSize: 11, color: "#8b949e", marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  btnIsolate: { backgroundColor: "#3d0f18", borderWidth: 1, borderColor: "#ff6b81" },
  btnActivate: { backgroundColor: "#0d2f1a", borderWidth: 1, borderColor: "#34d399" },
  btnBusy: { opacity: 0.5 },
  btnText: { color: "#ffffff", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  empty: { color: "#8b949e", textAlign: "center", marginTop: 40, fontSize: 13 },
});
