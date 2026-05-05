import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  Dimensions, Image, Modal, Pressable, Switch, Alert, ActivityIndicator,
  TextInput, FlatList, Animated
} from 'react-native';
import { 
  Bell, Plus, Zap, Building2, BarChart3, FileText,
  X, User, LogOut, Snowflake, Sun, ChevronRight, ChevronDown, MoreVertical,
  Edit2, Trash2
} from 'lucide-react-native';
import { useRouter } from 'expo-router'; 

import { auth, db } from '../services/firebaseConfig';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { 
  collection, doc, getDocs, setDoc, updateDoc, onSnapshot,
  query, where, collectionGroup 
} from "firebase/firestore";

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png'); 

// Tipos de periférico disponíveis para seleção
const TIPOS_PERIFERICO = ['ar_condicionado', 'tomada', 'outro'];
const TIPOS_LABEL: Record<string, string> = {
  ar_condicionado: 'Ar Condicionado',
  tomada: 'Tomada',
  outro: 'Outro'
};

interface PerifericoData {
  id: string; 
  nome: string; 
  tipo: string; 
  localizacao: string; 
  marca: string; 
  subTipo?: string; // Usado para salvar o "tipo" quando é tomada
  capacidade?: string; 
  estado_real: boolean; 
  estado_desejado: boolean; 
  ambienteId: string;
}

