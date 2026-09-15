import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  StatusBar,
  DimensionValue,
} from 'react-native';
import { getBackendStatus, fetchAssets, fetchEvents, fetchIncidents, executeSoarIsolate, sendAttackSimulation } from './src/services/api';

interface Asset {
  id: string;
  hostname: string;
  ip_address?: string;
  status?: string;
}

function ThreatSurface({ eventCount, criticalCount, highCount }: { eventCount: number; criticalCount: number; highCount: number }) {
  const nodes = [
    { label: 'N. America', left: '18%' as DimensionValue, top: '45%' as DimensionValue, color: '#fb7185', value: criticalCount },
    { label: 'Europe', left: '43%' as DimensionValue, top: '37%' as DimensionValue, color: '#fbbf24', value: highCount },
    { label: 'Middle East', left: '59%' as DimensionValue, top: '55%' as DimensionValue, color: '#38bdf8', value: eventCount },
    { label: 'East Asia', left: '77%' as DimensionValue, top: '45%' as DimensionValue, color: '#fb7185', value: criticalCount + highCount },
  ];

  return (
    <View style={styles.mapPanel}>
      <View style={styles.mapHeader}>
        <Text style={styles.sectionTitle}>Global threat surface</Text>
        <Text style={styles.liveLabel}>LIVE</Text>
      </View>
      <View style={styles.mapCanvas}>
        <View style={styles.mapGrid} />
        <View style={styles.continentNorth} />
        <View style={styles.continentEurasia} />
        <View style={styles.continentSouth} />
        {nodes.map((node) => (
          <View key={node.label} style={[styles.mapNode, { left: node.left, top: node.top }]}>
            <View style={[styles.mapPulse, { backgroundColor: node.color }]} />
            <View style={[styles.mapDot, { backgroundColor: node.color }]} />
            <Text style={styles.mapNodeLabel}>{node.label} {node.value}</Text>
          </View>
        ))}
        <Text style={styles.mapSignals}>{eventCount.toString().padStart(2, '0')} signals / 10 min</Text>
      </View>
      <Text style={styles.mapNote}>Regional visualization from current security telemetry</Text>
    </View>
  );
}

