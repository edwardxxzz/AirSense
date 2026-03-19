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
} from 'lucide-react-native'; // Corrigido para lucide-native conforme seu padrão
import { LineChart } from "react-native-chart-kit";
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router'; 

// --- FIREBASE ---
import { auth, database } from '../services/firebaseConfig';
import { ref, onValue, get, set, remove, update } from "firebase/database";
import { signOut } from "firebase/auth";

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

  // Estados de Menu e Edição
  const [menuVisibleId, setMenuVisibleId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAmbiente, setSelectedAmbiente] = useState<AmbienteData | null>(null);

  // Estados do Formulário
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ambientesDisponiveis, setAmbientesDisponiveis] = useState<string[]>([]);
  const [showAmbienteModal, setShowAmbienteModal] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formAmbiente, setFormAmbiente] = useState('');
  const [formTipo, setFormTipo] = useState('');
  const [formMarca, setFormMarca] = useState('');
  const [formCapacidade, setFormCapacidade] = useState('');
  const [formArea, setFormArea] = useState(''); 
  const [formAndar, setFormAndar] = useState(''); 

  const [userData, setUserData] = useState({ nome: 'Carregando...', email: '', iniciais: '..' });
  const [ambientes, setAmbientes] = useState<AmbienteData[]>([]);
  
  // NOVA VARIÁVEL PRESERVADA PARA NAVEGAÇÃO
  const [userEmpresaId, setUserEmpresaId] = useState('');

  const [medias, setMedias] = useState({ 
    temp: 0, 
    hum: 0, 
    co2: 0, 
    qualidadeAr: 0 
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const empresasRef = ref(database, 'empresas');
      
      onValue(empresasRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          let nomeEncontrado = user.displayName || "Usuário";
          let listaAmbientes: AmbienteData[] = [];
          let listaNomesAmbientes: string[] = [];

          Object.keys(data).forEach(empresaKey => {
            const empresaNode = data[empresaKey];
            const usuarios = empresaNode.usuarios;
            
            if (usuarios && Object.values(usuarios).some((u: any) => u.uid === user.uid)) {
              setUserEmpresaId(empresaKey); // Armazena a ID da empresa para navegação posterior

              Object.keys(usuarios).forEach(uk => {
                if (usuarios[uk].uid === user.uid) nomeEncontrado = uk.replace(/_/g, ' ');
              });

              const ambientesNode = empresaNode.ambientes;
              if (ambientesNode) {
                Object.keys(ambientesNode).forEach(ambKey => {
                  if (ambKey !== 'Ambiente_1') listaNomesAmbientes.push(ambKey.replace(/_/g, ' '));
                  
                  const amb = ambientesNode[ambKey];
                  listaAmbientes.push({
                    id: ambKey,
                    nomeExibicao: ambKey.replace(/_/g, ' '),
                    temperatura: Number(amb.sensores?.Temperatura || amb.sensores?.temperatura) || 0,
                    umidade: Number(amb.sensores?.Umidade || amb.sensores?.umidade) || 0,
                    co2: Number(amb.sensores?.CO2 || amb.sensores?.co2) || 0,
                    tipo: amb.características?.tipo || '',
                    area: amb.características?.area || '',
                    capacidade: amb.características?.capacidade || '',
                    andar: amb.características?.andar || '',
                  });
                });
              }

              const infoNode = empresaNode.info;
              const listaFiltrada = listaAmbientes.filter(amb => amb.id !== 'Ambiente_1');
              
              const hMedia = listaFiltrada.length > 0 
                ? Math.round(listaFiltrada.reduce((acc, curr) => acc + curr.umidade, 0) / listaFiltrada.length)
                : 0;

              setMedias({
                temp: Number(infoNode?.temperatura_media) || 0,
                co2: Number(infoNode?.co2_medio) || 0,
                qualidadeAr: Number(infoNode?.qual_do_ar) || 0,
                hum: hMedia 
              });
            }
          });

          const iniciais = nomeEncontrado.split(' ').filter(n => n.length > 0).map(n => n[0]).join('').slice(0, 2).toUpperCase();
          setUserData({ nome: nomeEncontrado, email: user.email || "", iniciais });
          setAmbientes(listaAmbientes.filter(amb => amb.id !== 'Ambiente_1'));
          setAmbientesDisponiveis(listaNomesAmbientes);
        }
      });
    }
  }, []);

  const handleOpenEdit = (item: AmbienteData) => {
    setSelectedAmbiente(item);
    setFormNome(item.nomeExibicao);
    setFormTipo(item.tipo || '');
    setFormArea(item.area ? String(item.area) : '');
    setFormCapacidade(item.capacidade ? String(item.capacidade) : '');
    setFormAndar(item.andar || '');
    setIsEditing(true);
    setMenuVisibleId(null);
  };

  const handleUpdateAmbiente = async () => {
    if (!selectedAmbiente) return;
    setIsSaving(true);
    try {
      const path = `empresas/${userEmpresaId}/ambientes/${selectedAmbiente.id}/características`;
      await update(ref(database, path), {
        tipo: formTipo,
        area: formArea,
        capacidade: formCapacidade,
        andar: formAndar
      });

      Alert.alert("Sucesso", "Ambiente atualizado!");
      setIsEditing(false);
    } catch (e) {
      Alert.alert("Erro", "Falha ao atualizar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAmbiente = (id: string) => {
    setMenuVisibleId(null);
    Alert.alert("Excluir", "Deseja realmente excluir este ambiente?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
          await remove(ref(database, `empresas/${userEmpresaId}/ambientes/${id}`));
      }}
    ]);
  };

  const handleSalvarPeriferico = async () => {
    if (!formAmbiente || !formNome || !formTipo) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios (*)");
      return;
    }
    setIsSaving(true);
    try {
      const ambKey = formAmbiente.replace(/ /g, '_');
      const pathTipo = `empresas/${userEmpresaId}/ambientes/${ambKey}/perifericos/${formTipo.replace(/ /g, '_').toLowerCase()}`;
      await set(ref(database, `${pathTipo}/${formNome.replace(/ /g, '_').toLowerCase()}`), {
        marca: formMarca || "Genérico",
        capacidade: formCapacidade || "",
        status: false
      });
      setIsAdding(false);
      setFormNome(''); setFormAmbiente(''); setFormTipo('');
      Alert.alert("Sucesso", "Novo dispositivo cadastrado!");
    } catch (error) { Alert.alert("Erro", "Falha ao salvar."); } finally { setIsSaving(false); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); setIsProfileVisible(false); router.replace('/'); } catch (e) { Alert.alert("Erro", "Não foi possível sair."); }
  };

  const chartData = {
    labels: ["12h", "13h", "14h", "15h", "16h", "17h"],
    datasets: [
      { data: [22, 24.5, 23.8, 25.2, 26, 24.5], color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, strokeWidth: 3 },
      { data: [18, 20, 19, 22, 21, 19], color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, strokeWidth: 3 }
    ],
    legend: ["Temperatura", "Umidade"]
  };

  return (
    <SafeAreaView style={styles.container} key={refreshKey}>
      <View style={styles.topAppBar}>
        <Image source={LogoImg} style={styles.topLogo} resizeMode="contain" />
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBadge} onPress={() => router.push('/notificacao')}><Bell color="#000" size={24} /></TouchableOpacity>
          <TouchableOpacity style={styles.avatarCircle} onPress={() => setIsProfileVisible(true)}><Text style={styles.avatarText}>{userData.iniciais}</Text></TouchableOpacity>
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
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setIsAdding(true)}>
            <Plus color="#FFF" size={18} /><Text style={styles.btnPrimaryText}>Novo Periférico</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard label="Temp. Média" value={medias.temp} unit="°C" icon={<Thermometer color="#FFF" size={32} />} iconBg="#2563eb" />
          <MetricCard label="Umidade Média" value={medias.hum} unit="%" icon={<Droplets color="#FFF" size={32} />} iconBg="#2563eb" />
          <MetricCard label="CO₂ Médio" value={medias.co2} unit="ppm" icon={<Atom color="#FFF" size={32} />} iconBg="#2563eb" />
          <MetricCard label="Ambientes" value={ambientes.length} unit="Locais" icon={<Building2 color="#FFF" size={32} />} iconBg="#2563eb" />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Histórico das Últimas Horas</Text>
          <LineChart data={chartData} width={width - 60} height={200} chartConfig={{ backgroundColor: "#FFF", backgroundGradientFrom: "#FFF", backgroundGradientTo: "#FFF", decimalPlaces: 1, color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})` }} bezier style={{ marginVertical: 8, borderRadius: 16, marginLeft: -20 }} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitleCenter}>Qualidade do Ar Geral</Text>
          <AqiGauge value={medias.qualidadeAr} />
          <Text style={[styles.statusText, { color: medias.qualidadeAr > 70 ? '#2415a4' : '#14dd90' }]}>
            {medias.qualidadeAr > 80 ? 'Excelente' : medias.qualidadeAr > 50 ? 'Bom' : 'Alerta'}
          </Text>
        </View>

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
              onPress={() => router.push({
                pathname: '/ambiente',
                params: { id: item.id, nome: item.nomeExibicao, empresa: userEmpresaId }
              })}
              onPressArrow={() => setMenuVisibleId(menuVisibleId === item.id ? null : item.id)}
            />
            {menuVisibleId === item.id && (
              <View style={styles.actionMenu}>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleOpenEdit(item)}>
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

      {/* OS MODAIS ABAIXO FORAM MANTIDOS EXATAMENTE IGUAIS AO SEU ORIGINAL */}
      <Modal visible={isEditing} transparent animationType="fade">
        <View style={styles.formOverlay}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Editar Ambiente</Text>
            <Text style={styles.formSubtitle}>{formNome}</Text>
            <Text style={styles.label}>Tipo *</Text>
            <View style={styles.inputBox}><TextInput style={styles.input} value={formTipo} onChangeText={setFormTipo} placeholder="Ex: Escritório" /></View>
            <View style={styles.row}>
              <View style={{flex: 1}}><Text style={styles.label}>Área (m²)</Text><View style={styles.inputBox}><TextInput style={styles.input} value={formArea} onChangeText={setFormArea} keyboardType="numeric" /></View></View>
              <View style={{width: 15}} /><View style={{flex: 1}}><Text style={styles.label}>Capacidade</Text><View style={styles.inputBox}><TextInput style={styles.input} value={formCapacidade} onChangeText={setFormCapacidade} keyboardType="numeric" /></View></View>
            </View>
            <Text style={styles.label}>Andar/Localização</Text>
            <View style={styles.inputBox}><TextInput style={styles.input} value={formAndar} onChangeText={setFormAndar} /></View>
            <View style={styles.formButtons}>
              <TouchableOpacity style={styles.btnCancelForm} onPress={() => setIsEditing(false)}><Text style={styles.btnCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnCreateForm} onPress={handleUpdateAmbiente}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnCreateText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isAdding} transparent animationType="fade">
        <View style={styles.formOverlay}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Novo Periférico</Text>
            <Text style={styles.formSubtitle}>Adicione o dispositivo para o controle remoto</Text>
            <Text style={styles.label}>Nome *</Text>
            <View style={styles.inputBox}><TextInput style={styles.input} placeholder="Ex: Ar" value={formNome} onChangeText={setFormNome} /></View>
            <Text style={styles.label}>Ambiente *</Text>
            <TouchableOpacity style={styles.inputBox} onPress={() => setShowAmbienteModal(true)}>
              <Text style={formAmbiente ? styles.inputText : styles.inputPlaceholder}>{formAmbiente || "Selecione"}</Text>
              <ChevronDown color="#64748B" size={20} />
            </TouchableOpacity>
            <Text style={styles.label}>Tipo *</Text>
            <View style={styles.inputBox}><TextInput style={styles.input} placeholder="Tipo" value={formTipo} onChangeText={setFormTipo} /></View>
            <View style={styles.formButtons}>
              <TouchableOpacity style={styles.btnCancelForm} onPress={() => setIsAdding(false)}><Text style={styles.btnCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnCreateForm} onPress={handleSalvarPeriferico}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnCreateText}>Criar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAmbienteModal} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selecionar Ambiente</Text>
              <TouchableOpacity onPress={() => setShowAmbienteModal(false)}><X color="#000" size={24}/></TouchableOpacity>
            </View>
            <FlatList
              data={ambientesDisponiveis}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => { setFormAmbiente(item); setShowAmbienteModal(false); }}>
                  <Text style={[styles.pickerText, formAmbiente === item && {color: '#2563EB', fontWeight: 'bold'}]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={isProfileVisible} onRequestClose={() => setIsProfileVisible(false)}>
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
                <View>
                  <Text style={styles.configItemTitle}>Minha Conta</Text>
                  <Text style={styles.configItemSub}>Dados Pessoais</Text>
                </View>
              </View>
              <ChevronRight color="#1E293B" size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnSignOut, { marginTop: 25 }]} onPress={handleLogout}>
              <LogOut color="#EF4444" size={20} /><Text style={styles.btnSignOutText}>Sair da conta</Text>
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

// COMPONENTES AUXILIARES PRESERVADOS
function MetricCard({ label, value, unit, icon, iconBg }: any) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}><View style={[styles.metricIcon, {backgroundColor: iconBg}]}>{icon}</View></View>
      <View><Text style={styles.metricLabel}>{label}</Text><View style={styles.metricValueRow}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricUnit}>{unit}</Text></View></View>
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
        <TouchableOpacity 
          onPress={onPressArrow} 
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          style={{padding: 5}}
        >
          <ChevronDown color="#64748B" size={22} />
        </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topAppBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 5, backgroundColor: '#FFF' },
  topLogo: { width: 140, height: 90 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBadge: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  dashboardHeaderSection: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 5 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#000' },
  headerSubtitle: { fontSize: 14, color: '#64748B' },
  scrollContent: { paddingBottom: 20 },
  actionRow: { flexDirection: 'row', gap: 12, marginVertical: 10, paddingHorizontal: 20 },
  btnSecondary: { flex: 1, height: 45, backgroundColor: '#FFF', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  btnPrimary: { flex: 1.5, height: 45, backgroundColor: '#2563EB', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSecondaryText: { fontWeight: '600', color: '#000' },
  btnPrimaryText: { fontWeight: '600', color: '#FFF' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
  metricCard: { width: (width / 2) - 26, height: 140, backgroundColor: '#FFF', borderRadius: 22, padding: 15, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  metricHeader: { marginBottom: 10 },
  metricIcon: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  metricLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  metricValue: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  metricUnit: { fontSize: 12, color: '#94A3B8' },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginTop: 20, marginHorizontal: 20, elevation: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 15 },
  sectionTitleCenter: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 10 },
  gaugeContainer: { alignItems: 'center', justifyContent: 'center', height: 180 },
  gaugeTextOverlay: { position: 'absolute', alignItems: 'center' },
  gaugeValue: { fontSize: 38, fontWeight: 'bold', color: '#1E293B' },
  gaugeLabel: { fontSize: 12, color: '#94A3B8' },
  statusText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 15, paddingHorizontal: 20 },
  viewAll: { color: '#2563EB', fontWeight: '600' },
  roomCard: { backgroundColor: '#F0F9FF', borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#BAE6FD', marginHorizontal: 20 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  roomInfoMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  roomName: { fontSize: 17, fontWeight: 'bold', color: '#1E293B' },
  roomType: { fontSize: 12, color: '#64748B' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  metricBox: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 10, alignItems: 'center', gap: 2, elevation: 1 },
  metricValueCard: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  metricLabelCard: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  bottomTab: { position: 'absolute', bottom: 0, width: '100%', height: 75, backgroundColor: '#FFF', flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8F0', paddingBottom: 15 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeIndicator: { position: 'absolute', bottom: 10, width: 4, height: 4, borderRadius: 2, backgroundColor: '#2563EB' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' },
  modalBackdrop: { flex: 0.15 },
  profileSheet: { flex: 0.85, backgroundColor: '#FFF', padding: 24, paddingTop: 60, borderTopLeftRadius: 30, borderBottomLeftRadius: 30 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  profileTitle: { fontSize: 22, fontWeight: 'bold' },
  profileUserInfo: { alignItems: 'center', marginBottom: 20 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  largeAvatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  userName: { fontSize: 18, fontWeight: 'bold' },
  userEmail: { fontSize: 13, color: '#64748B' },
  separator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
  configItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  configItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  configIconBox: { width: 45, height: 45, backgroundColor: '#F8FAFC', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  configItemTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  configItemSub: { fontSize: 12, color: '#94A3B8' },
  btnSignOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#EF4444', borderRadius: 12, height: 50 },
  btnSignOutText: { color: '#EF4444', fontWeight: 'bold' },
  actionMenu: { position: 'absolute', right: 40, top: 60, backgroundColor: '#FFF', borderRadius: 12, width: 130, elevation: 15, borderWidth: 1, borderColor: '#F1F5F9', padding: 5, zIndex: 999 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  menuText: { fontSize: 14, fontWeight: '500', color: '#475569' },
  formOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  formCard: { backgroundColor: '#FFF', borderRadius: 25, padding: 25 },
  formTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  formSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  inputBox: { height: 50, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  input: { flex: 1, fontSize: 15, color: '#000', height:"90%" },
  inputText: { fontSize: 15, color: '#1E293B' },
  inputPlaceholder: { fontSize: 15, color: '#94A3B8' },
  row: { flexDirection: 'row' },
  formButtons: { flexDirection: 'row', gap: 15, marginTop: 10 },
  btnCancelForm: { flex: 1, height: 50, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCreateForm: { flex: 1, height: 50, borderRadius: 10, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontWeight: 'bold', color: '#64748B' },
  btnCreateText: { fontWeight: 'bold', color: '#FFF' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '70%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pickerTitle: { fontSize: 20, fontWeight: 'bold' },
  pickerItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pickerText: { fontSize: 16, color: '#475569' }
});