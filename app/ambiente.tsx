import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  Image, Dimensions, Switch, Alert, Modal, Pressable
} from 'react-native';
import { 
  ArrowLeft, Bell, Thermometer, Droplets, Atom, Wind, Snowflake, X, User, LogOut, ChevronRight
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { LineChart } from "react-native-chart-kit";

// --- FIREBASE CONFIG ---
import { auth, db } from '../services/firebaseConfig';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  query, 
  where, 
  collectionGroup, 
  getDocs,
  orderBy,
  limit
} from "firebase/firestore";

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png');

export default function AmbienteDetalhes() {
  const router = useRouter();
  
  const params = useLocalSearchParams<{ id: string; nome: string; empresa: string }>();
  const { id, nome, empresa } = params;
  
  const [tab, setTab] = useState<'historico' | 'perifericos'>('historico');
  const [loadingPeriferico, setLoadingPeriferico] = useState(false);
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  
  const [userData, setUserData] = useState({ nome: 'Usuário', email: '', iniciais: 'US' });
  const [sensores, setSensores] = useState({ temperatura: '--', umidade: '--', co2: '--', indice_geral: 0, particulas: '--' });
  const [caracteristicas, setCaracteristicas] = useState({ tipo: 'Tipo', andar: 'Localização' });
  const [periferico, setPeriferico] = useState({ nome: '', tipo: 'Ar Condicionado', marca: '--', status: false, docId: '' });

  // Estado para armazenar os dados do histórico para os gráficos
  const [historyData, setHistoryData] = useState({
    labels: ["00:00"],
    temps: [0],
    umids: [0],
    co2s: [0],
    arQualidade: [0]
  });

  // Lógica do Gráfico Circular
  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (sensores.indice_geral / 100) * circumference;

  useEffect(() => {
    // Listener de Autenticação
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userQuery = query(collectionGroup(db, 'usuarios'), where('userId', '==', user.uid));
          const userSnapshot = await getDocs(userQuery);
          if (!userSnapshot.empty) {
            const data = userSnapshot.docs[0].data();
            const nomeEncontrado = data.userName || "Usuário";
            const partes = nomeEncontrado.trim().split(/\s+/);
            const iniciais = (partes[0][0] + (partes.length > 1 ? partes[1][0] : '')).toUpperCase();
            setUserData({ nome: nomeEncontrado, email: user.email || "", iniciais });
          }
        } catch (e) { console.error("Erro User Auth:", e); }
      }
    });

    if (!id || !empresa || !db) return;

    // 1. Listener do Ambiente (Dados Atuais)
    const ambRef = doc(db, "empresas", String(empresa), "ambientes", String(id));
    const unsubAmbiente = onSnapshot(ambRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        const s = d.sensores || {};
        setSensores({
          temperatura: s.temperatura ?? '--',
          umidade: s.umidade ?? '--',
          co2: s.co2 ?? '--',
          indice_geral: d.indice_conforto || s.indice_geral || 0,
          particulas: s.particulas ?? '--'
        });
        setCaracteristicas({
          tipo: d.tipo || 'Tipo',
          andar: d.andar || 'Localização'
        });
      }
    }, (error) => console.error("Erro Snapshot Ambiente:", error));

    // 2. Listener do Histórico (Para os Gráficos)
    const histRef = collection(db, "empresas", String(empresa), "ambientes", String(id), "historico");
    // Busca os últimos 5 registros ordenados pelo mais recente
    const qHist = query(histRef, orderBy("timestamp", "desc"), limit(5));
    
    const unsubHistorico = onSnapshot(qHist, (snap) => {
      const labels: string[] = [];
      const temps: number[] = [];
      const umids: number[] = [];
      const co2s: number[] = [];
      const arQualidade: number[] = [];

      // Inverte o array para que o gráfico fique em ordem cronológica (da esquerda para direita)
      const docs = snap.docs.reverse();

      docs.forEach(docSnap => {
        const data = docSnap.data();
        
        // Tenta converter o timestamp para pegar a hora
        let timeStr = "--:--";
        if (data.timestamp) {
          const dateObj = new Date(data.timestamp);
          const hh = dateObj.getHours().toString().padStart(2, '0');
          const mm = dateObj.getMinutes().toString().padStart(2, '0');
          timeStr = `${hh}:${mm}`;
        }

        labels.push(timeStr);
        temps.push(data.temperatura || 0);
        umids.push(data.umidade || 0);
        co2s.push(data.co2 || 0);
        arQualidade.push(data.qualidade_ar || data.particulas || 0);
      });

      // Se não houver dados, colocamos valores zerados para o gráfico não quebrar
      if (labels.length === 0) {
        setHistoryData({ labels: ["00:00"], temps: [0], umids: [0], co2s: [0], arQualidade: [0] });
      } else {
        setHistoryData({ labels, temps, umids, co2s, arQualidade });
      }
    }, (error) => console.error("Erro Snapshot Histórico:", error));

    // 3. Listener dos Periféricos
    const perRef = collection(db, "empresas", String(empresa), "ambientes", String(id), "perifericos");
    const unsubPerifericos = onSnapshot(perRef, (snap) => {
      if (!snap.empty) {
        const firstDoc = snap.docs[0];
        const pData = firstDoc.data();
        setPeriferico({
          nome: firstDoc.id.replace(/_/g, ' '),
          tipo: pData.tipo || 'Dispositivo',
          marca: pData.marca || '--',
          status: pData.status || false,
          docId: firstDoc.id 
        });
      } else {
        setPeriferico({ nome: '', tipo: '', marca: '', status: false, docId: '' });
      }
    }, (error) => console.error("Erro Snapshot Perifericos:", error));

    return () => {
      unsubscribeAuth();
      unsubAmbiente();
      unsubHistorico();
      unsubPerifericos();
    };
  }, [id, empresa]);

  const handleLogout = async () => {
    await signOut(auth);
    setIsProfileVisible(false);
    router.replace('/');
  };

  const toggleSwitch = async () => {
    if (loadingPeriferico || !periferico.docId || !empresa || !id || !db) return;
    
    setLoadingPeriferico(true);
    const novoStatus = !periferico.status;
    
    try {
      const perDocRef = doc(db, "empresas", String(empresa), "ambientes", String(id), "perifericos", periferico.docId);
      await updateDoc(perDocRef, { status: novoStatus });
    } catch (e) { 
      console.error("Erro ao atualizar status:", e);
      Alert.alert("Erro", "Não foi possível alterar o estado do dispositivo."); 
    } finally { 
      setLoadingPeriferico(false); 
    }
  };

  const getConfortoColor = (val: number) => val >= 80 ? '#10B981' : val >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.topAppBar}>
        <Image source={LogoImg} style={styles.topLogo} resizeMode="contain" />
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBadge} onPress={() => router.push('/notificacao')}>
            <Bell color="#000" size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarCircle} onPress={() => setIsProfileVisible(true)}>
            <Text style={styles.avatarText}>{userData.iniciais}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* TÍTULO E VOLTAR */}
        <View style={styles.titleSection}>
          <TouchableOpacity onPress={() => router.back()}><ArrowLeft color="#000" size={32} /></TouchableOpacity>
          <View>
            <Text style={styles.envName}>{nome || 'Ambiente'}</Text>
            <Text style={styles.envSub}>{caracteristicas.tipo} • {caracteristicas.andar}</Text>
          </View>
        </View>

        {/* CARDS DE MÉTRICAS */}
        <View style={styles.metricsGrid}>
          <MetricCard label="Temperatura" value={sensores.temperatura} unit="°C" icon={<Thermometer color="#FFF" size={24} />} iconBg="#2563EB" />
          <MetricCard label="Umidade" value={sensores.umidade} unit="%" icon={<Droplets color="#FFF" size={24} />} iconBg="#2563EB" />
          <MetricCard label="CO₂" value={sensores.co2} unit="ppm" icon={<Atom color="#FFF" size={24} />} iconBg="#2563EB" />
          <MetricCard label="Partículas" value={sensores.particulas} unit="µg/m²" icon={<Wind color="#FFF" size={24} />} iconBg="#2563EB" />
        </View>

        {/* GRÁFICO CIRCULAR DE CONFORTO */}
        <View style={[styles.cardMain, { marginTop: 25 }]}>
          <Text style={styles.cardTitle}>Índice de Conforto</Text>
          <View style={styles.gaugeContainer}>
            <Svg width="140" height="140" viewBox="0 0 140 140">
              <Circle cx="70" cy="70" r={radius} stroke="#F1F5F9" strokeWidth="12" fill="none" />
              <Circle
                cx="70" cy="70" r={radius}
                stroke={getConfortoColor(sensores.indice_geral)}
                strokeWidth="12" fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90, 70, 70)"
              />
            </Svg>
            <View style={styles.gaugeTextContainer}>
              <Text style={styles.gaugeValue}>{sensores.indice_geral}</Text>
            </View>
          </View>
          <Text style={[styles.statusMain, { color: getConfortoColor(sensores.indice_geral) }]}>
            {sensores.indice_geral >= 80 ? 'Excelente' : 'Regular'}
          </Text>
          <Text style={styles.statusDetail}>Baseado em temperatura, umidade, CO₂ e qualidade do ar</Text>
        </View>

        {/* TABS CONTROLS */}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabItem, tab === 'historico' && styles.tabActive]} onPress={() => setTab('historico')}>
            <Text style={[styles.tabText, tab === 'historico' && styles.tabTextActive]}>Histórico</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, tab === 'perifericos' && styles.tabActive]} onPress={() => setTab('perifericos')}>
            <Text style={[styles.tabText, tab === 'perifericos' && styles.tabTextActive]}>Periféricos</Text>
          </TouchableOpacity>
        </View>

        {/* CONTEÚDO DAS TABS */}
        {tab === 'historico' ? (
          <View>
            {/* GRÁFICO 1: TEMPERATURA E UMIDADE */}
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle}>Histórico de Temperatura e Umidade</Text>
              <LineChart
                data={{
                  labels: historyData.labels,
                  datasets: [
                    { data: historyData.temps, color: () => `#EF4444`, strokeWidth: 3 }, // Vermelho - Temp
                    { data: historyData.umids, color: () => `#3B82F6`, strokeWidth: 3 }  // Azul - Umi
                  ]
                }}
                width={width - 80}
                height={180}
                chartConfig={chartConfig}
                bezier
                style={styles.chartStyle}
              />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#EF4444'}]} /><Text style={styles.legendText}>Temperatura</Text></View>
                <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#3B82F6'}]} /><Text style={styles.legendText}>Umidade</Text></View>
              </View>
            </View>

            {/* GRÁFICO 2: CO2 E QUALIDADE DO AR (Novo Gráfico) */}
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle}>Histórico de CO₂ e Partículas</Text>
              <LineChart
                data={{
                  labels: historyData.labels,
                  datasets: [
                    { data: historyData.co2s, color: () => `#A855F7`, strokeWidth: 3 }, // Roxo - CO2
                    { data: historyData.arQualidade, color: () => `#10B981`, strokeWidth: 3 }  // Verde - Partículas/AR
                  ]
                }}
                width={width - 80}
                height={180}
                chartConfig={chartConfig}
                bezier
                style={styles.chartStyle}
              />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#A855F7'}]} /><Text style={styles.legendText}>CO₂</Text></View>
                <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#10B981'}]} /><Text style={styles.legendText}>Partículas</Text></View>
              </View>
            </View>
          </View>
        ) : (
          periferico.nome !== '' ? (
            <View style={styles.peripheralCard}>
              <View style={styles.peripheralHeader}>
                <View style={styles.peripheralIconBox}><Snowflake color="#06B6D4" size={24} /></View>
                <View style={{flex: 1, marginLeft: 12}}>
                  <Text style={styles.peripheralTitle}>{periferico.nome}</Text>
                  <Text style={styles.peripheralSubtitle}>{periferico.tipo}</Text>
                </View>
                <Switch 
                  trackColor={{ false: "#E2E8F0", true: "#0EA5E9" }} 
                  thumbColor="#FFF" 
                  onValueChange={toggleSwitch} 
                  value={periferico.status} 
                  disabled={loadingPeriferico} 
                />
              </View>
              <View style={styles.cardSeparator} />
              <Text style={styles.footerBrand}>{periferico.marca}</Text>
              <Text style={styles.footerStatus}>Status do periférico</Text>
            </View>
          ) : (
            <Text style={{textAlign: 'center', color: '#94A3B8', marginTop: 20}}>Nenhum periférico encontrado.</Text>
          )
        )}
      </ScrollView>

      {/* MODAL PERFIL */}
      <Modal animationType="fade" transparent visible={isProfileVisible} onRequestClose={() => setIsProfileVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsProfileVisible(false)} />
          <View style={styles.profileSheet}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileTitle}>Perfil</Text>
              <TouchableOpacity onPress={() => setIsProfileVisible(false)}><X color="#94A3B8" size={30} /></TouchableOpacity>
            </View>
            <View style={styles.profileUserInfo}>
              <View style={styles.largeAvatar}><Text style={styles.largeAvatarText}>{userData.iniciais}</Text></View>
              <Text style={styles.userName}>{userData.nome}</Text>
              <Text style={styles.userEmail}>{userData.email}</Text>
            </View>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.configItem} onPress={() => { setIsProfileVisible(false); router.push('/profile'); }}>
              <View style={styles.configItemLeft}>
                <View style={styles.configIconBox}><User color="#1E293B" size={22} /></View>
                <View><Text style={styles.configItemTitle}>Minha Conta</Text><Text style={styles.configItemSub}>Dados Pessoais</Text></View>
              </View>
              <ChevronRight color="#1E293B" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSignOut, { marginTop: 25 }]} onPress={handleLogout}>
              <LogOut color="#EF4444" size={20} /><Text style={styles.btnSignOutText}>Sair da conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

