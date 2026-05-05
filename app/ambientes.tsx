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
  ActivityIndicator,
  Animated,
  Switch
} from 'react-native';
import { 
  Bell, Plus, Search, Thermometer, Droplets, Wind, LayoutGrid, 
  Building2, Zap, BarChart3, ChevronRight, FileText, X, User, LogOut,
  Edit2, Trash2, ChevronDown, CalendarDays, Snowflake, Sun, Power, Check,
  Calendar, Clock, MoreVertical
} from 'lucide-react-native';
import { useRouter } from 'expo-router'; 

import { auth, db } from '../services/firebaseConfig';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { 
  collection, doc, onSnapshot, getDocs, setDoc, updateDoc, 
  deleteDoc, query, where, collectionGroup, addDoc
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

interface AgendamentoGeral {
  id: string;
  ambienteId: string;
  ambienteNome: string;
  titulo: string;
  descricao: string;
  perifericoId: string;
  perifericoNome: string;
  perifericoTipo: string;
  acao: 'ligar' | 'desligar';
  data: string;
  horario: string;
  status: 'pendente' | 'ativo' | 'concluido';
  criadoEm: string;
}

export default function AmbientesScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  
  const [mainTab, setMainTab] = useState<'ambientes' | 'agendamentos'>('ambientes');
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [menuVisibleId, setMenuVisibleId] = useState<string | null>(null);
  const [menuVisibleAgendId, setMenuVisibleAgendId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [isSelectAmbienteOpen, setIsSelectAmbienteOpen] = useState(false);
  
  const [ambientes, setAmbientes] = useState<AmbienteData[]>([]);
  const [empresaId, setEmpresaId] = useState(''); 
  const [selectedAmbiente, setSelectedAmbiente] = useState<AmbienteData | null>(null);
  const [userData, setUserData] = useState({ 
    nome: 'Carregando...', 
    email: '', 
    iniciais: '..' 
  });

  const [agendamentosGeral, setAgendamentosGeral] = useState<AgendamentoGeral[]>([]);

  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formCapacidade, setFormCapacidade] = useState('');
  const [formAndar, setFormAndar] = useState('');

  const [formAgendamento, setFormAgendamento] = useState({
    ambienteId: '',
    nomeAmbiente: 'Selecione o ambiente',
    titulo: '',
    descricao: '',
    perifericoId: '',
    perifericoNome: 'Selecione o periférico',
    perifericoTipo: '',
    acao: '' as 'ligar' | 'desligar' | '',
    acaoLabel: 'Selecione a ação',
    data: '',
    horario: ''
  });
  const [perifericosDoAmbiente, setPerifericosDoAmbiente] = useState<any[]>([]);
  const [isPerifericoDropdownOpen, setIsPerifericoDropdownOpen] = useState(false);
  const [isAcaoDropdownOpen, setIsAcaoDropdownOpen] = useState(false);

  // Helper: check if a schedule is currently active (right day + time within a 30-min window)
  const isScheduleActiveNow = (ag: AgendamentoGeral): boolean => {
    if (ag.status === 'concluido') return false;
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    if (ag.data !== todayStr) return false;
    
    const [schedH, schedM] = ag.horario.split(':').map(Number);
    if (isNaN(schedH) || isNaN(schedM)) return false;
    
    const schedMinutes = schedH * 60 + schedM;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Allow control within a 30-minute window from the scheduled time
    return nowMinutes >= schedMinutes && nowMinutes <= schedMinutes + 30;
  };

  // Toggle peripheral from schedule card
  const handleToggleScheduledPeripheral = async (ag: AgendamentoGeral, turnOn: boolean) => {
    try {
      const perDocRef = doc(db, "empresas", empresaId, "ambientes", ag.ambienteId, "perifericos", ag.perifericoTipo);
      const updateData: any = {};
      updateData[`${ag.perifericoId}.status`] = turnOn;
      updateData[`${ag.perifericoId}.estado_desejado`] = turnOn;
      await updateDoc(perDocRef, updateData);

      // Update schedule status
      const agDocRef = doc(db, "empresas", empresaId, "ambientes", ag.ambienteId, "agendamentos", ag.id);
      await updateDoc(agDocRef, { status: turnOn ? 'ativo' : 'pendente' });
    } catch (e) {
      console.error("Erro ao controlar periférico:", e);
      Alert.alert("Erro", "Falha ao controlar o periférico.");
    }
  };

  // Delete schedule
  const handleDeleteSchedule = (ag: AgendamentoGeral) => {
    setMenuVisibleAgendId(null);
    Alert.alert("Excluir Agendamento", `Deseja excluir "${ag.titulo}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        try {
          await deleteDoc(doc(db, "empresas", empresaId, "ambientes", ag.ambienteId, "agendamentos", ag.id));
        } catch (e) {
          console.error("Erro ao excluir agendamento:", e);
          Alert.alert("Erro", "Falha ao excluir agendamento.");
        }
      }}
    ]);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserData({ nome: 'Desconhecido', email: '', iniciais: '..' });
        setIsLoading(false); 
        return;
      }

      try {
        const userQuery = query(collectionGroup(db, 'usuarios'), where('userId', '==', user.uid));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
          console.log("Usuário não encontrado em nenhuma empresa.");
          setIsLoading(false); 
          return;
        }

        const userDoc = userSnapshot.docs[0];
        const foundEmpresaId = userDoc.ref.parent.parent?.id;

        if (foundEmpresaId) {
          setEmpresaId(foundEmpresaId);

          const dataUser = userDoc.data();
          const nomeEncontrado = dataUser.userName || "Usuário";
          const iniciais = nomeEncontrado.split(' ').filter((n: string) => n.length > 0).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
          setUserData({ nome: nomeEncontrado, email: user.email || "", iniciais });

          const ambientesRef = collection(db, "empresas", foundEmpresaId, "ambientes");
          const unsubAmbientes = onSnapshot(ambientesRef, (snapshot) => {
            const lista: AmbienteData[] = [];
            const ambNamesMap: Record<string, string> = {};
            
            snapshot.forEach((docAmb) => {
              const amb = docAmb.data();
              
              if (docAmb.id.toLowerCase() === 'ambiente_1') return;

              const sensores = amb.sensores || {};
              const nomeExib = amb.dados?.nome || docAmb.id.replace(/_/g, ' ');
              ambNamesMap[docAmb.id] = nomeExib;
              
              lista.push({
                id: docAmb.id,
                nomeExibicao: nomeExib,
                temperatura: sensores.temperatura !== undefined ? `${sensores.temperatura}°` : '--',
                umidade: sensores.umidade !== undefined ? `${sensores.umidade}%` : '--',
                co2: sensores.AQI !== undefined ? String(sensores.AQI) : '--',
                tipo: amb.config?.tipo || amb.tipo || '',
                area: amb.config?.area || amb.area || '',
                capacidade: amb.config?.capacidade || amb.capacidade || '',
                andar: amb.config?.andar || amb.andar || '',
              });
            });

            setAmbientes(lista);
            setIsLoading(false); 

            // Fetch all schedules from all ambientes
            const fetchAllSchedules = async () => {
              const allSchedules: AgendamentoGeral[] = [];
              for (const ambId of Object.keys(ambNamesMap)) {
                try {
                  const ageRef = collection(db, "empresas", foundEmpresaId, "ambientes", ambId, "agendamentos");
                  const ageSnap = await getDocs(ageRef);
                  ageSnap.forEach(docSnap => {
                    if (docSnap.id === 'registro_inicial') return;
                    const data = docSnap.data();
                    allSchedules.push({
                      id: docSnap.id,
                      ambienteId: ambId,
                      ambienteNome: ambNamesMap[ambId] || ambId,
                      titulo: data.titulo || 'Sem Título',
                      descricao: data.descricao || '',
                      perifericoId: data.perifericoId || '',
                      perifericoNome: data.perifericoNome || 'Periférico',
                      perifericoTipo: data.perifericoTipo || '',
                      acao: data.acao || 'ligar',
                      data: data.data || '--/--/----',
                      horario: data.horario || '--:--',
                      status: data.status || 'pendente',
                      criadoEm: data.criadoEm || '',
                    });
                  });
                } catch (e) {
                  console.error(`Erro ao buscar agendamentos do ambiente ${ambId}:`, e);
                }
              }
              // Sort: pending first, then active, then completed
              allSchedules.sort((a, b) => {
                const statusOrder = { pendente: 0, ativo: 1, concluido: 2 };
                const statusDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
                if (statusDiff !== 0) return statusDiff;
                return a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario);
              });
              setAgendamentosGeral(allSchedules);
            };
            fetchAllSchedules();
          });

          return () => unsubAmbientes();
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
        setIsLoading(false);
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
      const ambientesRef = collection(db, "empresas", empresaId, "ambientes");

      if (isEditing && selectedAmbiente) {
        const ambRef = doc(ambientesRef, selectedAmbiente.id);
        await updateDoc(ambRef, {
          "dados.nome": formNome.trim(),
          "config.tipo": formTipo,
          "config.area": formArea || "0",
          "config.capacidade": formCapacidade || "0",
          "config.andar": formAndar
        });
        Alert.alert("Sucesso", "Ambiente atualizado!");
      } else {
        const novoId = formNome.trim().replace(/ /g, '_');
        const snapshot = await getDocs(ambientesRef);
        const docs = snapshot.docs;
        
        if (docs.length === 1 && docs[0].id === 'Ambiente_1') {
          await deleteDoc(doc(ambientesRef, 'Ambiente_1'));
        }

        const novoAmbRef = doc(ambientesRef, novoId);
        const payload = {
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
        };

        await setDoc(novoAmbRef, payload);

        const historicoRef = collection(novoAmbRef, "historico");
        await setDoc(doc(historicoRef, "registro_inicial"), {
          timestamp: new Date().toISOString(),
          temperatura: 0,
          umidade: 0,
          luminosidade: 0,
          indice_conforto: 0 
        });

        const perifericosRef = collection(novoAmbRef, "perifericos");
        await setDoc(doc(perifericosRef, "ar_condicionado"), {
          geral: {
            ligado: false,
            marca: "",
            modelo: "",
            temperatura: 24,
          }
        });

        const agendamentosRef = collection(novoAmbRef, "agendamentos");
        await setDoc(doc(agendamentosRef, "registro_inicial"), {
          timestamp: new Date().toISOString(),
          status: "inicializado",
          observacao: "Pasta criada automaticamente"
        });

        Alert.alert("Sucesso", "Ambiente criado com sucesso!");
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

  const handleSalvarAgendamento = async () => {
    if (!formAgendamento.ambienteId || !formAgendamento.titulo || !formAgendamento.perifericoId || !formAgendamento.acao || !formAgendamento.data || !formAgendamento.horario) {
      Alert.alert("Campos Obrigatórios", "Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setIsSaving(true);
    try {
      const agendamentosRef = collection(db, "empresas", empresaId, "ambientes", formAgendamento.ambienteId, "agendamentos");
      
      await addDoc(agendamentosRef, {
        titulo: formAgendamento.titulo,
        descricao: formAgendamento.descricao,
        perifericoId: formAgendamento.perifericoId,
        perifericoNome: formAgendamento.perifericoNome,
        perifericoTipo: formAgendamento.perifericoTipo,
        acao: formAgendamento.acao,
        data: formAgendamento.data,
        horario: formAgendamento.horario,
        status: 'pendente',
        criadoEm: new Date().toISOString()
      });

      Alert.alert("Sucesso", "Agendamento criado com sucesso!");
      setIsScheduling(false);
      setFormAgendamento({ ambienteId: '', nomeAmbiente: 'Selecione o ambiente', titulo: '', descricao: '', perifericoId: '', perifericoNome: 'Selecione o periférico', perifericoTipo: '', acao: '', acaoLabel: 'Selecione a ação', data: '', horario: '' });
      setPerifericosDoAmbiente([]);
    } catch (e) {
      console.error("Erro ao agendar:", e);
      Alert.alert("Erro", "Falha ao criar o agendamento.");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchPerifericosDoAmbiente = async (ambId: string) => {
    if (!empresaId || !ambId) return;
    try {
      const perRef = collection(db, "empresas", empresaId, "ambientes", ambId, "perifericos");
      const snap = await getDocs(perRef);
      const lista: any[] = [];
      snap.docs.forEach(docSnap => {
        const tipoDocId = docSnap.id;
        const data = docSnap.data();
        Object.entries(data).forEach(([nomeChave, propriedades]: [string, any]) => {
          if (nomeChave === 'tipo' || nomeChave === 'sensores') return;
          if (tipoDocId === 'ar_condicionado' && nomeChave === 'geral') return;
          if (typeof propriedades === 'object' && propriedades !== null) {
            lista.push({
              docId: tipoDocId,
              nomeId: nomeChave,
              nome: nomeChave.replace(/_/g, ' '),
              tipo: tipoDocId.replace(/_/g, ' '),
            });
          }
        });
      });
      setPerifericosDoAmbiente(lista);
    } catch (e) {
      console.error("Erro ao buscar periféricos:", e);
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
    
    Alert.alert(
      "Excluir Ambiente", 
      "Deseja realmente excluir este ambiente e todos os seus dados?", 
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir", 
          style: "destructive", 
          onPress: async () => {
            if(!empresaId) return;
            try {
              const ambRef = doc(db, "empresas", empresaId, "ambientes", id);
              // Deletar subcoleções primeiro
              const subcollections = ['perifericos', 'agendamentos', 'historico'];
              for (const sub of subcollections) {
                const subSnap = await getDocs(collection(ambRef, sub));
                for (const subDoc of subSnap.docs) {
                  await deleteDoc(subDoc.ref);
                }
              }
              await deleteDoc(ambRef);
              Alert.alert("Sucesso", "Ambiente excluído.");
            } catch (e) {
              console.error("Erro ao excluir:", e);
              Alert.alert("Erro", "Falha ao excluir.");
            }
          }
        }
      ]
    );
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente': return '#F59E0B';
      case 'ativo': return '#2563EB';
      case 'concluido': return '#10B981';
      default: return '#94A3B8';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'ativo': return 'Ativo';
      case 'concluido': return 'Concluído';
      default: return status;
    }
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
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Ambientes</Text>
          <Text style={styles.headerSubtitle}>Gerencie seus locais monitorados</Text>
        </View>

        {/* Main Tabs: Ambientes / Agendamentos */}
        <View style={styles.mainTabContainer}>
          <TouchableOpacity 
            style={[styles.mainTabItem, mainTab === 'ambientes' && styles.mainTabActive]} 
            onPress={() => setMainTab('ambientes')}
          >
            <Building2 color={mainTab === 'ambientes' ? '#2563EB' : '#64748B'} size={18} />
            <Text style={[styles.mainTabText, mainTab === 'ambientes' && styles.mainTabTextActive]}>Ambientes</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.mainTabItem, mainTab === 'agendamentos' && styles.mainTabActive]} 
            onPress={() => setMainTab('agendamentos')}
          >
            <CalendarDays color={mainTab === 'agendamentos' ? '#2563EB' : '#64748B'} size={18} />
            <Text style={[styles.mainTabText, mainTab === 'agendamentos' && styles.mainTabTextActive]}>Agendamentos</Text>
          </TouchableOpacity>
        </View>

        {/* ==================== TAB: AMBIENTES ==================== */}
        {mainTab === 'ambientes' && (
          <>
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.btnActionPrimary} onPress={() => { resetForm(); setIsAdding(true); }}>
                <Plus color="#FFF" size={20} />
                <Text style={styles.btnActionPrimaryText}>Novo Ambiente</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnActionSecondary} onPress={() => setIsScheduling(true)}>
                <CalendarDays color="#1E293B" size={20} />
                <Text style={styles.btnActionSecondaryText}>Agendar Sala</Text>
              </TouchableOpacity>
            </View>

            <Pressable style={[styles.searchContainer, isFocused && styles.searchContainerFocused]} onPress={() => inputRef.current?.focus()}>
              <Search color={isFocused ? "#000" : "#64748B"} size={20} />
              <TextInput 
                ref={inputRef} style={styles.searchInput} placeholder="Buscar ambiente..." 
                placeholderTextColor="#94A3B8" value={searchText} onChangeText={setSearchText}
                onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
              />
            </Pressable>

            {isLoading ? (
              [1, 2, 3, 4].map((item) => <SkeletonCard key={item} />)
            ) : ambientesFiltrados.length > 0 ? (
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
          </>
        )}

        {/* ==================== TAB: AGENDAMENTOS ==================== */}
        {mainTab === 'agendamentos' && (
          <>
            <TouchableOpacity style={styles.btnNewSchedule} onPress={() => setIsScheduling(true)}>
              <Plus color="#FFF" size={20} />
              <Text style={styles.btnNewScheduleText}>Novo Agendamento</Text>
            </TouchableOpacity>

            {agendamentosGeral.length > 0 ? (
              agendamentosGeral.map((ag) => {
                const isActiveNow = isScheduleActiveNow(ag);
                return (
                  <View key={`${ag.ambienteId}-${ag.id}`} style={{ zIndex: menuVisibleAgendId === ag.id ? 100 : 1 }}>
                    <View style={[styles.scheduleCard, isActiveNow && styles.scheduleCardActive]}>
                      {/* Header: Title + Status Badge + Menu */}
                      <View style={styles.scheduleHeader}>
                        <View style={styles.scheduleIconBox}>
                          <Calendar color="#3B82F6" size={20} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.scheduleTitle} numberOfLines={1}>{ag.titulo}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ag.status) + '18' }]}>
                              <Text style={[styles.statusBadgeText, { color: getStatusColor(ag.status) }]}>{getStatusLabel(ag.status)}</Text>
                            </View>
                          </View>
                          {ag.descricao ? <Text style={styles.scheduleSubtitle} numberOfLines={2}>{ag.descricao}</Text> : null}
                        </View>
                        <TouchableOpacity 
                          onPress={() => setMenuVisibleAgendId(menuVisibleAgendId === ag.id ? null : ag.id)} 
                          style={{ padding: 6 }}
                        >
                          <MoreVertical color="#94A3B8" size={20} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.cardSeparator} />

                      {/* Environment info */}
                      <View style={styles.scheduleInfoRow}>
                        <View style={styles.scheduleInfoIconBox}>
                          <Building2 color="#2563EB" size={14} />
                        </View>
                        <Text style={styles.scheduleInfoLabel}>Sala:</Text>
                        <Text style={styles.scheduleInfoValue}>{ag.ambienteNome}</Text>
                      </View>

                      {/* Peripheral info */}
                      <View style={styles.scheduleInfoRow}>
                        <View style={styles.scheduleInfoIconBox}>
                          {ag.perifericoTipo?.toLowerCase().includes('ar') 
                            ? <Snowflake color="#06B6D4" size={14} />
                            : <Zap color="#F59E0B" size={14} />
                          }
                        </View>
                        <Text style={styles.scheduleInfoLabel}>Periférico:</Text>
                        <Text style={styles.scheduleInfoValue}>{ag.perifericoNome}</Text>
                        <View style={[styles.acaoBadge, { backgroundColor: ag.acao === 'ligar' ? '#DCFCE7' : '#FEE2E2' }]}>
                          <Power color={ag.acao === 'ligar' ? '#16A34A' : '#DC2626'} size={12} />
                          <Text style={[styles.acaoBadgeText, { color: ag.acao === 'ligar' ? '#16A34A' : '#DC2626' }]}>
                            {ag.acao === 'ligar' ? 'Ligar' : 'Desligar'}
                          </Text>
                        </View>
                      </View>

                      {/* Date & Time */}
                      <View style={styles.scheduleFooter}>
                        <View style={styles.scheduleFooterItem}>
                          <Calendar size={14} color="#64748B" />
                          <Text style={styles.scheduleFooterText}>{ag.data}</Text>
                        </View>
                        <View style={styles.scheduleFooterItem}>
                          <Clock size={14} color="#64748B" />
                          <Text style={styles.scheduleFooterText}>{ag.horario}</Text>
                        </View>
                      </View>

                      {/* Control switch - only enabled when schedule is active now */}
                      {isActiveNow && (
                        <View style={styles.scheduleControlRow}>
                          <Text style={styles.scheduleControlLabel}>Controlar agora:</Text>
                          <TouchableOpacity 
                            style={[styles.controlBtn, { backgroundColor: ag.acao === 'ligar' ? '#10B981' : '#EF4444' }]}
                            onPress={() => handleToggleScheduledPeripheral(ag, ag.acao === 'ligar')}
                          >
                            <Power color="#FFF" size={16} />
                            <Text style={styles.controlBtnText}>{ag.acao === 'ligar' ? 'Ligar' : 'Desligar'}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {!isActiveNow && ag.status === 'pendente' && (
                        <View style={styles.scheduleInactiveNote}>
                          <Clock color="#94A3B8" size={14} />
                          <Text style={styles.scheduleInactiveText}>Controle disponível no horário agendado</Text>
                        </View>
                      )}
                    </View>

                    {/* Action Menu */}
                    {menuVisibleAgendId === ag.id && (
                      <View style={styles.actionMenu}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => {
                          setMenuVisibleAgendId(null);
                          router.push({
                            pathname: '/ambiente',
                            params: { id: ag.ambienteId, nome: ag.ambienteNome, empresa: empresaId }
                          });
                        }}>
                          <Building2 size={16} color="#475569" /><Text style={styles.menuText}>Ver Ambiente</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteSchedule(ag)}>
                          <Trash2 size={16} color="#EF4444" /><Text style={[styles.menuText, {color: '#EF4444'}]}>Excluir</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyScheduleCard}>
                <CalendarDays color="#94A3B8" size={48} />
                <Text style={styles.emptyScheduleTitle}>Nenhum agendamento no momento</Text>
                <Text style={styles.emptyScheduleText}>Crie um agendamento para controlar periféricos automaticamente.</Text>
              </View>
            )}
          </>
        )}
        
        <View style={{height: 100}} /> 
      </ScrollView>

      {/* MODAL CRIAR/EDITAR AMBIENTE */}
      <Modal visible={isAdding} transparent animationType="fade" onRequestClose={() => setIsAdding(false)}>
        <View style={styles.modalOverlayBlack}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{isEditing ? "Editar Ambiente" : "Novo Ambiente"}</Text>
            <Text style={styles.formSubtitle}>
              {isEditing ? "Edite os dados do ambiente" : "Configure os dados do local"}
            </Text>

            <Text style={styles.label}>Nome do Ambiente *</Text>
            <View style={styles.inputBox}>
              <TextInput style={styles.input} placeholder="Ex: Sala de Reunião" value={formNome} onChangeText={setFormNome} />
            </View>

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

      {/* MODAL AGENDAR SALA */}
      <Modal visible={isScheduling} transparent animationType="slide" onRequestClose={() => setIsScheduling(false)}>
        <View style={styles.modalOverlayBlack}>
          <View style={[styles.formCard, { paddingVertical: 35 }]}>
            <Text style={styles.formTitle}>Agendar Sala</Text>
            <Text style={styles.formSubtitle}>Defina um horário para climatização de ambiente</Text>

            <Text style={styles.label}>Ambiente</Text>
            <TouchableOpacity 
              style={[styles.inputBox, { justifyContent: 'space-between' }]} 
              onPress={() => setIsSelectAmbienteOpen(!isSelectAmbienteOpen)}
            >
              <Text style={{ color: formAgendamento.ambienteId ? '#000' : '#94A3B8' }}>{formAgendamento.nomeAmbiente}</Text>
              <ChevronDown color="#94A3B8" size={20} />
            </TouchableOpacity>

            {isSelectAmbienteOpen && (
              <View style={styles.dropdownContainer}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                  {ambientes.map(amb => (
                    <TouchableOpacity 
                      key={amb.id} 
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormAgendamento(prev => ({ ...prev, ambienteId: amb.id, nomeAmbiente: amb.nomeExibicao, perifericoId: '', perifericoNome: 'Selecione o periférico', perifericoTipo: '' }));
                        setIsSelectAmbienteOpen(false);
                        fetchPerifericosDoAmbiente(amb.id);
                      }}
                    >
                      <Text style={styles.dropdownText}>{amb.nomeExibicao}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Título *</Text>
            <View style={styles.inputBox}>
              <TextInput 
                style={styles.input} placeholder="Ex: Climatização para reunião" 
                value={formAgendamento.titulo} 
                onChangeText={(t) => setFormAgendamento(prev => ({...prev, titulo: t}))} 
              />
            </View>

            <Text style={styles.label}>Descrição</Text>
            <View style={[styles.inputBox, { height: 60 }]}>
              <TextInput 
                style={[styles.input, { height: 50, textAlignVertical: 'top' }]} placeholder="Ex: Ligar ar-condicionado antes da reunião" 
                value={formAgendamento.descricao} 
                onChangeText={(t) => setFormAgendamento(prev => ({...prev, descricao: t}))}
                multiline
              />
            </View>

            <Text style={styles.label}>Periférico *</Text>
            <TouchableOpacity 
              style={[styles.inputBox, { justifyContent: 'space-between' }]}
              onPress={() => { setIsPerifericoDropdownOpen(!isPerifericoDropdownOpen); setIsAcaoDropdownOpen(false); }}
            >
              <Text style={{ color: formAgendamento.perifericoId ? '#000' : '#94A3B8' }}>{formAgendamento.perifericoNome}</Text>
              <ChevronDown color="#94A3B8" size={20} />
            </TouchableOpacity>
            {isPerifericoDropdownOpen && (
              <View style={styles.dropdownContainer}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 130 }}>
                  {perifericosDoAmbiente.length > 0 ? perifericosDoAmbiente.map((p) => (
                    <TouchableOpacity 
                      key={`${p.docId}-${p.nomeId}`}
                      style={[styles.dropdownItem, formAgendamento.perifericoId === p.nomeId && styles.dropdownItemActive]}
                      onPress={() => {
                        setFormAgendamento(prev => ({ ...prev, perifericoId: p.nomeId, perifericoNome: p.nome, perifericoTipo: p.docId }));
                        setIsPerifericoDropdownOpen(false);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {p.docId?.toLowerCase().includes('ar') ? <Snowflake color="#06B6D4" size={16} /> : <Zap color="#F59E0B" size={16} />}
                        <Text style={styles.dropdownText}>{p.nome}</Text>
                      </View>
                      {formAgendamento.perifericoId === p.nomeId && <Check color="#2563EB" size={18} />}
                    </TouchableOpacity>
                  )) : (
                    <View style={styles.dropdownItem}>
                      <Text style={[styles.dropdownText, { color: '#94A3B8' }]}>Selecione um ambiente primeiro</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Ação *</Text>
            <TouchableOpacity 
              style={[styles.inputBox, { justifyContent: 'space-between' }]}
              onPress={() => { setIsAcaoDropdownOpen(!isAcaoDropdownOpen); setIsPerifericoDropdownOpen(false); }}
            >
              <Text style={{ color: formAgendamento.acao ? '#000' : '#94A3B8' }}>{formAgendamento.acaoLabel}</Text>
              <ChevronDown color="#94A3B8" size={20} />
            </TouchableOpacity>
            {isAcaoDropdownOpen && (
              <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                  style={[styles.dropdownItem, formAgendamento.acao === 'ligar' && styles.dropdownItemActive]}
                  onPress={() => { setFormAgendamento(prev => ({ ...prev, acao: 'ligar', acaoLabel: 'Ligar' })); setIsAcaoDropdownOpen(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Power color="#10B981" size={16} /><Text style={styles.dropdownText}>Ligar</Text>
                  </View>
                  {formAgendamento.acao === 'ligar' && <Check color="#2563EB" size={18} />}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.dropdownItem, formAgendamento.acao === 'desligar' && styles.dropdownItemActive]}
                  onPress={() => { setFormAgendamento(prev => ({ ...prev, acao: 'desligar', acaoLabel: 'Desligar' })); setIsAcaoDropdownOpen(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Power color="#EF4444" size={16} /><Text style={styles.dropdownText}>Desligar</Text>
                  </View>
                  {formAgendamento.acao === 'desligar' && <Check color="#2563EB" size={18} />}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Data *</Text>
                <View style={styles.inputBox}>
                  <TextInput 
                    style={styles.input} placeholder="DD/MM/AAAA" 
                    value={formAgendamento.data} 
                    onChangeText={(t) => setFormAgendamento(prev => ({...prev, data: t}))} 
                  />
                </View>
              </View>
              <View style={{width: 15}} />
              <View style={{flex: 1}}>
                <Text style={styles.label}>Horário *</Text>
                <View style={styles.inputBox}>
                  <TextInput 
                    style={styles.input} placeholder="HH:MM" 
                    value={formAgendamento.horario} 
                    onChangeText={(t) => setFormAgendamento(prev => ({...prev, horario: t}))} 
                  />
                </View>
              </View>
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity style={styles.btnCancelForm} onPress={() => setIsScheduling(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCreateForm} onPress={handleSalvarAgendamento} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnCreateText}>Criar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PERFIL — lateral direita */}
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
          <MoreVertical color="#1E293B" size={22} />
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

function SkeletonCard() {
  const fadeAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.roomCard, { opacity: fadeAnim, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
      <View style={styles.roomHeader}>
        <View style={styles.roomInfoMain}>
          <View style={[styles.roomIconBox, { backgroundColor: '#E2E8F0' }]} />
          <View>
            <View style={{ width: 120, height: 18, backgroundColor: '#E2E8F0', borderRadius: 6, marginBottom: 8 }} />
            <View style={{ width: 80, height: 14, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
          </View>
        </View>
      </View>
      <View style={styles.metricsRow}>
        <View style={[styles.metricBox, { backgroundColor: '#E2E8F0', height: 60 }]} />
        <View style={[styles.metricBox, { backgroundColor: '#E2E8F0', height: 60 }]} />
        <View style={[styles.metricBox, { backgroundColor: '#E2E8F0', height: 60 }]} />
      </View>
    </Animated.View>
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
  // Main tabs
  mainTabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 20 },
  mainTabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  mainTabActive: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  mainTabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  mainTabTextActive: { color: '#2563EB' },
  // Action buttons
  actionButtonsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  btnActionPrimary: { flex: 1, backgroundColor: '#2563EB', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnActionPrimaryText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  btnActionSecondary: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnActionSecondaryText: { color: '#1E293B', fontWeight: 'bold', fontSize: 15 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 25, borderWidth: 1, borderColor: '#E2E8F0', gap: 10, overflow: 'hidden' },
  searchContainerFocused: { borderColor: '#000', backgroundColor: '#FFF' },
  searchInput: { flex: 1, fontSize: 15, color: '#1E293B', paddingVertical: 0, outlineWidth: 0, outlineColor: "transparent" as any },
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
  actionMenu: { position: 'absolute', right: 30, top: 60, backgroundColor: '#FFF', borderRadius: 12, width: 150, elevation: 15, borderWidth: 1, borderColor: '#F1F5F9', padding: 5, zIndex: 999 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  menuText: { fontSize: 14, fontWeight: '500', color: '#475569' },
  // Schedule styles
  btnNewSchedule: { backgroundColor: '#2563EB', height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  btnNewScheduleText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  scheduleCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2 },
  scheduleCardActive: { borderColor: '#93C5FD', borderWidth: 2, backgroundColor: '#F0F9FF' },
  scheduleHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  scheduleIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  scheduleTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', flex: 1 },
  scheduleSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 17 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardSeparator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  scheduleInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  scheduleInfoIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  scheduleInfoLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  scheduleInfoValue: { fontSize: 13, color: '#1E293B', fontWeight: '600', flex: 1 },
  acaoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  acaoBadgeText: { fontSize: 11, fontWeight: '700' },
  scheduleFooter: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  scheduleFooterItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scheduleFooterText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  scheduleControlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#DBEAFE' },
  scheduleControlLabel: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  controlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  controlBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  scheduleInactiveNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  scheduleInactiveText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  emptyScheduleCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 40, alignItems: 'center', elevation: 2, marginVertical: 10 },
  emptyScheduleTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 8, textAlign: 'center', marginTop: 12 },
  emptyScheduleText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  // Bottom tab
  bottomTab: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 75, backgroundColor: '#FFF', flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8F0', paddingBottom: 15 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeIndicator: { position: 'absolute', bottom: 10, width: 4, height: 4, borderRadius: 2, backgroundColor: '#2563EB' },
  // Modals
  modalOverlayBlack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  formCard: { backgroundColor: '#FFF', borderRadius: 25, padding: 25 },
  formTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#000', marginBottom: 5 },
  formSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 25 },
  label: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  inputBox: { height: 50, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 18, overflow: 'hidden' },
  input: { flex: 1, fontSize: 15, color: '#000', paddingVertical: 0, outlineWidth: 0, outlineColor: "transparent" as any },
  row: { flexDirection: 'row' },
  formButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btnCancelForm: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCreateForm: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  btnCancelText: { color: '#64748B', fontWeight: 'bold' },
  btnCreateText: { color: '#FFF', fontWeight: 'bold' },
  dropdownContainer: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginTop: -15, marginBottom: 18, elevation: 2 },
  dropdownItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownText: { fontSize: 15, color: '#1E293B' },
  // Modal perfil lateral direita
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' },
  modalBackdrop: { flex: 0.15 },
  profileSheet: { flex: 0.85, backgroundColor: '#FFF', padding: 24, paddingTop: 60, borderTopLeftRadius: 30, borderBottomLeftRadius: 30 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  profileTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  profileUserInfo: { alignItems: 'center', marginBottom: 25 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  largeAvatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  userEmail: { fontSize: 14, color: '#64748B' },
  separator: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 20 },
  configItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  configItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  configIconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  configItemTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  configItemSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  btnSignOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 16 },
  btnSignOutText: { color: '#EF4444', fontSize: 16, fontWeight: 'bold' }
});