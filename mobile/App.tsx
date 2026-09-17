// mobile/App.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { EventsScreen } from "./src/screens/EventsScreen";
import { IncidentsScreen } from "./src/screens/IncidentsScreen";
import { AssetsScreen } from "./src/screens/AssetsScreen";

type Tab = "dashboard" | "events" | "incidents" | "assets";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "events", label: "Eventos" },
  { key: "incidents", label: "Incidentes" },
  { key: "assets", label: "Ativos" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>SENTINEL XDR</Text>
        <Text style={styles.subtitle}>SOC Mobile Console</Text>
      </View>

      {/* Screen */}
      <View style={styles.screen}>
        {tab === "dashboard" && <DashboardScreen />}
        {tab === "events" && <EventsScreen />}
        {tab === "incidents" && <IncidentsScreen />}
        {tab === "assets" && <AssetsScreen />}
      </View>

      {/* Bottom tabs */}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d1117" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#30363d",
  },
  title: { fontSize: 18, fontWeight: "800", color: "#58a6ff", letterSpacing: 1.5 },
  subtitle: { fontSize: 11, color: "#8b949e", marginTop: 2 },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#30363d",
    backgroundColor: "#161b22",
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderTopWidth: 2, borderTopColor: "#0a6cff" },
  tabText: { fontSize: 11, fontWeight: "600", color: "#8b949e" },
  tabTextActive: { color: "#58a6ff" },
});