const chartConfig = {
  backgroundGradientFrom: "#FFF",
  backgroundGradientTo: "#FFF",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  propsForDots: { r: "4", strokeWidth: "2", stroke: "#FFF" },
  fillShadowGradientOpacity: 0,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topAppBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, backgroundColor: '#FFF', height: 90 },
  topLogo: { width: 140, height: 90 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBadge: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 100 },
  titleSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 15 },
  envName: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  envSub: { fontSize: 14, color: '#64748B' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  mCard: { backgroundColor: '#FFF', width: (width / 2) - 26, borderRadius: 24, padding: 16, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  mIconCircle: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  mLabel: { fontSize: 13, color: '#64748B' },
  mValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  mValue: { fontSize: 26, fontWeight: 'bold', color: '#1E293B' },
  mUnit: { fontSize: 12, color: '#94A3B8' },
  cardMain: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', elevation: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', alignSelf: 'flex-start', marginBottom: 20 },
  gaugeContainer: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gaugeTextContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  gaugeValue: { fontSize: 34, fontWeight: 'bold', color: '#1E293B' },
  statusMain: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  statusDetail: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 5, lineHeight: 18 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginVertical: 20 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#FFF', elevation: 2 },
  tabText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  tabTextActive: { color: '#1E293B' },
  chartStyle: { marginVertical: 10, borderRadius: 16, marginLeft: -10 },
  legendRow: { flexDirection: 'row', gap: 20, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#64748B' },
  peripheralCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, elevation: 3 },
  peripheralHeader: { flexDirection: 'row', alignItems: 'center' },
  peripheralIconBox: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#E0F7FA', justifyContent: 'center', alignItems: 'center' },
  peripheralTitle: { fontSize: 18, fontWeight: 'bold' },
  peripheralSubtitle: { fontSize: 13, color: '#64748B' },
  cardSeparator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  footerBrand: { fontSize: 15, fontWeight: 'bold' },
  footerStatus: { fontSize: 12, color: '#94A3B8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  modalBackdrop: { flex: 0.2 },
  profileSheet: { flex: 0.8, backgroundColor: '#FFF', padding: 24, paddingTop: 60, borderTopLeftRadius: 30, borderBottomLeftRadius: 30 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  profileTitle: { fontSize: 24, fontWeight: 'bold' },
  profileUserInfo: { alignItems: 'center', marginBottom: 20 },
  largeAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1E57A3', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  largeAvatarText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  userEmail: { fontSize: 14, color: '#64748B' },
  separator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
  configItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  configItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  configIconBox: { width: 48, height: 48, backgroundColor: '#F8FAFC', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  configItemTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  configItemSub: { fontSize: 12, color: '#94A3B8' },
  btnSignOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#EF4444', borderRadius: 16, height: 56 },
  btnSignOutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16 }
});