export default function PerifericosScreen() {
  const router = useRouter();
  
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [isAdding, setIsAdding] = useState(false); 
  const [isEditing, setIsEditing] = useState(false);
  const [menuVisibleId, setMenuVisibleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  
  const [perifericos, setPerifericos] = useState<PerifericoData[]>([]);
  const [empresaId, setEmpresaId] = useState<string>('');
  const [selectedPerif, setSelectedPerif] = useState<PerifericoData | null>(null);
  const [userData, setUserData] = useState({ nome: 'Carregando...', email: '', iniciais: '..' });

  const [ambientesDisponiveis, setAmbientesDisponiveis] = useState<{id: string, nome: string}[]>([]);
  const [showAmbienteModal, setShowAmbienteModal] = useState(false);
  const [showTipoModal, setShowTipoModal] = useState(false);

  const [formNome, setFormNome] = useState('');
  const [formAmbiente, setFormAmbiente] = useState(''); 
  const [formAmbienteId, setFormAmbienteId] = useState(''); 
  const [formTipo, setFormTipo] = useState(''); // 'ar_condicionado' | 'tomada' | 'outro'
  const [formTipoCustom, setFormTipoCustom] = useState(''); // usado quando tipo = 'outro'
  const [formMarca, setFormMarca] = useState('');
  const [formSubTipo, setFormSubTipo] = useState(''); // Usado no lugar de marca quando é tomada
  const [formCapacidade, setFormCapacidade] = useState(''); // capacidade (AC) ou IP (tomada)
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { setIsLoading(false); return; }
      try {
        const userQuery = query(collectionGroup(db, 'usuarios'), where('userId', '==', user.uid));
        const userSnapshot = await getDocs(userQuery);
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const foundEmpresaId = userDoc.ref.parent.parent?.id || '';
          if (foundEmpresaId) {
            setEmpresaId(foundEmpresaId);
            const dataUser = userDoc.data();
            const nomeEncontrado = dataUser.userName || "Usuário";
            const iniciais = nomeEncontrado.split(' ').filter((n: string) => n.length > 0).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            setUserData({ nome: nomeEncontrado, email: user.email || "", iniciais });
            carregarDados(foundEmpresaId);
          }
        }
      } catch (error) { console.error("Erro auth:", error); setIsLoading(false); }
    });
    return () => unsubscribeAuth();
  }, []);

  const carregarDados = async (empId: string) => {
    try {
      const ambientesRef = collection(db, "empresas", empId, "ambientes");
      const ambientesSnap = await getDocs(ambientesRef);
      
      const listaAmbientes: {id: string, nome: string}[] = [];
      const listaPerifericos: PerifericoData[] = [];

      const promises = ambientesSnap.docs.map(async (docAmb) => {
        const ambId = docAmb.id;
        const ambData = docAmb.data();
        const ambNome = ambData.dados?.nome || docAmb.id.replace(/_/g, ' ');
        
        if (ambId.toLowerCase() !== 'ambiente_1') {
          listaAmbientes.push({ id: ambId, nome: ambNome });
        }

        const perRef = collection(db, "empresas", empId, "ambientes", ambId, "perifericos");
        const perSnap = await getDocs(perRef);
        
        perSnap.forEach((docType) => {
          const deviceType = docType.id;
          const data = docType.data();
          Object.entries(data).forEach(([key, value]: [string, any]) => {
            if (key === 'sensores' || key === 'sensoresGerais' || key === 'tipo' || key === 'id' || key.toLowerCase() === 'geral') return;
            if (typeof value === 'object' && value !== null) {
              listaPerifericos.push({
                id: key, 
                nome: value.nome || key.replace(/_/g, ' '), // Carrega o nome filho, se houver
                tipo: deviceType, 
                localizacao: ambNome,
                marca: value.marca || "Genérico",
                subTipo: value.tipo || "", // Se for tomada, foi salvo como 'tipo' em vez de 'marca'
                capacidade: value.capacidade || value.ip || "",
                estado_real: value.estado_real || false,
                estado_desejado: value.estado_desejado || false,
                ambienteId: ambId
              });
            }
          });
        });
      });

      await Promise.all(promises);
      setAmbientesDisponiveis(listaAmbientes);
      setPerifericos(listaPerifericos);
      setIsLoading(false); 
    } catch (error) { console.error("Erro ao carregar:", error); setIsLoading(false); }
  };

  // Retorna o tipo final (custom se 'outro')
  const getTipoFinal = () => formTipo === 'outro' ? formTipoCustom.replace(/ /g, '_').toLowerCase() : formTipo;

  const handleSalvarPeriferico = async () => {
    const tipoFinal = getTipoFinal();
    if (!formNome || !tipoFinal || !formAmbienteId || !empresaId) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios (*)");
      return;
    }
    if (formNome.trim().toLowerCase() === 'geral') {
      Alert.alert("Atenção", "O nome 'Geral' é reservado pelo sistema.");
      return;
    }

    setIsSaving(true);
    try {
      const formattedPerNameId = formNome.trim(); 
      const formattedDeviceTypeId = tipoFinal;
      const perDocRef = doc(db, "empresas", empresaId, "ambientes", formAmbienteId, "perifericos", formattedDeviceTypeId);

      // Monta o payload conforme o tipo e salva nome e estados booleanos
      let peripheralPayload: any = { 
        nome: formattedPerNameId,
        estado_real: isEditing && selectedPerif ? selectedPerif.estado_real : false,
        estado_desejado: isEditing && selectedPerif ? selectedPerif.estado_desejado : false
      };

      if (formTipo === 'ar_condicionado') {
        peripheralPayload.marca = formMarca || "Genérico";
        peripheralPayload.capacidade = formCapacidade || "";
      } else if (formTipo === 'tomada') {
        peripheralPayload.tipo = formSubTipo || "Genérico"; // Campo 'marca' substituído por 'tipo' na tomada
        peripheralPayload.ip = formCapacidade || ""; // capacidade vira ip
      } else {
        // outro — só marca
        peripheralPayload.marca = formMarca || "Genérico";
      }

      if (isEditing && selectedPerif) {
        const updateData: any = {};
        updateData[selectedPerif.id] = peripheralPayload;
        await updateDoc(perDocRef, updateData);
        Alert.alert("Sucesso", "Periférico atualizado!");
      } else {
        const docSnap = await getDocs(collection(db, "empresas", empresaId, "ambientes", formAmbienteId, "perifericos"));
        const docRef = docSnap.docs.find(d => d.id === formattedDeviceTypeId);
        if (docRef && docRef.exists()) {
          const data: any = docRef.data();
          if (data[formattedPerNameId]) { Alert.alert("Erro", "Já existe um periférico com este nome neste ambiente."); setIsSaving(false); return; }
          data[formattedPerNameId] = peripheralPayload;
          await setDoc(perDocRef, data); 
        } else {
          const newData: any = {};
          newData[formattedPerNameId] = peripheralPayload;
          await setDoc(perDocRef, newData);
        }
        Alert.alert("Sucesso", "Periférico criado!");
      }

      setIsAdding(false);
      resetForm();
      carregarDados(empresaId); 
    } catch (error) { console.error(error); Alert.alert("Erro", "Falha na operação."); }
    finally { setIsSaving(false); }
  };

  const handleOpenEdit = (item: PerifericoData) => {
    setSelectedPerif(item);
    setFormNome(item.nome);
    setFormAmbiente(item.localizacao);
    setFormAmbienteId(item.ambienteId);
    // Detecta se o tipo é um dos padrões ou customizado
    const tiposPadrao = ['ar_condicionado', 'tomada'];
    if (tiposPadrao.includes(item.tipo)) {
      setFormTipo(item.tipo);
      setFormTipoCustom('');
    } else {
      setFormTipo('outro');
      setFormTipoCustom(item.tipo);
    }
    setFormMarca(item.marca);
    setFormSubTipo(item.subTipo || '');
    setFormCapacidade(item.capacidade || '');
    setIsEditing(true);
    setIsAdding(true);
    setMenuVisibleId(null);
  };

  const handleDeletePeriferico = (item: PerifericoData) => {
    setMenuVisibleId(null);
    Alert.alert("Excluir", `Deseja remover ${item.nome}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        if (!empresaId) return;
        try {
          const perDocRef = doc(db, "empresas", empresaId, "ambientes", item.ambienteId, "perifericos", item.tipo);
          const docSnap = await getDocs(collection(db, "empresas", empresaId, "ambientes", item.ambienteId, "perifericos"));
          const docRef = docSnap.docs.find(d => d.id === item.tipo);
          if (docRef && docRef.exists()) {
            const data = docRef.data();
            delete data[item.id]; 
            await setDoc(perDocRef, data); 
            carregarDados(empresaId);
          } else { Alert.alert("Erro", "Periférico não encontrado."); }
        } catch (e) { console.error(e); Alert.alert("Erro", "Falha ao excluir."); }
      }}
    ]);
  };

  const resetForm = () => {
    setFormNome(''); setFormAmbiente(''); setFormAmbienteId(''); 
    setFormTipo(''); setFormTipoCustom(''); setFormMarca(''); 
    setFormSubTipo(''); setFormCapacidade('');
    setSelectedPerif(null); setIsEditing(false);
  };

  const handleLogout = async () => {
    try { await signOut(auth); setIsProfileVisible(false); router.replace('/'); } 
    catch (error) { Alert.alert("Erro", "Não foi possível sair."); }
  };

  // Label do campo variável conforme tipo
  const getCapacidadeLabel = () => {
    if (formTipo === 'tomada') return 'IP';
    return 'Capacidade';
  };
  const getCapacidadePlaceholder = () => {
    if (formTipo === 'tomada') return 'Ex: 192.168.1.1';
    return 'Ex: 12000 BTU';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAppBar}>
        <Image source={LogoImg} style={styles.topLogo} resizeMode="contain" />
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBadge} onPress={() => router.push('/notificacao')}><Bell color="#000" size={24} /></TouchableOpacity>
          <TouchableOpacity style={styles.avatarCircle} onPress={() => setIsProfileVisible(true)}><Text style={styles.avatarText}>{userData.iniciais}</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Periféricos</Text>
          <Text style={styles.headerSubtitle}>Controle seus dispositivos conectados</Text>
        </View>

        <TouchableOpacity style={styles.btnNewItem} onPress={() => { resetForm(); setIsAdding(true); }}>
          <Plus color="#FFF" size={20} /><Text style={styles.btnNewItemText}>Novo Periférico</Text>
        </TouchableOpacity>

        {isLoading ? (
          [1, 2, 3, 4].map((item) => <SkeletonCard key={item} />)
        ) : perifericos.length > 0 ? (
          perifericos.map((p) => (
            <View key={`${p.ambienteId}-${p.id}`} style={{ zIndex: menuVisibleId === p.id ? 100 : 1 }}>
              <PeripheralCard 
                title={p.nome} subtitle={p.tipo} location={p.localizacao} 
                brand={p.tipo === 'tomada' ? p.subTipo : p.marca} // Exibe o tipo digitado se for tomada
                estadoDesejado={p.estado_desejado} empresaId={empresaId} ambienteId={p.ambienteId}
                deviceType={p.tipo} perifericoId={p.id} 
                icon={p.tipo.toLowerCase().includes('ar') ? <Snowflake color="#06B6D4" size={24}/> : <Sun color="#06B6D4" size={24}/>}
                onMore={() => setMenuVisibleId(menuVisibleId === p.id ? null : p.id)}
              />
              {menuVisibleId === p.id && (
                <View style={styles.actionMenu}>
                  <TouchableOpacity style={styles.menuItem} onPress={() => handleOpenEdit(p)}>
                    <Edit2 size={16} color="#475569" /><Text style={styles.menuText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => handleDeletePeriferico(p)}>
                    <Trash2 size={16} color="#EF4444" /><Text style={[styles.menuText, {color: '#EF4444'}]}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: '#94A3B8' }}>Nenhum dispositivo encontrado.</Text>
          </View>
        )}
        <View style={{height: 100}} /> 
      </ScrollView>

      {/* MODAL DO FORMULÁRIO */}
      <Modal visible={isAdding} transparent animationType="fade">
        <View style={styles.formOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{isEditing ? "Editar Periférico" : "Novo Periférico"}</Text>
              <Text style={styles.formSubtitle}>{isEditing ? selectedPerif?.nome : "Adicione o dispositivo para o controle remoto"}</Text>

              {!isEditing && (
                <>
                  <Text style={styles.label}>Nome *</Text>
                  <View style={styles.inputBox}>
                    <TextInput style={styles.input} placeholder="Ex: Ar Condicionado Principal" value={formNome} onChangeText={setFormNome} />
                  </View>

                  <Text style={styles.label}>Ambiente *</Text>
                  <TouchableOpacity style={styles.inputBox} onPress={() => setShowAmbienteModal(true)}>
                    <Text style={[styles.inputText, !formAmbiente && {color: '#94A3B8'}]}>{formAmbiente || "Selecione o ambiente"}</Text>
                    <ChevronDown color="#64748B" size={20} />
                  </TouchableOpacity>

                  <Text style={styles.label}>Tipo de Sistema *</Text>
                  <TouchableOpacity style={styles.inputBox} onPress={() => setShowTipoModal(true)}>
                    <Text style={[styles.inputText, !formTipo && {color: '#94A3B8'}]}>
                      {formTipo ? TIPOS_LABEL[formTipo] || formTipo : "Selecione o tipo"}
                    </Text>
                    <ChevronDown color="#64748B" size={20} />
                  </TouchableOpacity>

                  {/* Campo de tipo customizado quando 'outro' */}
                  {formTipo === 'outro' && (
                    <>
                      <Text style={styles.label}>Especifique o Tipo *</Text>
                      <View style={styles.inputBox}>
                        <TextInput style={styles.input} placeholder="Ex: Ventilador, Projetor..." value={formTipoCustom} onChangeText={setFormTipoCustom} />
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Campos variáveis conforme tipo */}
              {formTipo === 'outro' ? (
                // Apenas Marca para 'outro'
                <>
                  <Text style={styles.label}>Marca</Text>
                  <View style={styles.inputBox}>
                    <TextInput style={styles.input} placeholder="Ex: LG" value={formMarca} onChangeText={setFormMarca} />
                  </View>
                </>
              ) : (
                // Marca (ou Tipo se for Tomada) + Capacidade/IP
                <View style={styles.row}>
                  <View style={{flex: 1}}>
                    <Text style={styles.label}>{formTipo === 'tomada' ? 'Tipo' : 'Marca'}</Text>
                    <View style={styles.inputBox}>
                      <TextInput 
                        style={styles.input} 
                        placeholder={formTipo === 'tomada' ? "Ex: 220v, 110v..." : "Ex: LG"} 
                        value={formTipo === 'tomada' ? formSubTipo : formMarca} 
                        onChangeText={formTipo === 'tomada' ? setFormSubTipo : setFormMarca} 
                      />
                    </View>
                  </View>
                  <View style={{width: 15}} />
                  <View style={{flex: 1}}>
                    <Text style={styles.label}>{getCapacidadeLabel()}</Text>
                    <View style={styles.inputBox}>
                      <TextInput 
                        style={styles.input} 
                        placeholder={getCapacidadePlaceholder()} 
                        value={formCapacidade} 
                        onChangeText={setFormCapacidade}
                        keyboardType={formTipo === 'tomada' ? 'numeric' : 'default'}
                      />
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.formButtons}>
                <TouchableOpacity style={styles.btnCancelForm} onPress={() => { setIsAdding(false); resetForm(); }}>
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnCreateForm} onPress={handleSalvarPeriferico}>
                  {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnCreateText}>{isEditing ? "Salvar" : "Criar"}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
              data={ambientesDisponiveis}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => { setFormAmbiente(item.nome); setFormAmbienteId(item.id); setShowAmbienteModal(false); }}>
                  <Text style={[styles.pickerText, formAmbiente === item.nome && {color: '#2563EB', fontWeight: 'bold'}]}>{item.nome}</Text>
                  {formAmbiente === item.nome && <Zap color="#2563EB" size={20} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* SELETOR DE TIPO */}
      <Modal visible={showTipoModal} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selecionar Tipo</Text>
              <TouchableOpacity onPress={() => setShowTipoModal(false)}><X color="#000" size={24}/></TouchableOpacity>
            </View>
            {TIPOS_PERIFERICO.map((tipo) => (
              <TouchableOpacity key={tipo} style={styles.pickerItem} onPress={() => { setFormTipo(tipo); setFormTipoCustom(''); setFormCapacidade(''); setShowTipoModal(false); }}>
                <Text style={[styles.pickerText, formTipo === tipo && {color: '#2563EB', fontWeight: 'bold'}]}>{TIPOS_LABEL[tipo]}</Text>
                {formTipo === tipo && <Zap color="#2563EB" size={20} />}
              </TouchableOpacity>
            ))}
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
        <TabItem icon={<Building2 size={24} color="#64748B" />} onPress={() => router.push('/ambientes')} />
        <TabItem icon={<Zap size={24} color="#2563EB" />} active onPress={() => router.push('/perifericos')} />
        <TabItem icon={<Bell size={24} color="#64748B" />} onPress={() => router.push('/notificacao')} />
        <TabItem icon={<BarChart3 size={24} color="#64748B" />} onPress={() => router.push('/relatorios')} />
      </View>
    </SafeAreaView>
  );
}

// ✅ PeripheralCard usando estado_desejado no liga/desliga
function PeripheralCard({ title, subtitle, location, brand, icon, estadoDesejado, empresaId, ambienteId, deviceType, perifericoId, onMore }: any) {
  const [localStatus, setLocalStatus] = useState(estadoDesejado);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaId || !ambienteId || !deviceType) return;
    const perDocRef = doc(db, "empresas", empresaId, "ambientes", ambienteId, "perifericos", deviceType);
    const unsub = onSnapshot(perDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data[perifericoId] !== undefined) {
          // Atualiza baseando-se no estado_desejado
          setLocalStatus(data[perifericoId].estado_desejado || false);
        }
      }
    });
    return () => unsub();
  }, [empresaId, ambienteId, deviceType, perifericoId]);

  const toggleSwitch = async () => {
    if (loading || !empresaId) return;
    setLoading(true);
    try {
      const perDocRef = doc(db, "empresas", empresaId, "ambientes", ambienteId, "perifericos", deviceType);
      const updateData: any = {};
      // Atualiza no banco o estado_desejado, em vez do antigo status
      updateData[`${perifericoId}.estado_desejado`] = !localStatus;
      await updateDoc(perDocRef, updateData);
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Falha ao atualizar status.");
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.peripheralCard}>
      <View style={styles.peripheralHeader}>
        <View style={styles.peripheralInfoMain}>
          <View style={styles.peripheralIconBox}>{icon}</View>
          <View style={{flex: 1}}>
            <Text style={styles.peripheralTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.peripheralSubtitle}>{subtitle}</Text>
          </View>
          {loading && <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 5 }} />}
          <TouchableOpacity onPress={onMore} style={{padding: 8}}><MoreVertical color="#1E293B" size={20}/></TouchableOpacity>
        </View>
      </View>
      <View style={styles.cardSeparator} />
      <View style={styles.peripheralFooter}>
        <View>
          <Text style={styles.locationText}>{location}</Text>
          <Text style={styles.brandText}>{brand}</Text>
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.statusText, {color: localStatus ? '#2563EB' : '#94A3B8'}]}>{localStatus ? 'Ligado' : 'Desligado'}</Text>
          <Switch 
            trackColor={{ false: "#E2E8F0", true: "#DBEAFE" }} 
            thumbColor={localStatus ? "#2563EB" : "#94A3B8"} 
            onValueChange={toggleSwitch} 
            value={localStatus} 
            disabled={loading} 
          />
        </View>
      </View>
    </View>
  );
}

function SkeletonCard() {
  const fadeAnim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
    ])).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.peripheralCard, { opacity: fadeAnim, borderColor: '#E2E8F0' }]}>
      <View style={styles.peripheralHeader}>
        <View style={styles.peripheralInfoMain}>
          <View style={[styles.peripheralIconBox, { backgroundColor: '#E2E8F0' }]} />
          <View style={{flex: 1}}>
            <View style={{ width: width * 0.4, height: 16, backgroundColor: '#E2E8F0', borderRadius: 6, marginBottom: 8 }} />
            <View style={{ width: width * 0.25, height: 12, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
          </View>
          <View style={{ width: 20, height: 20, backgroundColor: '#E2E8F0', borderRadius: 10, padding: 8}} />
        </View>
      </View>
      <View style={styles.cardSeparator} />
      <View style={styles.peripheralFooter}>
        <View>
          <View style={{ width: 100, height: 14, backgroundColor: '#E2E8F0', borderRadius: 6, marginBottom: 6 }} />
          <View style={{ width: 60, height: 10, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
        </View>
        <View style={styles.switchRow}>
          <View style={{ width: 50, height: 13, backgroundColor: '#E2E8F0', borderRadius: 6, marginRight: 10 }} />
          <View style={{ width: 45, height: 24, backgroundColor: '#E2E8F0', borderRadius: 12 }} />
        </View>
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
  btnNewItem: { backgroundColor: '#2563EB', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 25 },
  btnNewItemText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  peripheralCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2 },
  peripheralHeader: { marginBottom: 15 },
  peripheralInfoMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  peripheralIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#E0F7FA', justifyContent: 'center', alignItems: 'center' },
  peripheralTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  peripheralSubtitle: { fontSize: 12, color: '#64748B' },
  cardSeparator: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 15 },
  peripheralFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  brandText: { fontSize: 11, color: '#94A3B8' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 13, fontWeight: '600' },
  actionMenu: { position: 'absolute', right: 30, top: 50, backgroundColor: '#FFF', borderRadius: 12, width: 130, elevation: 15, borderWidth: 1, borderColor: '#F1F5F9', padding: 5, zIndex: 999 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  menuText: { fontSize: 14, fontWeight: '500', color: '#475569' },
  formOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  formCard: { backgroundColor: '#FFF', borderRadius: 25, padding: 25 },
  formTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#000', marginBottom: 5 },
  formSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 25 },
  label: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  inputBox: { height: 50, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 18, overflow: 'hidden' },
  input: { flex: 1, fontSize: 15, color: '#000', paddingVertical: 0, outlineWidth: 0, outlineColor: "transparent" as any },
  inputText: { flex: 1, fontSize: 15, color: '#000' },
  row: { flexDirection: 'row' },
  formButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btnCancelForm: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCreateForm: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  btnCancelText: { color: '#64748B', fontWeight: 'bold' },
  btnCreateText: { color: '#FFF', fontWeight: 'bold' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '60%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pickerTitle: { fontSize: 18, fontWeight: 'bold' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pickerText: { fontSize: 16, color: '#334155' },
  bottomTab: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 75, backgroundColor: '#FFF', flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8F0', paddingBottom: 15 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeIndicator: { position: 'absolute', bottom: 10, width: 4, height: 4, borderRadius: 2, backgroundColor: '#2563EB' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBackdrop: { flex: 1 },
  profileSheet: { backgroundColor: '#FFF', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, position: 'absolute', bottom: 0, left: 0, right: 0 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  profileTitle: { fontSize: 20, fontWeight: 'bold' },
  profileUserInfo: { alignItems: 'center', marginBottom: 20 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  largeAvatarText: { fontSize: 32, color: '#FFF', fontWeight: 'bold' },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  userEmail: { fontSize: 14, color: '#64748B' },
  separator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  configItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  configItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  configIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  configItemTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  configItemSub: { fontSize: 13, color: '#64748B' },
  btnSignOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: 12, backgroundColor: '#FEF2F2' },
  btnSignOutText: { fontSize: 16, fontWeight: 'bold', color: '#EF4444' }
});