export default function App() {
  const [status, setStatus] = useState<string>('Carregando...');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const criticalCount = events.filter((event) => event.severity?.toLowerCase() === 'critical').length;
  const highCount = events.filter((event) => event.severity?.toLowerCase() === 'high').length;

  const loadData = async () => {
    setRefreshing(true);
    const health = await getBackendStatus();
    const assetList = await fetchAssets();
    const incidentList = await fetchIncidents();
    const eventList = await fetchEvents();
    setStatus(health);
    setAssets(assetList);
    setIncidents(incidentList);
    setEvents(eventList);
    setRefreshing(false);
  };

  const simulate = async (eventType: string) => {
    const success = await sendAttackSimulation(eventType);
    Alert.alert(success ? 'Evento enviado' : 'Falha', success ? `${eventType} encaminhado para detecção.` : 'Gateway indisponível.');
    if (success) loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleIsolate = (id: string, hostname: string) => {
    Alert.alert(
      'Ação SOAR de Emergência',
      `Deseja isolar o ativo ${hostname} da rede imediatamente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Isolar Agora',
          style: 'destructive',
          onPress: async () => {
            const success = await executeSoarIsolate(id);
            if (success) {
              Alert.alert('Sucesso', `Ativo ${hostname} isolado.`);
              loadData();
            } else {
              Alert.alert('Erro', 'Falha ao executar ordem SOAR.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>SENTINEL XDR</Text>
        <Text style={styles.subtitle}>SOC Operational Mobile Console</Text>
      </View>

      {/* Cards de Métricas */}
      <View style={styles.metricsContainer}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status Core</Text>
          <Text style={styles.cardValue}>{status.includes('Online') ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ativos Monit.</Text>
          <Text style={styles.cardValue}>{assets.length}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Incidentes</Text>
          <Text style={styles.cardValue}>{incidents.filter((item) => item.status !== 'resolved').length}</Text>
        </View>
      </View>

      <ThreatSurface eventCount={events.length} criticalCount={criticalCount} highCount={highCount} />

      <Text style={styles.sectionTitle}>Simular telemetria</Text>
      <View style={styles.attackGrid}>
        {['PHISHING_CAMPAIGN', 'BRUTE_FORCE_LOGIN', 'DATA_EXFILTRATION', 'LATERAL_MOVEMENT', 'MALWARE_DETECTED', 'IDENTITY_TOKEN_THEFT'].map((eventType) => (
          <TouchableOpacity key={eventType} style={styles.attackButton} onPress={() => simulate(eventType)}>
            <Text style={styles.attackText}>{eventType.replaceAll('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista de Ativos com Ação SOAR */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ativos em Monitoramento</Text>
        <TouchableOpacity onPress={loadData}>
          <Text style={styles.refreshText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={loadData}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum ativo listado ou backend offline.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.assetCard}>
            <View>
              <Text style={styles.assetHost}>{item.hostname}</Text>
              <Text style={styles.assetIp}>{item.ip_address || 'IP Não Informado'}</Text>
              <Text style={[styles.assetStatus, item.status === 'ISOLATED' ? styles.isolated : styles.active]}>
                Status: {item.status || 'ACTIVE'}
              </Text>
            </View>
            {item.status !== 'ISOLATED' && (
              <TouchableOpacity
                style={styles.isolateButton}
                onPress={() => handleIsolate(item.id, item.hostname)}
              >
                <Text style={styles.buttonText}>ISOLAR</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListFooterComponent={
          <View style={styles.eventsPanel}>
            <Text style={styles.sectionTitle}>Últimos eventos</Text>
            {events.slice(0, 5).map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <Text style={styles.eventType}>{event.event_type.replaceAll('_', ' ')}</Text>
                <Text style={styles.eventMeta}>{event.source} · {event.severity}</Text>
              </View>
            ))}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingHorizontal: 16 },
  header: { marginTop: 20, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#58a6ff', letterSpacing: 1 },
  subtitle: { fontSize: 12, color: '#8b949e' },
  metricsContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  card: { flex: 1, backgroundColor: '#161b22', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#30363d' },
  cardTitle: { fontSize: 11, color: '#8b949e', textTransform: 'uppercase' },
  cardValue: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#c9d1d9' },
  refreshText: { fontSize: 12, color: '#58a6ff' },
  assetCard: { backgroundColor: '#161b22', padding: 14, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#30363d' },
  assetHost: { fontSize: 15, fontWeight: 'bold', color: '#ffffff' },
  assetIp: { fontSize: 12, color: '#8b949e', marginTop: 2 },
  assetStatus: { fontSize: 11, marginTop: 4, fontWeight: 'bold' },
  active: { color: '#2ea043' },
  isolated: { color: '#f85149' },
  isolateButton: { backgroundColor: '#f85149', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  buttonText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  emptyText: { color: '#8b949e', textAlign: 'center', marginTop: 30, fontSize: 13 },
  attackGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  attackButton: { backgroundColor: '#12304a', borderWidth: 1, borderColor: '#245175', paddingVertical: 9, paddingHorizontal: 10, borderRadius: 5 },
  attackText: { color: '#7cc7ff', fontSize: 10, fontWeight: '700' },
  eventsPanel: { marginTop: 18, paddingBottom: 30 },
  mapPanel: { marginBottom: 18, backgroundColor: '#0b1724', borderWidth: 1, borderColor: '#24405d', padding: 12 },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveLabel: { color: '#34d399', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  mapCanvas: { height: 190, overflow: 'hidden', backgroundColor: '#061321', position: 'relative' },
  mapGrid: { ...StyleSheet.absoluteFill, opacity: 0.35, borderWidth: 1, borderColor: '#153550' },
  continentNorth: { position: 'absolute', left: '7%', top: '22%', width: '28%', height: '27%', backgroundColor: '#0d2a41', borderRadius: 28, transform: [{ rotate: '-12deg' }] },
  continentEurasia: { position: 'absolute', left: '40%', top: '22%', width: '48%', height: '30%', backgroundColor: '#0d2a41', borderRadius: 30, transform: [{ rotate: '7deg' }] },
  continentSouth: { position: 'absolute', left: '25%', top: '56%', width: '13%', height: '29%', backgroundColor: '#0d2a41', borderRadius: 20, transform: [{ rotate: '18deg' }] },
  mapNode: { position: 'absolute', width: 12, height: 12 },
  mapPulse: { position: 'absolute', width: 18, height: 18, left: -3, top: -3, borderRadius: 12, opacity: 0.25 },
  mapDot: { width: 10, height: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fff' },
  mapNodeLabel: { position: 'absolute', left: 15, top: -2, width: 90, color: '#9fb2c4', fontSize: 9 },
  mapSignals: { position: 'absolute', right: 8, bottom: 8, color: '#536b7e', fontSize: 9 },
  mapNote: { color: '#6f8495', fontSize: 9, marginTop: 7 },
  eventRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f2933' },
  eventType: { color: '#e6edf3', fontSize: 12, fontWeight: '600' },
  eventMeta: { color: '#8b949e', fontSize: 10, marginTop: 3 },
});
