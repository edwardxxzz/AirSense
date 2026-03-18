import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Switch,
  ActivityIndicator,
  Alert
} from 'react-native';
import { 
  ArrowLeft, Bell, Thermometer, Droplets, Atom, Wind, Snowflake
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ref, onValue, update } from "firebase/database";
import { auth, database } from '../services/firebaseConfig';

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png');

export default function AmbienteDetalhes() {
  const router = useRouter();
  // Captura os dados passados pela AmbientesScreen
  const { id, nome, empresa } = useLocalSearchParams(); 
  
  const [tab, setTab] = useState<'historico' | 'perifericos'>('perifericos'); // Iniciando em periféricos para teste
  const [loadingPeriferico, setLoadingPeriferico] = useState(false);
  
  // Estados linkados ao Firebase
  const [sensores, setSensores] = useState({
    temperatura: '--',
    umidade: '--',
    co2: '--',
    indice_geral: 0,
  });

  const [caracteristicas, setCaracteristicas] = useState({
    tipo: 'Carregando...',
    andar: 'Carregando...'
  });

  const [periferico, setPeriferico] = useState({
    nome: 'Buscando...',
    tipo: 'Ar Condicionado',
    marca: '--',
    status: false,
    dbPath: ''
  });

  useEffect(() => {
    if (!id || !empresa) return;

    const pathBase = `empresas/${empresa}/ambientes/${id}`;
    
    // 1. Escuta Sensores (Mapeando as chaves com Letra Maiúscula do seu Firebase)
    const sensoresRef = ref(database, `${pathBase}/sensores`);
    const unsubSensores = onValue(sensoresRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setSensores({
          temperatura: data.Temperatura ?? '--',
          umidade: data.Umidade ?? '--',
          co2: data.CO2 ?? '--',
          indice_geral: data.indice_geral ?? 0,
        });
      }
    });

    // 2. Escuta Características (Ajustado para 'características' com acento)
    const charRef = ref(database, `${pathBase}/características`);
    const unsubChar = onValue(charRef, (snap) => {
      if (snap.exists()) {
        setCaracteristicas(snap.val());
      }
    });

    // 3. Escuta Periférico específico deste ambiente
    const periRef = ref(database, `${pathBase}/perifericos/ar_condicionado`);
    const unsubPeri = onValue(periRef, (snap) => {
        if (snap.exists()) {
            const data = snap.val();
            // Pega a primeira chave (ex: 'geral' ou o nome da marca)
            const firstKey = Object.keys(data)[0];
            const info = data[firstKey];
            
            setPeriferico({
                status: info.status ?? false,
                marca: info.marca ?? 'Genérico',
                tipo: 'Ar Condicionado',
                nome: firstKey.replace(/_/g, ' '),
                dbPath: `${pathBase}/perifericos/ar_condicionado/${firstKey}`
            });
        }
    });

    return () => { unsubSensores(); unsubChar(); unsubPeri(); };
  }, [id, empresa]);

  const toggleSwitch = async () => {
    if (loadingPeriferico || !periferico.dbPath) return;
    
    setLoadingPeriferico(true);
    const novoStatus = !periferico.status;

    // Delay de 10 segundos simulando processamento do hardware
    setTimeout(async () => {
      try {
        await update(ref(database, periferico.dbPath), { status: novoStatus });
      } catch (error) {
        Alert.alert("Erro", "Falha ao comunicar com o dispositivo.");
      } finally {
        setLoadingPeriferico(false);
      }
    }, 10000); 
  };

  const statusConforto = sensores.indice_geral >= 80 ? { label: 'Excelente', color: '#10B981' } : { label: 'Regular', color: '#F59E0B' };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAppBar}>
        <Image source={LogoImg} style={styles.topLogo} resizeMode="contain" />
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBadge}><Bell color="#000" size={24} /></TouchableOpacity>
          <TouchableOpacity style={styles.avatarCircle}><Text style={styles.avatarText}>US</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.titleSection}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#000" size={28} />
          </TouchableOpacity>
          <View>
            {/* Nome que veio do clique e características do Firebase */}
            <Text style={styles.envName}>{nome}</Text>
            <Text style={styles.envSub}>{caracteristicas.tipo} • {caracteristicas.andar}</Text>
          </View>
        </View>

        {/* Cards de Métricas Dinâmicos */}
        <View style={styles.metricsGrid}>
          <MetricCard label="Temperatura" value={sensores.temperatura} unit="°C" icon={<Thermometer color="#FFF" size={24} />} iconBg="#1E57A3" />
          <MetricCard label="Umidade" value={sensores.umidade} unit="%" icon={<Droplets color="#FFF" size={24} />} iconBg="#2563EB" />
          <MetricCard label="CO₂" value={sensores.co2} unit="ppm" icon={<Atom color="#FFF" size={24} />} iconBg="#2563EB" />
          <MetricCard label="Partículas" value="10.2" unit="µg/m²" icon={<Wind color="#FFF" size={24} />} iconBg="#2563EB" />
        </View>

        {/* Índice de Conforto */}
        <View style={styles.cardConforto}>
          <Text style={styles.cardTitle}>Índice de Conforto</Text>
          <View style={styles.chartContainer}>
            <View style={[styles.circleProgress, { borderColor: statusConforto.color }]}>
              <Text style={styles.progressValue}>{sensores.indice_geral}</Text>
            </View>
            <Text style={[styles.statusText, { color: statusConforto.color }]}>{statusConforto.label}</Text>
            <Text style={styles.statusDesc}>Baseado nos sensores de tempo real deste ambiente</Text>
          </View>
        </View>

        {/* Abas */}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabItem, tab === 'historico' && styles.tabActive]} onPress={() => setTab('historico')}>
            <Text style={[styles.tabText, tab === 'historico' && styles.tabTextActive]}>Histórico</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, tab === 'perifericos' && styles.tabActive]} onPress={() => setTab('perifericos')}>
            <Text style={[styles.tabText, tab === 'perifericos' && styles.tabTextActive]}>Periféricos</Text>
          </TouchableOpacity>
        </View>

        {/* Listagem de Periférico do Ambiente */}
        {tab === 'perifericos' && (
          <View style={styles.peripheralCard}>
             <View style={styles.peripheralHeader}>
                <View style={[styles.peripheralIconBox, {backgroundColor: '#E0F7FA'}]}>
                   <Snowflake color="#06B6D4" size={24} />
                </View>
                <View style={{flex: 1, marginLeft: 12}}>
                   <Text style={styles.peripheralTitle}>{periferico.nome}</Text>
                   <Text style={styles.peripheralSubtitle}>{periferico.tipo}</Text>
                </View>
                {loadingPeriferico && <ActivityIndicator size="small" color="#2563EB" />}
             </View>
             <View style={styles.cardSeparator} />
             <View style={styles.peripheralFooter}>
                <View>
                   <Text style={styles.footerBrand}>{periferico.marca}</Text>
                   <Text style={styles.footerStatus}>Status do periférico</Text>
                </View>
                <View style={styles.switchRow}>
                   <Text style={[styles.statusLabel, {color: periferico.status ? '#2563EB' : '#94A3B8'}]}>
                      {periferico.status ? 'Ligado' : 'Desligado'}
                   </Text>
                   <Switch 
                     trackColor={{ false: "#E2E8F0", true: "#DBEAFE" }} 
                     thumbColor={periferico.status ? "#2563EB" : "#94A3B8"}
                     onValueChange={toggleSwitch}
                     value={periferico.status}
                     disabled={loadingPeriferico}
                   />
                </View>
             </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, unit, icon, iconBg }: any) {
  return (
    <View style={styles.mCard}>
      <View style={[styles.mIconCircle, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.mLabel}>{label}</Text>
      <View style={styles.mValueRow}>
        <Text style={styles.mValue}>{value}</Text>
        <Text style={styles.mUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topAppBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 5, backgroundColor: '#FFF', height: 80 },
  topLogo: { width: 140, height: 90 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBadge: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 15 },
  titleSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, gap: 12 },
  backBtn: { padding: 4 },
  envName: { fontSize: 26, fontWeight: 'bold', color: '#1E293B' },
  envSub: { fontSize: 14, color: '#64748B' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  mCard: { backgroundColor: '#FFF', width: (width / 2) - 26, borderRadius: 24, padding: 16, elevation: 3 },
  mIconCircle: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  mLabel: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  mValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  mValue: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
  mUnit: { fontSize: 12, color: '#94A3B8' },
  cardConforto: { backgroundColor: '#FFF', borderRadius: 32, padding: 24, marginBottom: 20, alignItems: 'center', elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', alignSelf: 'flex-start', marginBottom: 20 },
  chartContainer: { alignItems: 'center' },
  circleProgress: { width: 150, height: 150, borderRadius: 75, borderWidth: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  progressValue: { fontSize: 48, fontWeight: 'bold', color: '#1E293B' },
  statusText: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  statusDesc: { fontSize: 12, color: '#64748B', textAlign: 'center', paddingHorizontal: 30 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 5, marginBottom: 20 },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#FFF', elevation: 2 },
  tabText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  tabTextActive: { color: '#1E293B', fontWeight: 'bold' },
  peripheralCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  peripheralHeader: { flexDirection: 'row', alignItems: 'center' },
  peripheralIconBox: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  peripheralTitle: { fontSize: 17, fontWeight: 'bold', color: '#1E293B' },
  peripheralSubtitle: { fontSize: 13, color: '#64748B' },
  cardSeparator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 18 },
  peripheralFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerBrand: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  footerStatus: { fontSize: 12, color: '#94A3B8' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusLabel: { fontSize: 14, fontWeight: 'bold' }
});