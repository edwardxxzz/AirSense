import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
  FlatList
} from 'react-native';
import {
  Bell, RefreshCw, Plus, Thermometer, Droplets, Wind,
  LayoutGrid, Building2, Zap, BarChart3, ChevronRight,
  FileText, X, User, LogOut, ChevronDown, Edit2, Trash2, Atom
} from 'lucide-react-native';
import { LineChart } from "react-native-chart-kit";
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';

// --- FIREBASE SERVICES ---
import { auth, db } from '../services/firebaseConfig';
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  collectionGroup,
  getDocs,
  orderBy, // ADICIONADO PARA O GRÁFICO
  limit    // ADICIONADO PARA O GRÁFICO
} from "firebase/firestore";

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png');

interface AmbienteData {
  id: string;
  nomeExibicao: string;
  temperatura: number;
  umidade: number;
  co2: number;
  tipo?: string;
  area?: string;
  capacidade?: string;
  andar?: string;
}

// --- GAUGE COMPONENT ---
function AqiGauge({ value }: { value: number }) {
  const size = 180;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = radius * 2 * Math.PI;
  const totalArcLength = circumference * 0.75;
  const gap = circumference - totalArcLength;

  const percentage = Math.min(value / 100, 1);
  const progressLength = totalArcLength * percentage;
  const strokeColor = value > 80 ? "#84CC16" : value > 50 ? "#EAB308" : "#EF4444";

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '135deg' }] }}>
        <Circle cx={center} cy={center} r={radius} stroke="#F1F5F9" strokeWidth={strokeWidth} strokeDasharray={`${totalArcLength} ${gap}`} strokeLinecap="round" fill="none" />
        <Circle cx={center} cy={center} r={radius} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray={`${progressLength} ${circumference}`} strokeLinecap="round" fill="none" />
      </Svg>
      <View style={styles.gaugeTextOverlay}>
        <Text style={styles.gaugeValue}>{value}</Text>
        <Text style={styles.gaugeLabel}>% QUALIDADE</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileVisible, setIsProfileVisible] = useState(false);

  // Estados de Dados
  const [userData, setUserData] = useState({ nome: 'Carregando...', email: '', iniciais: '..' });
  const [ambientes, setAmbientes] = useState<AmbienteData[]>([]);
  const [userEmpresaId, setUserEmpresaId] = useState('');
  const [medias, setMedias] = useState({ temp: 0, hum: 0, co2: 0, qualidadeAr: 0 });

  // --- ESTADO DO GRÁFICO ---
  const [chartDataState, setChartDataState] = useState({
    labels: ["--"],
    temps: [0],
    hums: [0]
  });

  // Estados de UI/Menus
  const [menuVisibleId, setMenuVisibleId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAmbiente, setSelectedAmbiente] = useState<AmbienteData | null>(null);

  // --- ESTADOS DO FORMULÁRIO "NOVO PERIFÉRICO" ---
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAmbienteModal, setShowAmbienteModal] = useState(false);
  
  const [formNome, setFormNome] = useState('');
  const [formAmbiente, setFormAmbiente] = useState(''); 
  const [formAmbienteId, setFormAmbienteId] = useState(''); 
  const [formTipo, setFormTipo] = useState('');
  const [formMarca, setFormMarca] = useState('');
  const [formCapacidade, setFormCapacidade] = useState('');

  // Estados extras para edição de ambiente
  const [formArea, setFormArea] = useState('');
  const [formAndar, setFormAndar] = useState('');

  useEffect(() => {
    let unsubConfig: (() => void) | undefined;
    let unsubAmbientes: (() => void) | undefined;
    let unsubHistorico: (() => void) | undefined; // Listener do gráfico

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const userQuery = query(collectionGroup(db, 'usuarios'), where('userId', '==', user.uid));
        const userSnapshot = await getDocs(userQuery);

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const empresaId = userDoc.ref.parent.parent?.id;

          if (empresaId) {
            setUserEmpresaId(empresaId);
            const dataUser = userDoc.data();
            const nomeEncontrado = dataUser.userName || "Usuário";
            const iniciais = nomeEncontrado.split(' ').filter((n: string) => n.length > 0).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            setUserData({ nome: nomeEncontrado, email: user.email || "", iniciais });

            // Listener Config (Medidores estáticos)
            unsubConfig = onSnapshot(doc(db, "empresas", empresaId, "config", "geral"), (docSnap) => {
              if (docSnap.exists()) {
                const d = docSnap.data();
                setMedias(prev => ({ ...prev, temp: d.temperatura_media || 0, co2: d.co2_medio || 0, qualidadeAr: d.qual_do_ar || 0 }));
              }
            });

            // Listener Ambientes
            unsubAmbientes = onSnapshot(collection(db, "empresas", empresaId, "ambientes"), (snap) => {
              const lista: AmbienteData[] = [];
              snap.forEach((docAmb) => {
                if (docAmb.id !== 'Ambiente_1') {
                  const amb = docAmb.data();
                  lista.push({
                    id: docAmb.id,
                    nomeExibicao: docAmb.id.replace(/_/g, ' '),
                    temperatura: Number(amb.sensores?.temperatura || 0),
                    umidade: Number(amb.sensores?.umidade || 0),
                    co2: Number(amb.sensores?.co2 || 0),
                    tipo: amb.tipo || '',
                    area: amb.area || '',
                    capacidade: amb.capacidade || '',
                    andar: amb.andar || '',
                  });
                }
              });
              setAmbientes(lista);
              const hMedia = lista.length > 0 ? Math.round(lista.reduce((acc, curr) => acc + curr.umidade, 0) / lista.length) : 0;
              setMedias(prev => ({ ...prev, hum: hMedia }));
            });

            // --- NOVO: Listener Histórico (Gráfico) ---
            const historicoQuery = query(
              collection(db, "empresas", empresaId, "historico_geral"),
              orderBy("timestamp", "desc"), // Pega do mais recente pro mais antigo
              limit(6) // Mostra só as últimas 6 horas
            );

            unsubHistorico = onSnapshot(historicoQuery, (snap) => {
              if (!snap.empty) {
                // Como pegamos descending, precisamos reverter o array para o tempo ir da esquerda pra direita
                const docsData = snap.docs.map(d => d.data()).reverse();

                const labels = docsData.map(d => d.hora || "--");
                const temps = docsData.map(d => d.temperatura_media || 0);
                const hums = docsData.map(d => d.umidade_media || d.indice_conforto || 0);

                setChartDataState({ labels, temps, hums });
              }
            });

          }
        }
      } catch (error) { console.error("Erro auth/load:", error); }
    });

    return () => { 
      unsubscribeAuth(); 
      if (unsubConfig) unsubConfig(); 
      if (unsubAmbientes) unsubAmbientes(); 
      if (unsubHistorico) unsubHistorico(); // Limpa o listener
    };
  }, [refreshKey]);

  // --- HANDLERS ---
  const resetForm = () => {
    setFormNome(''); setFormAmbiente(''); setFormAmbienteId(''); setFormTipo(''); setFormMarca(''); setFormCapacidade('');
  };

  const handleSalvarPeriferico = async () => {
    if (!formNome || !formTipo || !formAmbienteId || !userEmpresaId) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios (*)");
      return;
    }
    setIsSaving(true);
    try {
      const perId = formNome.replace(/ /g, '_').toLowerCase();
      const perRef = doc(db, "empresas", userEmpresaId, "ambientes", formAmbienteId, "perifericos", perId);
      await setDoc(perRef, {
        tipo: formTipo,
        marca: formMarca || "Genérico",
        capacidade: formCapacidade || "",
        status: false
      });
      Alert.alert("Sucesso", "Novo dispositivo cadastrado!");
      setIsAdding(false);
      resetForm();
    } catch (e) { Alert.alert("Erro", "Falha ao salvar."); }
    finally { setIsSaving(false); }
  };

  const handleUpdateAmbiente = async () => {
    if (!selectedAmbiente || !userEmpresaId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "empresas", userEmpresaId, "ambientes", selectedAmbiente.id), {
        tipo: formTipo, area: formArea, capacidade: formCapacidade, andar: formAndar
      });
      setIsEditing(false);
      Alert.alert("Sucesso", "Ambiente atualizado!");
    } catch (e) { Alert.alert("Erro", "Falha ao atualizar."); }
    finally { setIsSaving(false); }
  };

  const handleDeleteAmbiente = (id: string) => {
    setMenuVisibleId(null);
    Alert.alert("Excluir", "Deseja realmente remover este ambiente?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        try { await deleteDoc(doc(db, "empresas", userEmpresaId, "ambientes", id)); }
        catch (e) { Alert.alert("Erro", "Falha ao excluir."); }
      }}
    ]);
  };

  const handleLogout = async () => {
    try { await signOut(auth); router.replace('/'); } catch (e) { Alert.alert("Erro", "Falha ao sair."); }
  };

  // --- DADOS DINÂMICOS INJETADOS NO GRÁFICO ---
  const chartData = {
    labels: chartDataState.labels.length > 0 ? chartDataState.labels : ["--"],
    datasets: [
      { 
        data: chartDataState.temps.length > 0 ? chartDataState.temps : [0], 
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, 
        strokeWidth: 3 
      },
      { 
        data: chartDataState.hums.length > 0 ? chartDataState.hums : [0], 
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, 
        strokeWidth: 3 
      }
    ],
    legend: ["Temperatura", "Umidade"]
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.topAppBar}>
        <Image source={LogoImg} style={styles.topLogo} resizeMode="contain" />
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBadge} onPress={() => router.push('/notificacao')}><Bell color="#000" size={24} /></TouchableOpacity>
          <TouchableOpacity style={styles.avatarCircle} onPress={() => setIsProfileVisible(true)}><Text style={styles.avatarText}>{userData.iniciais}</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* TITULOS */}
        <View style={styles.dashboardHeaderSection}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Visão geral de seus ambientes</Text>
        </View>

        {/* ACOES RAPIDAS */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setRefreshKey(k => k + 1)}>
            <RefreshCw color="#000" size={18} /><Text style={styles.btnSecondaryText}>Atualizar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => { resetForm(); setIsAdding(true); }}>
            <Plus color="#FFF" size={18} /><Text style={styles.btnPrimaryText}>Novo Periférico</Text>
          </TouchableOpacity>
        </View>

        {/* METRICAS GRID */}
        <View style={styles.metricsGrid}>
          <MetricCard label="Temp. Média" value={medias.temp} unit="°C" icon={<Thermometer color="#FFF" size={28} />} iconBg="#2563EB" />
          <MetricCard label="Umidade Média" value={medias.hum} unit="%" icon={<Droplets color="#FFF" size={28} />} iconBg="#2563EB" />
          <MetricCard label="CO₂ Médio" value={medias.co2} unit="ppm" icon={<Atom color="#FFF" size={28} />} iconBg="#2563EB" />
          <MetricCard label="Ambientes" value={ambientes.length} unit="Locais" icon={<Building2 color="#FFF" size={28} />} iconBg="#2563EB" />
        </View>

        {/* GRAFICO */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Histórico das Últimas Horas</Text>
          <LineChart data={chartData} width={width - 60} height={180} chartConfig={{ backgroundColor: "#FFF", backgroundGradientFrom: "#FFF", backgroundGradientTo: "#FFF", decimalPlaces: 1, color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`, labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, propsForDots: { r: "4" } }} bezier style={{ marginVertical: 8, borderRadius: 16, marginLeft: -20 }} />
        </View>

        {/* GAUGE QUALIDADE AR */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitleCenter}>Qualidade do Ar Geral</Text>
          <AqiGauge value={medias.qualidadeAr} />
          <Text style={[styles.statusTextValue, { color: medias.qualidadeAr > 80 ? '#22C55E' : medias.qualidadeAr > 50 ? '#EAB308' : '#EF4444' }]}>
            {medias.qualidadeAr > 80 ? 'Excelente' : medias.qualidadeAr > 50 ? 'Bom' : 'Alerta'}
          </Text>
        </View>

        {/* LISTA DE AMBIENTES */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Seus Ambientes</Text>
          <TouchableOpacity onPress={() => router.push('/ambientes')}><Text style={styles.viewAll}>Ver Todos →</Text></TouchableOpacity>
        </View>

        {ambientes.slice(0, 3).map((item) => (
          <View key={item.id} style={{ zIndex: menuVisibleId === item.id ? 100 : 1 }}>
            <RoomCard
              name={item.nomeExibicao}
              type={item.tipo || "Monitorado"}
              temp={`${item.temperatura}°`}
              hum={`${item.umidade}%`}
              aqi={item.co2}
              icon={<LayoutGrid color="#0369A1" size={24}/>}
              onPress={() => router.push({ pathname: '/ambiente', params: { id: item.id, nome: item.nomeExibicao, empresa: userEmpresaId } })}
              onPressArrow={() => setMenuVisibleId(menuVisibleId === item.id ? null : item.id)}
            />
            {menuVisibleId === item.id && (
              <View style={styles.actionMenu}>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setSelectedAmbiente(item); setFormNome(item.nomeExibicao); setFormTipo(item.tipo || ''); setFormArea(String(item.area)); setFormCapacidade(String(item.capacidade)); setFormAndar(item.andar || ''); setIsEditing(true); setMenuVisibleId(null); }}>
                  <Edit2 size={16} color="#475569" /><Text style={styles.menuText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteAmbiente(item.id)}>
                  <Trash2 size={16} color="#EF4444" /><Text style={[styles.menuText, {color: '#EF4444'}]}>Excluir</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        <View style={{height: 100}} />
      </ScrollView>

      {/* --- MODAL NOVO PERIFÉRICO --- */}
      <Modal visible={isAdding} transparent animationType="fade">
        <View style={styles.formOverlay}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Novo Periférico</Text>
            <Text style={styles.formSubtitle}>Adicione o dispositivo para o controle remoto</Text>

            <Text style={styles.label}>Nome *</Text>
            <View style={styles.inputBox}><TextInput style={styles.input} placeholder="Ex: Ar Condicionado Principal" value={formNome} onChangeText={setFormNome} /></View>

            <Text style={styles.label}>Ambiente *</Text>
            <TouchableOpacity style={styles.inputBox} onPress={() => setShowAmbienteModal(true)}>
              <Text style={[styles.inputText, !formAmbiente && {color: '#94A3B8'}]}>{formAmbiente || "Selecione o ambiente"}</Text>
              <ChevronDown color="#64748B" size={20} />
            </TouchableOpacity>

            <Text style={styles.label}>Tipo *</Text>
            <View style={styles.inputBox}><TextInput style={styles.input} placeholder="Ex: Ar Condicionado" value={formTipo} onChangeText={setFormTipo} /></View>

            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Marca</Text>
                <View style={styles.inputBox}><TextInput style={styles.input} placeholder="Ex: LG" value={formMarca} onChangeText={setFormMarca} /></View>
              </View>
              <View style={{width: 15}} />
              <View style={{flex: 1}}>
                <Text style={styles.label}>Capacidade</Text>
                <View style={styles.inputBox}><TextInput style={styles.input} placeholder="Ex: 12000 BTU" value={formCapacidade} onChangeText={setFormCapacidade} /></View>
              </View>
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity style={styles.btnCancelForm} onPress={() => { setIsAdding(false); resetForm(); }}><Text style={styles.btnCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnCreateForm} onPress={handleSalvarPeriferico}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnCreateText}>Criar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SELETOR DE AMBIENTE */}
      <Modal visible={showAmbienteModal} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selecionar Ambiente</Text>
              <TouchableOpacity onPress={() => setShowAmbienteModal(false)}><X color="#000" size={24}/></TouchableOpacity>
            </View>
            <FlatList
              data={ambientes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => { setFormAmbiente(item.nomeExibicao); setFormAmbienteId(item.id); setShowAmbienteModal(false); }}>
                  <Text style={[styles.pickerText, formAmbiente === item.nomeExibicao && {color: '#2563EB', fontWeight: 'bold'}]}>{item.nomeExibicao}</Text>
                  {formAmbiente === item.nomeExibicao && <Zap color="#2563EB" size={20} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL PERFIL */}
      <Modal animationType="fade" transparent={true} visible={isProfileVisible}>
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
            <View style={styles.separatorLine} />
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

      {/* BOTTOM TAB */}
      <View style={styles.bottomTab}>
        <TabItem icon={<FileText size={24} color="#2563EB" />} active />
        <TabItem icon={<Building2 size={24} color="#64748B" />} onPress={() => router.push('/ambientes')} />
        <TabItem icon={<Zap size={24} color="#64748B" />} onPress={() => router.push('/perifericos')} />
        <TabItem icon={<Bell size={24} color="#64748B" />} onPress={() => router.push('/notificacao')} />
        <TabItem icon={<BarChart3 size={24} color="#64748B" />} onPress={() => router.push('/relatorios')} />
      </View>
    </SafeAreaView>
  );
}

// --- SUB-COMPONENTES ---
function MetricCard({ label, value, unit, icon, iconBg }: any) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, {backgroundColor: iconBg}]}>{icon}</View>
      <View style={{marginTop: 10}}><Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricUnit}>{unit}</Text></View></View>
    </View>
  );
}

function RoomCard({ name, type, temp, hum, aqi, icon, onPress, onPressArrow }: any) {
  return (
    <TouchableOpacity style={styles.roomCard} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.roomHeader}>
        <View style={styles.roomInfoMain}>
          <View style={styles.roomIconBox}>{icon}</View>
          <View><Text style={styles.roomName}>{name}</Text><Text style={styles.roomType}>{type}</Text></View>
        </View>
        <TouchableOpacity onPress={onPressArrow} style={{padding: 5}}><ChevronDown color="#64748B" size={22} /></TouchableOpacity>
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metricBox}><Thermometer size={16} color="#EF4444" /><Text style={styles.metricValueCard}>{temp}</Text><Text style={styles.metricLabelCard}>Temp</Text></View>
        <View style={styles.metricBox}><Droplets size={16} color="#3B82F6" /><Text style={styles.metricValueCard}>{hum}</Text><Text style={styles.metricLabelCard}>Umidade</Text></View>
        <View style={styles.metricBox}><Wind size={16} color="#0D9488" /><Text style={styles.metricValueCard}>{aqi}</Text><Text style={styles.metricLabelCard}>PPM</Text></View>
      </View>
    </TouchableOpacity>
  );
}

function TabItem({ icon, active, onPress }: any) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress}>{icon}{active && <View style={styles.activeIndicator} />}</TouchableOpacity>
  );
}

// --- ESTILOS ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topAppBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 5, backgroundColor: '#FFF' },
  topLogo: { width: 140, height: 80 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBadge: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  dashboardHeaderSection: { paddingHorizontal: 20, paddingTop: 10 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  headerSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 10 },
  scrollContent: { paddingBottom: 20 },
  actionRow: { flexDirection: 'row', gap: 12, marginVertical: 15, paddingHorizontal: 20 },
  btnSecondary: { flex: 1, height: 48, backgroundColor: '#FFF', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  btnPrimary: { flex: 1.5, height: 48, backgroundColor: '#2563EB', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSecondaryText: { fontWeight: '600', color: '#1E293B' },
  btnPrimaryText: { fontWeight: '600', color: '#FFF' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
  metricCard: { width: (width / 2) - 26, backgroundColor: '#FFF', borderRadius: 20, padding: 18, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  metricIcon: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  metricLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  metricValue: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  metricUnit: { fontSize: 12, color: '#94A3B8' },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginTop: 20, marginHorizontal: 20, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  sectionTitleCenter: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
  gaugeContainer: { alignItems: 'center', justifyContent: 'center', height: 180 },
  gaugeTextOverlay: { position: 'absolute', alignItems: 'center' },
  gaugeValue: { fontSize: 38, fontWeight: 'bold', color: '#1E293B' },
  gaugeLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },
  statusTextValue: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 15, paddingHorizontal: 20 },
  viewAll: { color: '#2563EB', fontWeight: '600' },
  roomCard: { backgroundColor: '#F0F9FF', borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#BAE6FD', marginHorizontal: 20 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  roomInfoMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roomName: { fontSize: 17, fontWeight: 'bold', color: '#1E293B' },
  roomType: { fontSize: 12, color: '#64748B' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  metricBox: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 10, alignItems: 'center', gap: 2, elevation: 1 },
  metricValueCard: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  metricLabelCard: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  bottomTab: { position: 'absolute', bottom: 0, width: '100%', height: 75, backgroundColor: '#FFF', flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8F0', paddingBottom: 15 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeIndicator: { position: 'absolute', bottom: 10, width: 4, height: 4, borderRadius: 2, backgroundColor: '#2563EB' },
  formOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  formCard: { backgroundColor: '#FFF', borderRadius: 25, padding: 25 },
  formTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#1E293B' },
  formSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 25 },
  label: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  inputBox: { height: 55, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  input: { flex: 1, fontSize: 15, color: '#000' },
  inputText: { fontSize: 15 },
  row: { flexDirection: 'row' },
  formButtons: { flexDirection: 'row', gap: 15, marginTop: 10 },
  btnCancelForm: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCreateForm: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontWeight: 'bold', color: '#64748B' },
  btnCreateText: { fontWeight: 'bold', color: '#FFF' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '70%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pickerTitle: { fontSize: 20, fontWeight: 'bold' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pickerText: { fontSize: 16, color: '#1E293B' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' },
  modalBackdrop: { flex: 0.15 },
  profileSheet: { flex: 0.85, backgroundColor: '#FFF', padding: 24, paddingTop: 60, borderTopLeftRadius: 30, borderBottomLeftRadius: 30 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  profileTitle: { fontSize: 22, fontWeight: 'bold' },
  profileUserInfo: { alignItems: 'center', marginBottom: 20 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  largeAvatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  userName: { fontSize: 18, fontWeight: 'bold' },
  userEmail: { fontSize: 13, color: '#64748B' },
  separatorLine: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
  configItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  configItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  configIconBox: { width: 45, height: 45, backgroundColor: '#F8FAFC', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  configItemTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  configItemSub: { fontSize: 12, color: '#94A3B8' },
  btnSignOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#EF4444', borderRadius: 12, height: 50 },
  btnSignOutText: { color: '#EF4444', fontWeight: 'bold' },
  actionMenu: { position: 'absolute', right: 40, top: 60, backgroundColor: '#FFF', borderRadius: 12, width: 130, elevation: 15, borderWidth: 1, borderColor: '#F1F5F9', padding: 5, zIndex: 999 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  menuText: { fontSize: 14, fontWeight: '500', color: '#475569' },
});