import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  TextInput,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator
} from 'react-native';
import { 
  Bell, Plus, Search, Thermometer, Droplets, Wind, LayoutGrid, 
  Building2, Zap, BarChart3, ChevronRight, FileText, X, User, LogOut,
  Edit2, Trash2, ChevronDown
} from 'lucide-react-native';
import { useRouter } from 'expo-router'; 

// --- FIREBASE FIRESTORE MIGRATION ---
import { auth, db } from '../services/firebaseConfig';
import { 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  onSnapshot, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  collectionGroup 
} from "firebase/firestore";

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png'); 

interface AmbienteData {
  id: string;
  nomeExibicao: string;
  temperatura: string;
  umidade: string;
  co2: string;
  tipo?: string;
  area?: string;
  capacidade?: string;
  andar?: string;
}

export default function AmbientesScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  
  // Estados de Controle de UI
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [menuVisibleId, setMenuVisibleId] = useState<string | null>(null);
  
  // Estados de Dados
  const [ambientes, setAmbientes] = useState<AmbienteData[]>([]);
  const [empresaId, setEmpresaId] = useState(''); 
  const [selectedAmbiente, setSelectedAmbiente] = useState<AmbienteData | null>(null);
  const [userData, setUserData] = useState({ 
    nome: 'Carregando...', 
    email: '', 
    iniciais: '..' 
  });

  // Estados do Formulário
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formCapacidade, setFormCapacidade] = useState('');
  const [formAndar, setFormAndar] = useState('');

  useEffect(() => {
    // Listener de autenticação para garantir que temos o user UID
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserData({ nome: 'Desconhecido', email: '', iniciais: '..' });
        return;
      }

      try {
        // 1. Encontrar a empresa do usuário (via Collection Group)
        const userQuery = query(collectionGroup(db, 'usuarios'), where('userId', '==', user.uid));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
          console.log("Usuário não encontrado em nenhuma empresa.");
          return;
        }

        const userDoc = userSnapshot.docs[0];
        const foundEmpresaId = userDoc.ref.parent.parent?.id;

        if (foundEmpresaId) {
          setEmpresaId(foundEmpresaId);

          // Dados do usuário para o perfil
          const dataUser = userDoc.data();
          const nomeEncontrado = dataUser.userName || "Usuário";
          const iniciais = nomeEncontrado.split(' ').filter((n: string) => n.length > 0).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
          setUserData({ nome: nomeEncontrado, email: user.email || "", iniciais });

          // 2. Listener de Ambientes (Firestore)
          const ambientesRef = collection(db, "empresas", foundEmpresaId, "ambientes");
          const unsubAmbientes = onSnapshot(ambientesRef, (snapshot) => {
            const lista: AmbienteData[] = [];
            
            snapshot.forEach((docAmb) => {
              const amb = docAmb.data();
              
              // Filtro para não exibir o Ambiente_1 (conforme lógica original)
              if (docAmb.id === 'Ambiente_1') return;

              const sensores = amb.sensores || {};
              
              lista.push({
                id: docAmb.id,
                nomeExibicao: docAmb.id.replace(/_/g, ' '),
                // Ajuste para ler campos do Firestore (minúsculas conforme dashboard anterior)
                temperatura: sensores.temperatura !== undefined ? `${sensores.temperatura}°` : '--',
                umidade: sensores.umidade !== undefined ? `${sensores.umidade}%` : '--',
                co2: sensores.co2 !== undefined ? String(sensores.co2) : '--',
                // Lendo campos de características (assumindo estrutura do dashboard anterior)
                tipo: amb.tipo || '',
                area: amb.area || '',
                capacidade: amb.capacidade || '',
                andar: amb.andar || '',
              });
            });

            setAmbientes(lista);
          });

          // Cleanup do listener de ambientes
          return () => unsubAmbientes();
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleSalvarAmbiente = async () => {
    if (!formNome.trim() || !formTipo.trim() || !formAndar.trim()) {
      Alert.alert("Campos Obrigatórios", "Por favor, preencha o Nome, Tipo e Andar.");
      return;
    }

    if (!empresaId) {
      Alert.alert("Erro", "ID da empresa não encontrado.");
      return;
    }

    setIsSaving(true);
    try {
      const novoId = formNome.trim().replace(/ /g, '_');
      const ambientesRef = collection(db, "empresas", empresaId, "ambientes");

      if (isEditing && selectedAmbiente) {
        // --- ATUALIZAR AMBIENTE ---
        const ambRef = doc(ambientesRef, selectedAmbiente.id);
        await updateDoc(ambRef, {
          tipo: formTipo,
          area: formArea || "0",
          capacidade: formCapacidade || "0",
          andar: formAndar
        });
        Alert.alert("Sucesso", "Ambiente atualizado!");
      } else {
        // --- CRIAR NOVO AMBIENTE ---
        // Lógica de substituir Ambiente_1 se for o único
        const snapshot = await getDocs(ambientesRef);
        const docs = snapshot.docs;
        
        // Se só existe o 'Ambiente_1', deletamos ele antes
        if (docs.length === 1 && docs[0].id === 'Ambiente_1') {
          await deleteDoc(doc(ambientesRef, 'Ambiente_1'));
        }

        const novoAmbRef = doc(ambientesRef, novoId);
        // Payload alinhado com a estrutura do Firestore (Dashboard)
        const payload = {
          tipo: formTipo,
          area: formArea || "0",
          capacidade: formCapacidade || "0",
          andar: formAndar,
          sensores: { 
            temperatura: 0, 
            umidade: 0, 
            co2: 0 
            // Adicione outros sensores se necessário
          },
          perifericos: {} // Inicia vazio ou com padrão
        };

        await setDoc(novoAmbRef, payload);
        Alert.alert("Sucesso", "Ambiente criado!");
      }
      
      setIsAdding(false);
      setIsEditing(false);
      resetForm();
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Falha ao processar operação.");
    } finally {
      setIsSaving(false);
    }
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
    Alert.alert("Excluir", "Deseja realmente excluir este ambiente?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        if(!empresaId) return;
        try {
          await deleteDoc(doc(db, "empresas", empresaId, "ambientes", id));
        } catch (e) {
          Alert.alert("Erro", "Falha ao excluir.");
        }
      }}
    ]);
  };

  const resetForm = () => {
    setFormNome(''); setFormTipo(''); setFormArea(''); setFormCapacidade(''); setFormAndar('');
    setSelectedAmbiente(null);
    setIsEditing(false);
  };

  const handleLogout = async () => {
    try { await signOut(auth); setIsProfileVisible(false); router.replace('/'); } 
    catch (error) { Alert.alert("Erro", "Não foi possível sair."); }
  };

  const ambientesFiltrados = ambientes.filter(amb => 
    amb.nomeExibicao.toLowerCase().includes(searchText.toLowerCase())
  );

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
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Ambientes</Text>
          <Text style={styles.headerSubtitle}>Gerencie seus locais monitorados</Text>
        </View>

        <TouchableOpacity style={styles.btnNewRoom} onPress={() => { resetForm(); setIsAdding(true); }}>
          <Plus color="#FFF" size={20} />
          <Text style={styles.btnNewRoomText}>Novo Ambiente</Text>
        </TouchableOpacity>

        <Pressable style={[styles.searchContainer, isFocused && styles.searchContainerFocused]} onPress={() => inputRef.current?.focus()}>
          <Search color={isFocused ? "#000" : "#64748B"} size={20} />
          <TextInput 
            ref={inputRef} style={styles.searchInput} placeholder="Buscar ambiente..." 
            placeholderTextColor="#94A3B8" value={searchText} onChangeText={setSearchText}
            onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
          />
        </Pressable>

        {ambientesFiltrados.length > 0 ? (
          ambientesFiltrados.map((item) => (
            <View key={item.id} style={{ zIndex: menuVisibleId === item.id ? 100 : 1 }}>
              <RoomDetailCard 
                name={item.nomeExibicao} 
                type={item.tipo || "Monitorado"} 
                temp={item.temperatura} hum={item.umidade} aqi={item.co2} 
                icon={item.tipo?.includes('Escritório') ? <Building2 color="#0369A1" size={22}/> : <LayoutGrid color="#0369A1" size={22}/>} 
                onPress={() => router.push({
                  pathname: '/ambiente',
                  params: { id: item.id, nome: item.nomeExibicao, empresa: empresaId }
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
          ))
        ) : (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: '#94A3B8' }}>Nenhum ambiente encontrado.</Text>
          </View>
        )}
        <View style={{height: 100}} /> 
      </ScrollView>

      {/* MODAL NOVO/EDITAR AMBIENTE */}
      <Modal visible={isAdding} transparent animationType="fade" onRequestClose={() => setIsAdding(false)}>
        <View style={styles.modalOverlayBlack}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{isEditing ? "Editar Ambiente" : "Novo Ambiente"}</Text>
            <Text style={styles.formSubtitle}>
              {isEditing ? selectedAmbiente?.nomeExibicao : "Configure os dados do local"}
            </Text>

            {!isEditing && (
              <>
                <Text style={styles.label}>Nome do Ambiente *</Text>
                <View style={styles.inputBox}>
                  <TextInput style={styles.input} placeholder="Ex: Sala de Reunião" value={formNome} onChangeText={setFormNome} />
                </View>
              </>
            )}

            <Text style={styles.label}>Tipo *</Text>
            <View style={styles.inputBox}>
              <TextInput style={styles.input} placeholder="Ex: Escritório" value={formTipo} onChangeText={setFormTipo} />
            </View>

            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Área(m²)</Text>
                <View style={styles.inputBox}>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formArea} onChangeText={setFormArea} />
                </View>
              </View>
              <View style={{width: 15}} />
              <View style={{flex: 1}}>
                <Text style={styles.label}>Capacidade</Text>
                <View style={styles.inputBox}>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formCapacidade} onChangeText={setFormCapacidade} />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Andar/Localização *</Text>
            <View style={styles.inputBox}>
              <TextInput style={styles.input} placeholder="Ex: 3º Andar" value={formAndar} onChangeText={setFormAndar} />
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity style={styles.btnCancelForm} onPress={() => { setIsAdding(false); resetForm(); }}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCreateForm} onPress={handleSalvarAmbiente} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnCreateText}>{isEditing ? "Salvar" : "Criar"}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PERFIL */}
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

      <View style={styles.bottomTab}>
        <TabItem icon={<FileText size={24} color="#64748B" />} onPress={() => router.push('/home')} />
        <TabItem icon={<Building2 size={24} color="#2563EB" />} active />
        <TabItem icon={<Zap size={24} color="#64748B" />} onPress={() => router.push('/perifericos')} />
        <TabItem icon={<Bell size={24} color="#64748B" />} onPress={() => router.push('/notificacao')} />
        <TabItem icon={<BarChart3 size={24} color="#64748B" />} onPress={() => router.push('/relatorios')} />
      </View>
    </SafeAreaView>
  );
}

