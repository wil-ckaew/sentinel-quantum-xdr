// mobile/src/components/Badges.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

// =============================================================================
// VerdictBadge
// =============================================================================

export function VerdictBadge({ verdict }: { verdict: "benign" | "suspicious" | "malicious" | string }) {
  const v = verdict.toLowerCase();
  const config =
    v === "malicious"
      ? { bg: "#3d0f18", fg: "#ff6b81", label: "MALICIOUS" }
      : v === "suspicious"
      ? { bg: "#3d2a0a", fg: "#fbbf24", label: "SUSPICIOUS" }
      : { bg: "#0d2f1a", fg: "#34d399", label: "BENIGN" };

  return (
    <View style={[styles.pill, { backgroundColor: config.bg, borderColor: config.fg }]}>
      <Text style={[styles.pillText, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

// =============================================================================
// SeverityBadge
// =============================================================================

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  const config =
    s === "critical"
      ? { bg: "#3d0f18", fg: "#ff6b81" }
      : s === "high"
      ? { bg: "#3d1a0a", fg: "#ff9057" }
      : s === "medium"
      ? { bg: "#3d2a0a", fg: "#fbbf24" }
      : s === "low"
      ? { bg: "#0a1f3d", fg: "#60a5fa" }
      : { bg: "#1f1f1f", fg: "#9ca3af" };

  return (
    <View style={[styles.pillSmall, { backgroundColor: config.bg, borderColor: config.fg }]}>
      <Text style={[styles.pillTextSmall, { color: config.fg }]}>{s.toUpperCase()}</Text>
    </View>
  );
}

// =============================================================================
// MitreTag
// =============================================================================

export function MitreTag({ techniqueId }: { techniqueId?: string }) {
  if (!techniqueId) return null;
  return (
    <View style={styles.mitreTag}>
      <Text style={styles.mitreText}>{techniqueId}</Text>
    </View>
  );
}

// =============================================================================
// StatusBadge (assets)
// =============================================================================

export function StatusBadge({ status }: { status?: string }) {
  const s = (status || "active").toLowerCase();
  const config =
    s === "isolated"
      ? { bg: "#3d0f18", fg: "#ff6b81", label: "ISOLATED" }
      : s === "quarantined"
      ? { bg: "#3d2a0a", fg: "#fbbf24", label: "QUARANTINED" }
      : { bg: "#0d2f1a", fg: "#34d399", label: "ACTIVE" };

  return (
    <View style={[styles.pillSmall, { backgroundColor: config.bg, borderColor: config.fg }]}>
      <Text style={[styles.pillTextSmall, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  pillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  pillTextSmall: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  mitreTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#0a1f3d",
    borderWidth: 1,
    borderColor: "#245175",
    alignSelf: "flex-start",
  },
  mitreText: { fontSize: 10, fontWeight: "600", color: "#7cc7ff", fontFamily: "monospace" },
});
