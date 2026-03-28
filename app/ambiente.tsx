import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  Image, Dimensions, Switch, Alert, Modal, Pressable
} from 'react-native';
import { 
  ArrowLeft, Bell, Thermometer, Droplets, Lightbulb, Snowflake, X, User, LogOut, ChevronRight, Calendar, Clock
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
  
  const [tab, setTab] = useState<'historico' | 'perifericos' | 'agendamentos'>('historico');
  const [loadingPeriferico, setLoadingPeriferico] = useState(false);
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  
  const [userData, setUserData] = useState({ nome: 'Usuário', email: '', iniciais: 'US' });
  const [sensores, setSensores] = useState({ temperatura: '--', umidade: '--', luminosidade: '--', indice_geral: 0 });
  const [caracteristicas, setCaracteristicas] = useState({ tipo: 'Tipo', andar: 'Localização' });
  
  const [perifericosList, setPerifericosList] = useState<any[]>([]);
  const [agendamentosList, setAgendamentosList] = useState<any[]>([]); // Estado para agendamentos

  const [historyData, setHistoryData] = useState({
    labels: ["00:00"],
    temps: [0],
    umids: [0],
    lumins: [0]
  });

  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (sensores.indice_geral / 100) * circumference;

  useEffect(() => {
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

    // --- DADOS DO AMBIENTE ---
    const ambRef = doc(db, "empresas", String(empresa), "ambientes", String(id));
    const unsubAmbiente = onSnapshot(ambRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setCaracteristicas({
          tipo: d.config?.tipo || d.tipo || 'Tipo',
          andar: d.config?.andar || d.andar || 'Localização'
        });
      }
    }, (error) => console.error("Erro Snapshot Ambiente:", error));

    // --- HISTÓRICO ---
    const histRef = collection(db, "empresas", String(empresa), "ambientes", String(id), "historico");
    const qHist = query(histRef, orderBy("timestamp", "desc"), limit(5));
    
    const unsubHistorico = onSnapshot(qHist, (snap) => {
      if (!snap.empty) {
        const maisRecente = snap.docs[0].data(); 
        setSensores({
          temperatura: maisRecente.temperatura ?? '--',
          umidade: maisRecente.umidade ?? '--',
          luminosidade: maisRecente.luminosidade ?? '--',
          indice_geral: maisRecente.indice_conforto ?? maisRecente.indice_geral ?? 0,
        });
      }

      const labels: string[] = [];
      const temps: number[] = [];
      const umids: number[] = [];
      const lumins: number[] = [];

      const docs = snap.docs.reverse();

      docs.forEach(docSnap => {
        const data = docSnap.data();
        
        let timeStr = "--:--";
        if (data.timestamp) {
          const dateObj = typeof data.timestamp === 'string' ? new Date(data.timestamp) : (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp));
          const hh = dateObj.getHours().toString().padStart(2, '0');
          const mm = dateObj.getMinutes().toString().padStart(2, '0');
          timeStr = `${hh}:${mm}`;
        }

        labels.push(timeStr);
        temps.push(data.temperatura || 0);
        umids.push(data.umidade || 0);
        lumins.push(data.luminosidade || 0);
      });

      if (labels.length === 0) {
        setHistoryData({ labels: ["00:00"], temps: [0], umids: [0], lumins: [0] });
      } else {
        setHistoryData({ labels, temps, umids, lumins });
      }
    }, (error) => console.error("Erro Snapshot Histórico:", error));

    // --- PERIFÉRICOS ---
    const perRef = collection(db, "empresas", String(empresa), "ambientes", String(id), "perifericos");
    const unsubPerifericos = onSnapshot(perRef, (snap) => {
      const listaAtualizada: any[] = [];
      
      if (!snap.empty) {
        snap.docs.forEach(docSnap => {
          const tipoDocId = docSnap.id; 
          const data = docSnap.data();
          
          Object.entries(data).forEach(([nomeChave, propriedades]: [string, any]) => {
            if (nomeChave === 'tipo' || nomeChave === 'sensores') return;

            // Filtra o periférico 'geral' do tipo 'ar_condicionado'
            if (tipoDocId === 'ar_condicionado' && nomeChave === 'geral') return;

            if (typeof propriedades === 'object' && propriedades !== null) {
              listaAtualizada.push({
                docId: tipoDocId,
                nomeId: nomeChave, 
                nome: nomeChave.replace(/_/g, ' '),
                tipo: tipoDocId.replace(/_/g, ' '),
                marca: propriedades.marca || '--',
                status: propriedades.status || false,
              });
            }
          });
        });
      }
      setPerifericosList(listaAtualizada);
    }, (error) => console.error("Erro Snapshot Perifericos:", error));

    // --- AGENDAMENTOS ---
    const ageRef = collection(db, "empresas", String(empresa), "ambientes", String(id), "agendamentos");
    const unsubAgendamentos = onSnapshot(ageRef, (snap) => {
      const listaAgendamentos: any[] = [];
      
      if (!snap.empty) {
        snap.docs.forEach(docSnap => {
          // Ignorar o documento inicializador criado automaticamente
          if (docSnap.id === 'registro_inicial') return;
          
          const data = docSnap.data();
          listaAgendamentos.push({
            id: docSnap.id,
            titulo: data.titulo || 'Sem Título',
            objetivo: data.objetivo || 'Sem objetivo',
            data: data.data || '--/--/----',
            horario: data.horario || '--:--',
          });
        });
      }
      setAgendamentosList(listaAgendamentos);
    }, (error) => console.error("Erro Snapshot Agendamentos:", error));

    return () => {
      unsubscribeAuth();
      unsubAmbiente();
      unsubHistorico();
      unsubPerifericos();
      unsubAgendamentos();
    };
  }, [id, empresa]);

  const handleLogout = async () => {
    await signOut(auth);
    setIsProfileVisible(false);
    router.replace('/');
  };

  const toggleSwitch = async (perifericoAtual: any) => {
    if (loadingPeriferico || !empresa || !id || !db) return;
    
    setLoadingPeriferico(true);
    const novoStatus = !perifericoAtual.status;
    
    try {
      const perDocRef = doc(db, "empresas", String(empresa), "ambientes", String(id), "perifericos", perifericoAtual.docId);
      
      const updateData: any = {};
      updateData[`${perifericoAtual.nomeId}.status`] = novoStatus;
      
      await updateDoc(perDocRef, updateData);
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
            <Text style={styles.envName}>{nome || 'Nome Ambiente'}</Text>
            <Text style={styles.envSub}>{caracteristicas.tipo} • {caracteristicas.andar}</Text>
          </View>
        </View>

        {/* CARDS DE MÉTRICAS */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            <MetricCard label="Temperatura" value={sensores.temperatura} unit="°C" icon={<Thermometer color="#FFF" size={24} />} iconBg="#2563EB" />
            <MetricCard label="Umidade" value={sensores.umidade} unit="%" icon={<Droplets color="#FFF" size={24} />} iconBg="#2563EB" />
          </View>
          <View style={styles.metricsCenter}>
            <MetricCard label="Luminosidade" value={sensores.luminosidade} unit="lux" icon={<Lightbulb color="#FFF" size={24} />} iconBg="#2563EB" />
          </View>
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
          <Text style={styles.statusDetail}>Baseado em temperatura, umidade, luminosidade e qualidade do ar</Text>
        </View>

        {/* TABS CONTROLS */}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabItem, tab === 'historico' && styles.tabActive]} onPress={() => setTab('historico')}>
            <Text style={[styles.tabText, tab === 'historico' && styles.tabTextActive]}>Histórico</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, tab === 'perifericos' && styles.tabActive]} onPress={() => setTab('perifericos')}>
            <Text style={[styles.tabText, tab === 'perifericos' && styles.tabTextActive]}>Periféricos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, tab === 'agendamentos' && styles.tabActive]} onPress={() => setTab('agendamentos')}>
            <Text style={[styles.tabText, tab === 'agendamentos' && styles.tabTextActive]}>Agendamentos</Text>
          </TouchableOpacity>
        </View>

        {/* CONTEÚDO DAS TABS */}
        {tab === 'historico' && (
          <View>
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle}>Histórico de Temperatura e Umidade</Text>
              <LineChart
                data={{
                  labels: historyData.labels,
                  datasets: [
                    { data: historyData.temps, color: () => `#EF4444`, strokeWidth: 3 }, 
                    { data: historyData.umids, color: () => `#3B82F6`, strokeWidth: 3 }  
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

            <View style={styles.cardMain}>
              <Text style={styles.cardTitle}>Histórico de Luminosidade</Text>
              <LineChart
                data={{
                  labels: historyData.labels,
                  datasets: [
                    { data: historyData.lumins, color: () => `#F59E0B`, strokeWidth: 3 }  
                  ]
                }}
                width={width - 80}
                height={180}
                chartConfig={chartConfig}
                bezier
                style={styles.chartStyle}
              />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#F59E0B'}]} /><Text style={styles.legendText}>Luminosidade</Text></View>
              </View>
            </View>
          </View>
        )}

        {tab === 'perifericos' && (
          perifericosList.length > 0 ? (
            perifericosList.map((p, index) => (
              <View key={`${p.docId}-${p.nomeId}-${index}`} style={[styles.peripheralCard, { marginBottom: 15 }]}>
                <View style={styles.peripheralHeader}>
                  <View style={styles.peripheralIconBox}><Snowflake color="#06B6D4" size={24} /></View>
                  <View style={{flex: 1, marginLeft: 12}}>
                    <Text style={styles.peripheralTitle}>{p.nome}</Text>
                    <Text style={styles.peripheralSubtitle}>{p.tipo}</Text>
                  </View>
                  <Switch 
                    trackColor={{ false: "#E2E8F0", true: "#0EA5E9" }} 
                    thumbColor="#FFF" 
                    onValueChange={() => toggleSwitch(p)} 
                    value={p.status} 
                    disabled={loadingPeriferico} 
                  />
                </View>
                <View style={styles.cardSeparator} />
                <Text style={styles.footerBrand}>{p.marca}</Text>
                <Text style={styles.footerStatus}>Status do periférico</Text>
              </View>
            ))
          ) : (
            <Text style={{textAlign: 'center', color: '#94A3B8', marginTop: 20}}>Nenhum periférico encontrado.</Text>
          )
        )}

        {/* ABA DE AGENDAMENTOS */}
        {tab === 'agendamentos' && (
          agendamentosList.length > 0 ? (
            agendamentosList.map((ag) => (
              <View key={ag.id} style={styles.scheduleCard}>
                <View style={styles.scheduleHeader}>
                  <View style={styles.scheduleIconBox}>
                    <Calendar color="#3B82F6" size={24} />
                  </View>
                  <View style={{flex: 1, marginLeft: 12}}>
                    <Text style={styles.scheduleTitle}>{ag.titulo}</Text>
                    <Text style={styles.scheduleSubtitle}>{ag.objetivo}</Text>
                  </View>
                </View>
                <View style={styles.cardSeparator} />
                <View style={styles.scheduleFooter}>
                  <View style={styles.scheduleFooterItem}>
                    <Clock size={16} color="#64748B" />
                    <Text style={styles.scheduleFooterText}>{ag.data} às {ag.horario}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyScheduleCard}>
              <Text style={styles.emptyScheduleTitle}>Nenhum agendamento no momento</Text>
              <Text style={styles.emptyScheduleText}>Clique em Agendar Sala em “Ambientes”.</Text>
            </View>
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
  titleSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 15 },
  envName: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  envSub: { fontSize: 14, color: '#64748B' },
  
  metricsContainer: { gap: 12 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricsCenter: { alignItems: 'center' },
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
  tabText: { fontSize: 12, color: '#64748B', fontWeight: '600' }, 
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

  scheduleCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, elevation: 3, marginBottom: 15 },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center' },
  scheduleIconBox: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  scheduleTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  scheduleSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  scheduleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scheduleFooterItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scheduleFooterText: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  emptyScheduleCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 30, alignItems: 'center', elevation: 2, marginVertical: 10 },
  emptyScheduleTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 10, textAlign: 'center' },
  emptyScheduleText: { fontSize: 14, color: '#64748B', textAlign: 'center' },

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