function RoomDetailCard({ name, type, temp, hum, aqi, icon, onPress, onPressArrow }: any) {
  return (
    <TouchableOpacity style={styles.roomCard} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.roomHeader}>
        <View style={styles.roomInfoMain}>
          <View style={styles.roomIconBox}>{icon}</View>
          <View><Text style={styles.roomName}>{name}</Text><Text style={styles.roomType}>{type}</Text></View>
        </View>
        <TouchableOpacity onPress={onPressArrow} style={{padding: 10}}>
          <ChevronDown color="#1E293B" size={22} />
        </TouchableOpacity>
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metricBox}><Thermometer size={18} color="#EF4444" /><Text style={styles.metricValue}>{temp}</Text><Text style={styles.metricLabel}>Temp</Text></View>
        <View style={styles.metricBox}><Droplets size={18} color="#3B82F6" /><Text style={styles.metricValue}>{hum}</Text><Text style={styles.metricLabel}>Umidade</Text></View>
        <View style={styles.metricBox}><Wind size={18} color="#0D9488" /><Text style={styles.metricValue}>{aqi}</Text><Text style={styles.metricLabel}>AQI</Text></View>
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
  topLogo: { width: 140, height: 90 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBadge: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 15 },
  headerSection: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#000' },
  headerSubtitle: { fontSize: 14, color: '#64748B' },
  btnNewRoom: { backgroundColor: '#2563EB', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
  btnNewRoomText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 25, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  searchContainerFocused: { borderColor: '#000', backgroundColor: '#FFF' },
  searchInput: { flex: 1, height: '90%', fontSize: 15, color: '#1E293B' },
  
  roomCard: { backgroundColor: '#F0F9FF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#BAE6FD' },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  roomInfoMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomIconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roomName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  roomType: { fontSize: 12, color: '#64748B' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  metricBox: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 4, elevation: 1 },
  metricValue: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  metricLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  
  actionMenu: { position: 'absolute', right: 30, top: 60, backgroundColor: '#FFF', borderRadius: 12, width: 130, elevation: 15, borderWidth: 1, borderColor: '#F1F5F9', padding: 5, zIndex: 999 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  menuText: { fontSize: 14, fontWeight: '500', color: '#475569' },

  bottomTab: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 75, backgroundColor: '#FFF', flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8F0', paddingBottom: 15 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeIndicator: { position: 'absolute', bottom: 10, width: 4, height: 4, borderRadius: 2, backgroundColor: '#2563EB' },
  
  modalOverlayBlack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  formCard: { backgroundColor: '#FFF', borderRadius: 25, padding: 25 },
  formTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#000', marginBottom: 5 },
  formSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 25 },
  label: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  inputBox: { height: 55, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  input: { flex: 1, height: '90%', fontSize: 15, color: '#000', outlineWidth:0, outlineColor:"transparent"},
  row: { flexDirection: 'row' },
  formButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btnCancelForm: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCreateForm: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  btnCancelText: { color: '#64748B', fontWeight: 'bold' },
  btnCreateText: { color: '#FFF', fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' },
  modalBackdrop: { flex: 0.15 },
  profileSheet: { flex: 0.85, backgroundColor: '#FFF', padding: 24, paddingTop: 60, borderTopLeftRadius: 30, borderBottomLeftRadius: 30 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  profileTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  profileUserInfo: { alignItems: 'center', marginBottom: 20 },
  largeAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  largeAvatarText: { color: '#FFF', fontSize: 30, fontWeight: 'bold' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  userEmail: { fontSize: 14, color: '#64748B' },
  separator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 25 },
  configItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  configItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  configIconBox: { width: 45, height: 45, backgroundColor: '#F8FAFC', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  configItemTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  configItemSub: { fontSize: 12, color: '#94A3B8' },
  btnSignOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#EF4444', borderRadius: 15, height: 55 },
  btnSignOutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16 }
});