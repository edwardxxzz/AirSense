import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  Dimensions, Image, Modal, Pressable, Alert, TextInput, ActivityIndicator,
  FlatList, Animated
} from 'react-native';
import { 
  Bell, Plus, Zap, Building2, BarChart3, FileText,
  RefreshCw, Thermometer, Droplets, Wind, LayoutGrid,
  X, User, LogOut, ChevronRight, MoreVertical, Edit2, Trash2, Sun
} from 'lucide-react-native';
import { LineChart } from "react-native-chart-kit";
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';

import { auth, db } from '../services/firebaseConfig';
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc, onSnapshot, updateDoc, setDoc, deleteDoc,
  collection, query, where, collectionGroup,
  getDocs, orderBy, limit, addDoc
} from "firebase/firestore";

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png');

interface AmbienteData {
  id: string;
  nomeExibicao: string;
  temperatura: number;
  umidade: number;
  aqi: number;
  tipo?: string;
  area?: string;
  capacidade?: string;
  andar?: string;
}

function AqiGauge({ value }: { value: number }) {
  const size = 200;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = radius * 2 * Math.PI;
  const totalArcLength = circumference * 0.75;
  const gap = circumference - totalArcLength;
  const percentage = Math.min(Math.max(value, 0) / 100, 1);
  const progressLength = totalArcLength * percentage;

  const strokeColor = value > 75 ? "#22C55E" : value >= 40 ? "#EAB308" : "#EF4444";
  const bgColor = value > 75 ? "#F0FDF4" : value >= 40 ? "#FEFCE8" : "#FEF2F2";
  const label = value > 75 ? 'Excelente' : value >= 40 ? 'Bom' : 'Alerta';
  const labelColor = strokeColor;

  return (
    <View style={[styles.gaugeWrapper, { backgroundColor: bgColor }]}>
      <View style={styles.gaugeContainer}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '135deg' }] }}>
          <Circle cx={center} cy={center} r={radius} stroke="#E2E8F0" strokeWidth={strokeWidth}
            strokeDasharray={`${totalArcLength} ${gap}`} strokeLinecap="round" fill="none" />
          <Circle cx={center} cy={center} r={radius} stroke={strokeColor} strokeWidth={strokeWidth}
            strokeDasharray={`${progressLength} ${circumference}`} strokeLinecap="round" fill="none" />
        </Svg>
        <View style={styles.gaugeTextOverlay}>
          <Text style={[styles.gaugeValue, { color: strokeColor }]}>{value}</Text>
          <Text style={styles.gaugeLabel}>AQI</Text>
        </View>
      </View>
      <Text style={[styles.statusTextValue, { color: labelColor }]}>{label}</Text>
      <Text style={styles.gaugeSubtext}>Média de todos os ambientes controlados</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileVisible, setIsProfileVisible] = useState(false);

  const [userData, setUserData] = useState({ nome: 'Carregando...', email: '', iniciais: '..' });
  const [ambientes, setAmbientes] = useState<AmbienteData[]>([]);
  const [userEmpresaId, setUserEmpresaId] = useState('');
  const [medias, setMedias] = useState({ temp: 0, hum: 0, luminosidade: 0, qualidadeAr: 0 });

  const [chartDataState, setChartDataState] = useState({
    labels: ["--"], temps: [0], hums: [0]
  });

  const [menuVisibleId, setMenuVisibleId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedAmbiente, setSelectedAmbiente] = useState<AmbienteData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formCapacidade, setFormCapacidade] = useState('');
  const [formAndar, setFormAndar] = useState('');

  const resetForm = () => {
    setFormNome(''); setFormTipo(''); setFormArea('');
    setFormCapacidade(''); setFormAndar(''); setSelectedAmbiente(null); setIsEditing(false);
  };

  useEffect(() => {
    let unsubAmbientes: (() => void) | undefined;
    let unsubHistorico: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const userQuery = query(collectionGroup(db, 'usuarios'), where('userId', '==', user.uid));
        const userSnapshot = await getDocs(userQuery);
        if (userSnapshot.empty) return;

        const userDoc = userSnapshot.docs[0];
        const empresaId = userDoc.ref.parent.parent?.id;
        if (!empresaId) return;

        setUserEmpresaId(empresaId);
        const dataUser = userDoc.data();
        const nomeEncontrado = dataUser.userName || "Usuário";
        const iniciais = nomeEncontrado.split(' ')
          .filter((n: string) => n.length > 0)
          .map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
        setUserData({ nome: nomeEncontrado, email: user.email || "", iniciais });

        unsubAmbientes = onSnapshot(collection(db, "empresas", empresaId, "ambientes"), (snap) => {
          const lista: AmbienteData[] = [];
          snap.forEach((docAmb) => {
            if (docAmb.id.toLowerCase() === 'ambiente_1') return;
            const amb = docAmb.data();
            const sensores = amb.sensores || {};
            lista.push({
              id: docAmb.id,
              nomeExibicao: amb.dados?.nome || docAmb.id.replace(/_/g, ' '),
              temperatura: Number(sensores.temperatura || 0),
              umidade: Number(sensores.umidade || 0),
              aqi: Number(sensores.AQI || 0),
              tipo: amb.config?.tipo || amb.tipo || '',
              area: amb.config?.area || amb.area || '',
              capacidade: amb.config?.capacidade || amb.capacidade || '',
              andar: amb.config?.andar || amb.andar || '',
            });
          });
          setAmbientes(lista);
          const hMedia = lista.length > 0
            ? Math.round(lista.reduce((acc, curr) => acc + curr.umidade, 0) / lista.length) : 0;
          setMedias(prev => ({ ...prev, hum: hMedia }));
        });

        const historicoQuery = query(
          collection(db, "empresas", empresaId, "historico_geral"),
          orderBy("timestamp", "desc"), limit(6)
        );
        unsubHistorico = onSnapshot(historicoQuery, (snap) => {
          if (!snap.empty) {
            const latestDoc = snap.docs[0].data();
            setMedias(prev => ({
              ...prev,
              temp: latestDoc.temperatura_media || 0,
              luminosidade: latestDoc.luminosidade || 0,
              qualidadeAr: latestDoc.qual_do_ar || 0
            }));
            const docsData = snap.docs.map(d => d.data()).reverse();
            setChartDataState({
              labels: docsData.map(d => d.hora || "--"),
              temps: docsData.map(d => Number(d.temperatura_media || 0)),
              hums: docsData.map(d => Number(d.indice_conforto || 0)),
            });
          }
        });

      } catch (error) { console.error("Erro auth/load:", error); }
    });

    return () => {
      unsubscribeAuth();
      if (unsubAmbientes) unsubAmbientes();
      if (unsubHistorico) unsubHistorico();
    };
  }, [refreshKey]);

  const handleSalvarNovoAmbiente = async () => {
    if (!formNome.trim() || !formTipo.trim() || !formAndar.trim()) {
      Alert.alert("Campos Obrigatórios", "Preencha Nome, Tipo e Andar.");
      return;
    }
    if (!userEmpresaId) { Alert.alert("Erro", "ID da empresa não encontrado."); return; }

    setIsSaving(true);
    try {
      const novoId = formNome.trim().replace(/ /g, '_');
      const ambientesRef = collection(db, "empresas", userEmpresaId, "ambientes");

      const snapshot = await getDocs(ambientesRef);
      const docs = snapshot.docs;
      if (docs.length === 1 && docs[0].id === 'Ambiente_1') {
        await deleteDoc(doc(ambientesRef, 'Ambiente_1'));
      }

      const novoAmbRef = doc(ambientesRef, novoId);
      await setDoc(novoAmbRef, {
        config: {
          tipo: formTipo,
          area: formArea || "0",
          capacidade: formCapacidade || "0",
          andar: formAndar,
        },
        dados: {
          centralid: "central1",
          criadoEm: new Date().toISOString(),
          nome: formNome.trim(),
          receptor_id: "receptor1"
        },
        sensores: {
          temperatura: 0,
          umidade: 0,
          luminosidade: 0,
          AQI: 0,
        },
      });

      await setDoc(doc(collection(novoAmbRef, "historico"), "registro_inicial"), {
        timestamp: new Date().toISOString(),
        temperatura: 0, umidade: 0, luminosidade: 0, indice_conforto: 0
      });
      await setDoc(doc(collection(novoAmbRef, "perifericos"), "ar_condicionado"), {
        geral: { ligado: false, marca: "", modelo: "", temperatura: 24 }
      });
      await setDoc(doc(collection(novoAmbRef, "agendamentos"), "registro_inicial"), {
        timestamp: new Date().toISOString(), status: "inicializado",
        observacao: "Pasta criada automaticamente"
      });

      Alert.alert("Sucesso", "Ambiente criado com sucesso!");
      setIsAdding(false);
      resetForm();
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Falha ao criar ambiente.");
    } finally { setIsSaving(false); }
  };

  const handleUpdateAmbiente = async () => {
    if (!formNome.trim() || !formTipo.trim() || !formAndar.trim()) {
      Alert.alert("Campos Obrigatórios", "Preencha Nome, Tipo e Andar.");
      return;
    }
    if (!selectedAmbiente || !userEmpresaId) return;
    setIsSaving(true);
    try {
      const ambRef = doc(db, "empresas", userEmpresaId, "ambientes", selectedAmbiente.id);
      await updateDoc(ambRef, {
        "dados.nome": formNome.trim(),
        "config.tipo": formTipo,
        "config.area": formArea || "0",
        "config.capacidade": formCapacidade || "0",
        "config.andar": formAndar,
      });
      Alert.alert("Sucesso", "Ambiente atualizado!");
      setIsAdding(false);
      resetForm();
    } catch (e) { Alert.alert("Erro", "Falha ao atualizar."); }
    finally { setIsSaving(false); }
  };

  const handleOpenEdit = (item: AmbienteData) => {
    setSelectedAmbiente(item);
    setFormNome(item.nomeExibicao);
    setFormTipo(item.tipo || '');
    setFormArea(item.area ? String(item.area) : '');
    setFormCapacidade(item.capacidade ? String(item.capacidade) : '');
    setFormAndar(item.andar || '');
    setIsEditing(true);
    setIsAdding(true);
    setMenuVisibleId(null);
  };

  const handleDeleteAmbiente = (id: string) => {
    setMenuVisibleId(null);
    Alert.alert("Excluir Ambiente", "Deseja realmente excluir este ambiente e todos os seus dados?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive", onPress: async () => {
          if (!userEmpresaId) return;
          try {
            const ambRef = doc(db, "empresas", userEmpresaId, "ambientes", id);
            // Deletar subcoleções primeiro
            const subcollections = ['perifericos', 'agendamentos', 'historico'];
            for (const sub of subcollections) {
              const subSnap = await getDocs(collection(ambRef, sub));
              for (const subDoc of subSnap.docs) {
                await deleteDoc(subDoc.ref);
              }
            }
            await deleteDoc(ambRef);
          }
          catch (e) { console.error(e); Alert.alert("Erro", "Falha ao excluir."); }
        }
      }
    ]);
  };

  const handleLogout = async () => {
    try { await signOut(auth); router.replace('/'); }
    catch (e) { Alert.alert("Erro", "Falha ao sair."); }
  };

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
      },
    ],
    legend: ["Temperatura", "Umidade"]
  };

  return (
    <SafeAreaView style={styles.container}>
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
        <View style={styles.dashboardHeaderSection}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Visão geral de seus ambientes</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setRefreshKey(k => k + 1)}>
            <RefreshCw color="#000" size={18} /><Text style={styles.btnSecondaryText}>Atualizar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => { resetForm(); setIsAdding(true); }}>
            <Plus color="#FFF" size={18} /><Text style={styles.btnPrimaryText}>Novo Ambiente</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard label="Temp. Média" value={`${medias.temp}`} unit="°C"
            icon={<Thermometer color="#FFF" size={28} />} iconBg="#2563EB" />
          <MetricCard label="Umidade Média" value={`${medias.hum}`} unit="%"
            icon={<Droplets color="#FFF" size={28} />} iconBg="#2563EB" />
          <MetricCard label="Luminosidade Média" value={`${medias.luminosidade}`} unit="lux"
            icon={<Sun color="#FFF" size={28} />} iconBg="#2563EB" />
          <MetricCard label="Ambientes Ativos" value={`${ambientes.length}`} unit="Locais"
            icon={<Building2 color="#FFF" size={28} />} iconBg="#2563EB" />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Histórico das Últimas Horas</Text>
          <LineChart
            data={chartData}
            width={width - 60}
            height={200}
            fromZero={true}
            chartConfig={{
              backgroundColor: "#FFF",
              backgroundGradientFrom: "#FFF",
              backgroundGradientTo: "#FFF",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
              propsForDots: { r: "4" },
              propsForBackgroundLines: { stroke: "#F1F5F9" },
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16, marginLeft: -20 }}
            segments={4}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitleCenter}>Qualidade do Ar Geral</Text>
          <AqiGauge value={medias.qualidadeAr} />
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Seus Ambientes</Text>
          <TouchableOpacity onPress={() => router.push('/ambientes')}>
            <Text style={styles.viewAll}>Ver Todos →</Text>
          </TouchableOpacity>
        </View>

        {ambientes.slice(0, 3).map((item) => (
          <View key={item.id} style={{ zIndex: menuVisibleId === item.id ? 100 : 1 }}>
            <RoomCard
              name={item.nomeExibicao}
              type={item.tipo || "Monitorado"}
              temp={`${item.temperatura}°`}
              hum={`${item.umidade}%`}
              aqi={item.aqi}
              icon={<LayoutGrid color="#0369A1" size={24} />}
              onPress={() => router.push({
                pathname: '/ambiente',
                params: { id: item.id, nome: item.nomeExibicao, empresa: userEmpresaId }
              })}
              onPressArrow={() => setMenuVisibleId(menuVisibleId === item.id ? null : item.id)}
            />
            {menuVisibleId === item.id && (
              <View style={styles.actionMenu}>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleOpenEdit(item)}>
                  <Edit2 size={16} color="#475569" />
                  <Text style={styles.menuText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteAmbiente(item.id)}>
                  <Trash2 size={16} color="#EF4444" />
                  <Text style={[styles.menuText, { color: '#EF4444' }]}>Excluir</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* MODAL CRIAR / EDITAR AMBIENTE */}
      <Modal visible={isAdding} transparent animationType="fade" onRequestClose={() => { setIsAdding(false); resetForm(); }}>
        <View style={styles.formOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{isEditing ? 'Editar Ambiente' : 'Novo Ambiente'}</Text>
              <Text style={styles.formSubtitle}>
                {isEditing ? 'Edite os dados do ambiente' : 'Adicione um novo ambiente para monitorar'}
              </Text>

              <Text style={styles.label}>Nome do Ambiente *</Text>
              <View style={styles.inputBox}>
                <TextInput style={styles.input} placeholder="Ex: Sala de Reunião 1"
                  value={formNome} onChangeText={setFormNome} />
              </View>

              <Text style={styles.label}>Tipo *</Text>
              <View style={styles.inputBox}>
                <TextInput style={styles.input} placeholder="Ex: Escritório/Sala de Reunião/Depósito"
                  value={formTipo} onChangeText={setFormTipo} />
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Área(m²)</Text>
                  <View style={styles.inputBox}>
                    <TextInput style={styles.input} placeholder="50" keyboardType="numeric"
                      value={formArea} onChangeText={setFormArea} />
                  </View>
                </View>
                <View style={{ width: 15 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Capacidade</Text>
                  <View style={styles.inputBox}>
                    <TextInput style={styles.input} placeholder="10" keyboardType="numeric"
                      value={formCapacidade} onChangeText={setFormCapacidade} />
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Andar/Localização *</Text>
              <View style={styles.inputBox}>
                <TextInput style={styles.input} placeholder="Ex: 2º Andar"
                  value={formAndar} onChangeText={setFormAndar} />
              </View>

              <View style={styles.formButtons}>
                <TouchableOpacity style={styles.btnCancelForm} onPress={() => { setIsAdding(false); resetForm(); }}>
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnCreateForm}
                  onPress={isEditing ? handleUpdateAmbiente : handleSalvarNovoAmbiente}
                  disabled={isSaving}>
                  {isSaving
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={styles.btnCreateText}>{isEditing ? 'Salvar' : 'Criar'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL PERFIL — lateral direita */}
      <Modal animationType="fade" transparent={true} visible={isProfileVisible}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsProfileVisible(false)} />
          <View style={styles.profileSheet}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileTitle}>Perfil</Text>
              <TouchableOpacity onPress={() => setIsProfileVisible(false)}>
                <X color="#94A3B8" size={30} />
              </TouchableOpacity>
            </View>
            <View style={styles.profileUserInfo}>
              <View style={styles.largeAvatar}>
                <Text style={styles.largeAvatarText}>{userData.iniciais}</Text>
              </View>
              <Text style={styles.userName}>{userData.nome}</Text>
              <Text style={styles.userEmail}>{userData.email}</Text>
            </View>
            <View style={styles.separatorLine} />
            <TouchableOpacity style={styles.configItem} onPress={() => {
              setIsProfileVisible(false); router.push('/profile');
            }}>
              <View style={styles.configItemLeft}>
                <View style={styles.configIconBox}><User color="#1E293B" size={22} /></View>
                <View>
                  <Text style={styles.configItemTitle}>Minha Conta</Text>
                  <Text style={styles.configItemSub}>Dados Pessoais</Text>
                </View>
              </View>
              <ChevronRight color="#1E293B" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSignOut, { marginTop: 25 }]} onPress={handleLogout}>
              <LogOut color="#EF4444" size={20} />
              <Text style={styles.btnSignOutText}>Sair da conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

function MetricCard({ label, value, unit, icon, iconBg }: any) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={{ marginTop: 10 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <View style={styles.metricValueRow}>
          <Text style={styles.metricValue}>{value}</Text>
          <Text style={styles.metricUnit}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

function RoomCard({ name, type, temp, hum, aqi, icon, onPress, onPressArrow }: any) {
  return (
    <TouchableOpacity style={styles.roomCard} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.roomHeader}>
        <View style={styles.roomInfoMain}>
          <View style={styles.roomIconBox}>{icon}</View>
          <View>
            <Text style={styles.roomName}>{name}</Text>
            <Text style={styles.roomType}>{type}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onPressArrow} style={{ padding: 5 }}>
          <MoreVertical color="#64748B" size={22} />
        </TouchableOpacity>
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Thermometer size={16} color="#EF4444" />
          <Text style={styles.metricValueCard}>{temp}</Text>
          <Text style={styles.metricLabelCard}>Temp</Text>
        </View>
        <View style={styles.metricBox}>
          <Droplets size={16} color="#3B82F6" />
          <Text style={styles.metricValueCard}>{hum}</Text>
          <Text style={styles.metricLabelCard}>Umidade</Text>
        </View>
        <View style={styles.metricBox}>
          <Wind size={16} color="#0D9488" />
          <Text style={styles.metricValueCard}>{aqi}</Text>
          <Text style={styles.metricLabelCard}>AQI</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TabItem({ icon, active, onPress }: any) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress}>
      {icon}
      {active && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );
}

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
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  sectionTitleCenter: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 8 },
  gaugeWrapper: { borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8 },
  gaugeContainer: { alignItems: 'center', justifyContent: 'center', height: 200 },
  gaugeTextOverlay: { position: 'absolute', alignItems: 'center' },
  gaugeValue: { fontSize: 42, fontWeight: 'bold' },
  gaugeLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  statusTextValue: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  gaugeSubtext: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
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
  formOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  formCard: { backgroundColor: '#FFF', borderRadius: 25, padding: 25 },
  formTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#1E293B' },
  formSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 25 },
  label: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  inputBox: { height: 50, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 18, overflow: 'hidden' },
  input: { flex: 1, fontSize: 15, color: '#000', paddingVertical: 0, outlineWidth: 0, outlineColor: 'transparent' },
  row: { flexDirection: 'row' },
  formButtons: { flexDirection: 'row', gap: 15, marginTop: 10 },
  btnCancelForm: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCreateForm: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontWeight: 'bold', color: '#64748B' },
  btnCreateText: { fontWeight: 'bold', color: '#FFF' },
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