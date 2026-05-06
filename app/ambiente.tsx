import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  Image, Dimensions, Switch, Alert, Modal, Pressable, ActivityIndicator,
  TextInput, Animated
} from 'react-native';
import { 
  ArrowLeft, Bell, Thermometer, Droplets, Lightbulb, Snowflake, Sun,
  X, User, LogOut, ChevronRight, Calendar, Clock, MoreVertical,
  Edit2, Trash2, Plus, Power, ChevronDown, Check, Zap
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { LineChart } from "react-native-chart-kit";

import ConfirmModal from '../components/ConfirmModal';
import { auth, db } from '../services/firebaseConfig';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { 
  doc, onSnapshot, updateDoc, collection, query, where, 
  collectionGroup, getDocs, getDoc, orderBy, limit, setDoc, addDoc, deleteDoc, deleteField
} from "firebase/firestore";

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png');

interface AgendamentoData {
  id: string;
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

export default function AmbienteDetalhes() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; nome: string; empresa: string }>();
  const { id, nome, empresa } = params;
  
  const [tab, setTab] = useState<'historico' | 'perifericos' | 'agendamentos'>('historico');
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [menuVisiblePerifId, setMenuVisiblePerifId] = useState<string | null>(null);
  const [menuVisibleAgendId, setMenuVisibleAgendId] = useState<string | null>(null);
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [userData, setUserData] = useState({ nome: 'Usuário', email: '', iniciais: 'US' });
  const [sensores, setSensores] = useState({ temperatura: '--', umidade: '--', luminosidade: '--', indice_geral: 0 });
  const [caracteristicas, setCaracteristicas] = useState({ tipo: 'Tipo', andar: 'Localização' });
  const [perifericosList, setPerifericosList] = useState<any[]>([]);
  const [agendamentosList, setAgendamentosList] = useState<AgendamentoData[]>([]);
  const [historyData, setHistoryData] = useState({ labels: ["00:00"], temps: [0], umids: [0], lumins: [0] });

  // Schedule modal states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isPerifericoDropdownOpen, setIsPerifericoDropdownOpen] = useState(false);
  const [isAcaoDropdownOpen, setIsAcaoDropdownOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    titulo: '',
    descricao: '',
    perifericoId: '',
    perifericoNome: 'Selecione o periférico',
    perifericoTipo: '',
    acao: '' as 'ligar' | 'desligar' | '',
    acaoLabel: 'Selecione a ação',
    data: '',
    horario: '',
  });

  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (sensores.indice_geral / 100) * circumference;

  // Auto-execute scheduled peripherals
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();
      const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      for (const ag of agendamentosList) {
        if (ag.status !== 'pendente') continue;
        if (ag.data !== todayStr) continue;
        if (ag.horario !== nowTimeStr) continue;

        try {
          // Toggle the peripheral
          const perDocRef = doc(db, "empresas", String(empresa), "ambientes", String(id), "perifericos", ag.perifericoTipo);
          const perSnap = await getDocs(collection(db, "empresas", String(empresa), "ambientes", String(id), "perifericos"));
          const perDoc = perSnap.docs.find(d => d.id === ag.perifericoTipo);
          
          if (perDoc && perDoc.exists()) {
            const perData = perDoc.data();
            const perifData = perData[ag.perifericoId];
            if (perifData) {
              const newState = ag.acao === 'ligar';
              const updateData: any = {};
              updateData[`${ag.perifericoId}.status`] = newState;
              updateData[`${ag.perifericoId}.estado_desejado`] = newState;
              await updateDoc(perDocRef, updateData);
            }
          }

          // Mark schedule as completed
          const agDocRef = doc(db, "empresas", String(empresa), "ambientes", String(id), "agendamentos", ag.id);
          await updateDoc(agDocRef, { status: 'concluido' });
        } catch (e) {
          console.error("Erro ao executar agendamento:", e);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [agendamentosList, empresa, id]);

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

    const ambRef = doc(db, "empresas", String(empresa), "ambientes", String(id));
    const unsubAmbiente = onSnapshot(ambRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setCaracteristicas({ tipo: d.config?.tipo || d.tipo || 'Tipo', andar: d.config?.andar || d.andar || 'Localização' });
      }
    }, (error) => console.error("Erro Snapshot Ambiente:", error));

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
          timeStr = `${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
        }
        labels.push(timeStr);
        temps.push(Number(data.temperatura) || 0);
        umids.push(Number(data.umidade) || 0);
        lumins.push(Number(data.luminosidade) || 0);
      });
      setHistoryData(labels.length === 0 ? { labels: ["00:00"], temps: [0], umids: [0], lumins: [0] } : { labels, temps, umids, lumins });
    }, (error) => console.error("Erro Snapshot Histórico:", error));

    const perRef = collection(db, "empresas", String(empresa), "ambientes", String(id), "perifericos");
    const unsubPerifericos = onSnapshot(perRef, (snap) => {
      const listaAtualizada: any[] = [];
      if (!snap.empty) {
        snap.docs.forEach(docSnap => {
          const tipoDocId = docSnap.id; 
          const data = docSnap.data();
          Object.entries(data).forEach(([nomeChave, propriedades]: [string, any]) => {
            if (nomeChave === 'tipo' || nomeChave === 'sensores') return;
            if (tipoDocId === 'ar_condicionado' && nomeChave === 'geral') return;
            if (typeof propriedades === 'object' && propriedades !== null) {
              listaAtualizada.push({
                docId: tipoDocId, nomeId: nomeChave, 
                nome: nomeChave.replace(/_/g, ' '),
                tipo: tipoDocId.replace(/_/g, ' '),
                marca: propriedades.marca || '--',
                status: propriedades.estado_desejado || propriedades.status || false,
              });
            }
          });
        });
      }
      setPerifericosList(listaAtualizada);
    }, (error) => console.error("Erro Snapshot Perifericos:", error));

    const ageRef = collection(db, "empresas", String(empresa), "ambientes", String(id), "agendamentos");
    const unsubAgendamentos = onSnapshot(ageRef, (snap) => {
      const listaAgendamentos: AgendamentoData[] = [];
      if (!snap.empty) {
        snap.docs.forEach(docSnap => {
          if (docSnap.id === 'registro_inicial') return;
          const data = docSnap.data();
          listaAgendamentos.push({ 
            id: docSnap.id, 
            titulo: data.titulo || 'Sem Título', 
            descricao: data.descricao || data.objetivo || '', 
            perifericoId: data.perifericoId || '',
            perifericoNome: data.perifericoNome || 'Periférico não especificado',
            perifericoTipo: data.perifericoTipo || '',
            acao: data.acao || 'ligar',
            data: data.data || '--/--/----', 
            horario: data.horario || '--:--',
            status: data.status || 'pendente',
            criadoEm: data.criadoEm || '',
          });
        });
      }
      // Sort: pending first, then active, then completed; within same status sort by date
      listaAgendamentos.sort((a, b) => {
        const statusOrder = { pendente: 0, ativo: 1, concluido: 2 };
        const statusDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
        if (statusDiff !== 0) return statusDiff;
        return a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario);
      });
      setAgendamentosList(listaAgendamentos);
    }, (error) => console.error("Erro Snapshot Agendamentos:", error));

    return () => { unsubscribeAuth(); unsubAmbiente(); unsubHistorico(); unsubPerifericos(); unsubAgendamentos(); };
  }, [id, empresa]);

  const handleDeletePeriferico = (p: any) => {
    setMenuVisiblePerifId(null);
    setConfirmModal({
      visible: true,
      title: 'Excluir Periférico',
      message: `Deseja remover "${p.nome}"? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        if (!empresa || !id || !p.docId || !p.nomeId) {
          console.error("Dados insuficientes para excluir periférico:", { empresa, id, docId: p.docId, nomeId: p.nomeId });
          Alert.alert("Erro", `Dados insuficientes. Empresa: ${empresa || 'vazio'}, Amb: ${id || 'vazio'}`);
          setConfirmModal(prev => ({ ...prev, visible: false }));
          return;
        }
        setIsDeleting(true);
        try {
          const perDocRef = doc(db, "empresas", String(empresa), "ambientes", String(id), "perifericos", p.docId);
          console.log("Excluindo periférico:", `empresas/${empresa}/ambientes/${id}/perifericos/${p.docId}`, "campo:", p.nomeId);
          
          await updateDoc(perDocRef, {
            [p.nomeId]: deleteField()
          });
          
          console.log("Periférico excluído com sucesso no Firestore");
          setConfirmModal(prev => ({ ...prev, visible: false }));
          Alert.alert("Sucesso", "Periférico excluído!");
        } catch (e: any) { 
          console.error("Erro ao excluir periférico:", e);
          const errorCode = e?.code || '';
          const errorMsg = e?.message || String(e);
          setConfirmModal(prev => ({ ...prev, visible: false }));
          if (errorCode === 'permission-denied') {
            Alert.alert("Permissão Negada", "O Firestore está bloqueando a exclusão. Verifique as regras de segurança do Firebase.");
          } else {
            Alert.alert("Erro ao Excluir", `Código: ${errorCode}\nMensagem: ${errorMsg}`);
          }
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  // Schedule CRUD
  const resetScheduleForm = () => {
    setScheduleForm({
      titulo: '', descricao: '', perifericoId: '', perifericoNome: 'Selecione o periférico',
      perifericoTipo: '', acao: '', acaoLabel: 'Selecione a ação', data: '', horario: '',
    });
    setIsEditingSchedule(false);
    setEditingScheduleId(null);
    setIsPerifericoDropdownOpen(false);
    setIsAcaoDropdownOpen(false);
  };

  const openNewSchedule = () => {
    resetScheduleForm();
    setShowScheduleModal(true);
  };

  const openEditSchedule = (ag: AgendamentoData) => {
    setMenuVisibleAgendId(null);
    setScheduleForm({
      titulo: ag.titulo,
      descricao: ag.descricao,
      perifericoId: ag.perifericoId,
      perifericoNome: ag.perifericoNome,
      perifericoTipo: ag.perifericoTipo,
      acao: ag.acao,
      acaoLabel: ag.acao === 'ligar' ? 'Ligar' : 'Desligar',
      data: ag.data,
      horario: ag.horario,
    });
    setEditingScheduleId(ag.id);
    setIsEditingSchedule(true);
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    const { titulo, descricao, perifericoId, perifericoTipo, acao, data, horario } = scheduleForm;
    if (!titulo.trim() || !perifericoId || !acao || !data.trim() || !horario.trim()) {
      Alert.alert("Campos Obrigatórios", "Preencha título, periférico, ação, data e horário.");
      return;
    }

    setIsSavingSchedule(true);
    try {
      const agendamentosRef = collection(db, "empresas", String(empresa), "ambientes", String(id), "agendamentos");

      if (isEditingSchedule && editingScheduleId) {
        const agDocRef = doc(agendamentosRef, editingScheduleId);
        await updateDoc(agDocRef, {
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          perifericoId,
          perifericoNome: scheduleForm.perifericoNome,
          perifericoTipo,
          acao,
          data: data.trim(),
          horario: horario.trim(),
        });
        Alert.alert("Sucesso", "Agendamento atualizado!");
      } else {
        await addDoc(agendamentosRef, {
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          perifericoId,
          perifericoNome: scheduleForm.perifericoNome,
          perifericoTipo,
          acao,
          data: data.trim(),
          horario: horario.trim(),
          status: 'pendente',
          criadoEm: new Date().toISOString(),
        });
        Alert.alert("Sucesso", "Agendamento criado!");
      }

      setShowScheduleModal(false);
      resetScheduleForm();
    } catch (e) {
      console.error("Erro ao salvar agendamento:", e);
      Alert.alert("Erro", "Falha ao salvar agendamento.");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = (ag: AgendamentoData) => {
    setMenuVisibleAgendId(null);
    setConfirmModal({
      visible: true,
      title: 'Excluir Agendamento',
      message: `Deseja excluir "${ag.titulo}"? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        if (!empresa || !id || !ag.id) {
          console.error("Dados insuficientes para excluir agendamento:", { empresa, id, agId: ag.id });
          Alert.alert("Erro", `Dados insuficientes. Empresa: ${empresa || 'vazio'}, Amb: ${id || 'vazio'}`);
          setConfirmModal(prev => ({ ...prev, visible: false }));
          return;
        }
        setIsDeleting(true);
        try {
          const agDocRef = doc(db, "empresas", String(empresa), "ambientes", String(id), "agendamentos", ag.id);
          console.log("Excluindo agendamento:", `empresas/${empresa}/ambientes/${id}/agendamentos/${ag.id}`);
          await deleteDoc(agDocRef);
          console.log("Agendamento excluído com sucesso no Firestore");
          setConfirmModal(prev => ({ ...prev, visible: false }));
          Alert.alert("Sucesso", "Agendamento excluído!");
        } catch (e: any) {
          console.error("Erro ao excluir agendamento:", e);
          const errorCode = e?.code || '';
          const errorMsg = e?.message || String(e);
          setConfirmModal(prev => ({ ...prev, visible: false }));
          if (errorCode === 'permission-denied') {
            Alert.alert("Permissão Negada", "O Firestore está bloqueando a exclusão. Verifique as regras de segurança do Firebase.");
          } else {
            Alert.alert("Erro ao Excluir", `Código: ${errorCode}\nMensagem: ${errorMsg}`);
          }
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const handleLogout = async () => { await signOut(auth); setIsProfileVisible(false); router.replace('/'); };
  const getConfortoColor = (val: number) => val >= 80 ? '#10B981' : val >= 50 ? '#F59E0B' : '#EF4444';

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

  const getAcaoIcon = (acao: string) => {
    return acao === 'ligar' 
      ? <Power color="#10B981" size={16} /> 
      : <Power color="#EF4444" size={16} />;
  };

  // Check if a schedule is currently active (right day + time within a 30-min window)
  const isScheduleActiveNow = (ag: AgendamentoData): boolean => {
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

  // Toggle peripheral from schedule card in ambiente detail
  const handleToggleScheduledPeripheral = async (ag: AgendamentoData, turnOn: boolean) => {
    try {
      const perDocRef = doc(db, "empresas", String(empresa), "ambientes", String(id), "perifericos", ag.perifericoTipo);
      const updateData: any = {};
      updateData[`${ag.perifericoId}.status`] = turnOn;
      updateData[`${ag.perifericoId}.estado_desejado`] = turnOn;
      await updateDoc(perDocRef, updateData);

      // Update schedule status
      const agDocRef = doc(db, "empresas", String(empresa), "ambientes", String(id), "agendamentos", ag.id);
      await updateDoc(agDocRef, { status: turnOn ? 'ativo' : 'pendente' });
    } catch (e) {
      console.error("Erro ao controlar periférico:", e);
      Alert.alert("Erro", "Falha ao controlar o periférico.");
    }
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
        <View style={styles.titleSection}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/ambientes'); } }} style={{ padding: 10, marginLeft: -10 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><ArrowLeft color="#000" size={28} /></TouchableOpacity>
          <View>
            <Text style={styles.envName}>{nome || 'Nome Ambiente'}</Text>
            <Text style={styles.envSub}>{caracteristicas.tipo} • {caracteristicas.andar}</Text>
          </View>
        </View>

        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            <MetricCard label="Temperatura" value={sensores.temperatura} unit="°C" icon={<Thermometer color="#FFF" size={24} />} iconBg="#2563EB" />
            <MetricCard label="Umidade" value={sensores.umidade} unit="%" icon={<Droplets color="#FFF" size={24} />} iconBg="#2563EB" />
          </View>
          <View style={styles.metricsCenter}>
            <MetricCard label="Luminosidade" value={sensores.luminosidade} unit="lux" icon={<Lightbulb color="#FFF" size={24} />} iconBg="#2563EB" />
          </View>
        </View>

        <View style={[styles.cardMain, { marginTop: 25 }]}>
          <Text style={styles.cardTitle}>Índice de Conforto</Text>
          <View style={styles.gaugeContainer}>
            <Svg width="140" height="140" viewBox="0 0 140 140">
              <Circle cx="70" cy="70" r={radius} stroke="#F1F5F9" strokeWidth="12" fill="none" />
              <Circle cx="70" cy="70" r={radius} stroke={getConfortoColor(sensores.indice_geral)} strokeWidth="12" fill="none"
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform="rotate(-90, 70, 70)" />
            </Svg>
            <View style={styles.gaugeTextContainer}><Text style={styles.gaugeValue}>{sensores.indice_geral}</Text></View>
          </View>
          <Text style={[styles.statusMain, { color: getConfortoColor(sensores.indice_geral) }]}>
            {sensores.indice_geral >= 80 ? 'Excelente' : sensores.indice_geral >= 50 ? 'Regular' : 'Alerta'}
          </Text>
          <Text style={styles.statusDetail}>Baseado em temperatura, umidade, luminosidade e qualidade do ar</Text>
        </View>

        <View style={styles.tabContainer}>
          {(['historico', 'perifericos', 'agendamentos'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabItem, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'historico' ? 'Histórico' : t === 'perifericos' ? 'Periféricos' : 'Agendamentos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'historico' && (
          <View>
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle}>Histórico de Temperatura e Umidade</Text>
              <LineChart
                data={{
                  labels: historyData.labels,
                  datasets: [
                    { data: historyData.temps, color: () => `#EF4444`, strokeWidth: 3 },
                    { data: historyData.umids, color: () => `#3B82F6`, strokeWidth: 3 },
                    { data: [0], color: () => `rgba(0,0,0,0)`, strokeWidth: 0 }
                  ]
                }}
                width={width - 80} height={180}
                fromZero={true}
                chartConfig={chartConfig} bezier style={styles.chartStyle}
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
                    { data: historyData.lumins, color: () => `#F59E0B`, strokeWidth: 3 },
                    { data: [0], color: () => `rgba(0,0,0,0)`, strokeWidth: 0 }
                  ]
                }}
                width={width - 80} height={180}
                fromZero={true}
                chartConfig={chartConfig} bezier style={styles.chartStyle}
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
              <View key={`${p.docId}-${p.nomeId}-${index}`} style={{ zIndex: menuVisiblePerifId === p.nomeId ? 100 : 1 }}>
                <AmbientePeripheralCard
                  title={p.nome} subtitle={p.tipo} brand={p.marca}
                  status={p.status}
                  empresaId={String(empresa)} ambienteId={String(id)}
                  deviceType={p.docId} perifericoId={p.nomeId}
                  icon={p.docId?.toLowerCase().includes('ar') ? <Snowflake color="#06B6D4" size={24}/> : <Sun color="#F59E0B" size={24}/>}
                  onMore={() => setMenuVisiblePerifId(menuVisiblePerifId === p.nomeId ? null : p.nomeId)}
                />
                {menuVisiblePerifId === p.nomeId && (
                  <View style={styles.actionMenu}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => {
                      setMenuVisiblePerifId(null);
                      Alert.alert("Editar", "Para editar este periférico, acesse a tela Periféricos.");
                    }}>
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
            <Text style={{textAlign: 'center', color: '#94A3B8', marginTop: 20}}>Nenhum periférico encontrado.</Text>
          )
        )}

        {tab === 'agendamentos' && (
          <View>
            <TouchableOpacity style={styles.btnAddSchedule} onPress={openNewSchedule}>
              <Plus color="#FFF" size={20} />
              <Text style={styles.btnAddScheduleText}>Novo Agendamento</Text>
            </TouchableOpacity>

            {agendamentosList.length > 0 ? (
              agendamentosList.map((ag) => (
                <View key={ag.id} style={{ zIndex: menuVisibleAgendId === ag.id ? 100 : 1 }}>
                  <View style={[styles.scheduleCard, isScheduleActiveNow(ag) && styles.scheduleCardActive]}>
                    {/* Header: Title + Status Badge + Menu */}
                    <View style={styles.scheduleHeader}>
                      <View style={styles.scheduleIconBox}>
                        <Calendar color="#3B82F6" size={22} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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

                    {/* Peripheral info */}
                    <View style={styles.scheduleInfoRow}>
                      <View style={styles.scheduleInfoIconBox}>
                        {ag.perifericoTipo?.toLowerCase().includes('ar') 
                          ? <Snowflake color="#06B6D4" size={16} />
                          : <Zap color="#F59E0B" size={16} />
                        }
                      </View>
                      <Text style={styles.scheduleInfoLabel}>Periférico:</Text>
                      <Text style={styles.scheduleInfoValue}>{ag.perifericoNome}</Text>
                      <View style={[styles.acaoBadge, { backgroundColor: ag.acao === 'ligar' ? '#DCFCE7' : '#FEE2E2' }]}>
                        {getAcaoIcon(ag.acao)}
                        <Text style={[styles.acaoBadgeText, { color: ag.acao === 'ligar' ? '#16A34A' : '#DC2626' }]}>
                          {ag.acao === 'ligar' ? 'Ligar' : 'Desligar'}
                        </Text>
                      </View>
                    </View>

                    {/* Date & Time */}
                    <View style={styles.scheduleFooter}>
                      <View style={styles.scheduleFooterItem}>
                        <Calendar size={15} color="#64748B" />
                        <Text style={styles.scheduleFooterText}>{ag.data}</Text>
                      </View>
                      <View style={styles.scheduleFooterItem}>
                        <Clock size={15} color="#64748B" />
                        <Text style={styles.scheduleFooterText}>{ag.horario}</Text>
                      </View>
                    </View>

                    {/* Control button - only when schedule is active now */}
                    {isScheduleActiveNow(ag) && (
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

                    {!isScheduleActiveNow(ag) && ag.status === 'pendente' && (
                      <View style={styles.scheduleInactiveNote}>
                        <Clock color="#94A3B8" size={14} />
                        <Text style={styles.scheduleInactiveText}>Controle disponível no horário agendado</Text>
                      </View>
                    )}
                  </View>

                  {/* Action Menu */}
                  {menuVisibleAgendId === ag.id && (
                    <View style={styles.actionMenu}>
                      <TouchableOpacity style={styles.menuItem} onPress={() => openEditSchedule(ag)}>
                        <Edit2 size={16} color="#475569" /><Text style={styles.menuText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteSchedule(ag)}>
                        <Trash2 size={16} color="#EF4444" /><Text style={[styles.menuText, {color: '#EF4444'}]}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyScheduleCard}>
                <Calendar color="#94A3B8" size={48} />
                <Text style={styles.emptyScheduleTitle}>Nenhum agendamento no momento</Text>
                <Text style={styles.emptyScheduleText}>Crie um agendamento para controlar periféricos automaticamente.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Schedule Modal */}
      <Modal visible={showScheduleModal} transparent animationType="fade" onRequestClose={() => { setShowScheduleModal(false); resetScheduleForm(); }}>
        <View style={styles.modalOverlayBlack}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{isEditingSchedule ? "Editar Agendamento" : "Novo Agendamento"}</Text>
            <Text style={styles.formSubtitle}>Programe o controle automático de periféricos</Text>

            <Text style={styles.label}>Título *</Text>
            <View style={styles.inputBox}>
              <TextInput 
                style={styles.input} placeholder="Ex: Climatização para reunião" 
                value={scheduleForm.titulo} 
                onChangeText={(t) => setScheduleForm(prev => ({...prev, titulo: t}))} 
              />
            </View>

            <Text style={styles.label}>Descrição</Text>
            <View style={[styles.inputBox, { height: 60 }]}>
              <TextInput 
                style={[styles.input, { height: 50, textAlignVertical: 'top' }]} placeholder="Ex: Ligar ar-condicionado antes da reunião" 
                value={scheduleForm.descricao} 
                onChangeText={(t) => setScheduleForm(prev => ({...prev, descricao: t}))}
                multiline
              />
            </View>

            <Text style={styles.label}>Periférico *</Text>
            <TouchableOpacity 
              style={[styles.inputBox, { justifyContent: 'space-between' }]} 
              onPress={() => { setIsPerifericoDropdownOpen(!isPerifericoDropdownOpen); setIsAcaoDropdownOpen(false); }}
            >
              <Text style={{ color: scheduleForm.perifericoId ? '#1E293B' : '#94A3B8', fontSize: 15 }}>
                {scheduleForm.perifericoNome}
              </Text>
              <ChevronDown color="#94A3B8" size={20} />
            </TouchableOpacity>
            {isPerifericoDropdownOpen && (
              <View style={styles.dropdownContainer}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 130 }}>
                  {perifericosList.length > 0 ? perifericosList.map((p) => (
                    <TouchableOpacity 
                      key={`${p.docId}-${p.nomeId}`}
                      style={[styles.dropdownItem, scheduleForm.perifericoId === p.nomeId && styles.dropdownItemActive]}
                      onPress={() => {
                        setScheduleForm(prev => ({ 
                          ...prev, 
                          perifericoId: p.nomeId, 
                          perifericoNome: p.nome,
                          perifericoTipo: p.docId,
                        }));
                        setIsPerifericoDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownText}>{p.nome}</Text>
                      {scheduleForm.perifericoId === p.nomeId && <Check color="#2563EB" size={18} />}
                    </TouchableOpacity>
                  )) : (
                    <View style={styles.dropdownItem}>
                      <Text style={[styles.dropdownText, { color: '#94A3B8' }]}>Nenhum periférico disponível</Text>
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
              <Text style={{ color: scheduleForm.acao ? '#1E293B' : '#94A3B8', fontSize: 15 }}>
                {scheduleForm.acaoLabel}
              </Text>
              <ChevronDown color="#94A3B8" size={20} />
            </TouchableOpacity>
            {isAcaoDropdownOpen && (
              <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                  style={[styles.dropdownItem, scheduleForm.acao === 'ligar' && styles.dropdownItemActive]}
                  onPress={() => {
                    setScheduleForm(prev => ({ ...prev, acao: 'ligar', acaoLabel: 'Ligar' }));
                    setIsAcaoDropdownOpen(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Power color="#10B981" size={16} />
                    <Text style={styles.dropdownText}>Ligar</Text>
                  </View>
                  {scheduleForm.acao === 'ligar' && <Check color="#2563EB" size={18} />}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.dropdownItem, scheduleForm.acao === 'desligar' && styles.dropdownItemActive]}
                  onPress={() => {
                    setScheduleForm(prev => ({ ...prev, acao: 'desligar', acaoLabel: 'Desligar' }));
                    setIsAcaoDropdownOpen(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Power color="#EF4444" size={16} />
                    <Text style={styles.dropdownText}>Desligar</Text>
                  </View>
                  {scheduleForm.acao === 'desligar' && <Check color="#2563EB" size={18} />}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Data *</Text>
                <View style={styles.inputBox}>
                  <TextInput 
                    style={styles.input} placeholder="DD/MM/AAAA" 
                    value={scheduleForm.data} 
                    onChangeText={(t) => setScheduleForm(prev => ({...prev, data: t}))} 
                  />
                </View>
              </View>
              <View style={{width: 12}} />
              <View style={{flex: 1}}>
                <Text style={styles.label}>Horário *</Text>
                <View style={styles.inputBox}>
                  <TextInput 
                    style={styles.input} placeholder="HH:MM" 
                    value={scheduleForm.horario} 
                    onChangeText={(t) => setScheduleForm(prev => ({...prev, horario: t}))} 
                  />
                </View>
              </View>
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity style={styles.btnCancelForm} onPress={() => { setShowScheduleModal(false); resetScheduleForm(); }}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCreateForm} onPress={handleSaveSchedule} disabled={isSavingSchedule}>
                {isSavingSchedule ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnCreateText}>{isEditingSchedule ? "Salvar" : "Criar"}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* CONFIRM MODAL - Delete confirmation */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        destructive
        loading={isDeleting}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

function AmbientePeripheralCard({ title, subtitle, brand, icon, status, empresaId, ambienteId, deviceType, perifericoId, onMore }: any) {
  const [localStatus, setLocalStatus] = useState(status);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaId || !ambienteId || !deviceType) return;
    const perDocRef = doc(db, "empresas", empresaId, "ambientes", ambienteId, "perifericos", deviceType);
    const unsub = onSnapshot(perDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data[perifericoId] !== undefined) setLocalStatus(data[perifericoId].estado_desejado || false);
      }
    });
    return () => unsub();
  }, [empresaId, ambienteId, deviceType, perifericoId]);

  const toggleSwitch = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const perDocRef = doc(db, "empresas", empresaId, "ambientes", ambienteId, "perifericos", deviceType);
      const updateData: any = {};
      updateData[`${perifericoId}.estado_desejado`] = !localStatus;
      updateData[`${perifericoId}.status`] = !localStatus;
      await updateDoc(perDocRef, updateData);
    } catch (e) { Alert.alert("Erro", "Falha ao atualizar status."); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.peripheralCard}>
      <View style={styles.peripheralInfoMain}>
        <View style={styles.peripheralIconBox}>{icon}</View>
        <View style={{flex: 1, marginLeft: 12}}>
          <Text style={styles.peripheralTitle}>{title}</Text>
          <Text style={styles.peripheralSubtitle}>{subtitle}</Text>
        </View>
        {loading && <ActivityIndicator size="small" color="#2563EB" style={{marginRight: 8}} />}
        <TouchableOpacity onPress={onMore} style={{padding: 8}}><MoreVertical color="#1E293B" size={20}/></TouchableOpacity>
      </View>
      <View style={styles.cardSeparator} />
      <View style={styles.peripheralFooter}>
        <Text style={styles.footerBrand}>{brand}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={[styles.footerStatus, { color: localStatus ? '#2563EB' : '#94A3B8' }]}>
            {localStatus ? 'Ligado' : 'Desligado'}
          </Text>
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
  backgroundGradientFrom: "#FFF", backgroundGradientTo: "#FFF",
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
  peripheralCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2 },
  peripheralInfoMain: { flexDirection: 'row', alignItems: 'center' },
  peripheralIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#E0F7FA', justifyContent: 'center', alignItems: 'center' },
  peripheralTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  peripheralSubtitle: { fontSize: 12, color: '#64748B' },
  cardSeparator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  peripheralFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerBrand: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  footerStatus: { fontSize: 13, fontWeight: '600' },
  actionMenu: { position: 'absolute', right: 20, top: 50, backgroundColor: '#FFF', borderRadius: 12, width: 130, elevation: 15, borderWidth: 1, borderColor: '#F1F5F9', padding: 5, zIndex: 999 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  menuText: { fontSize: 14, fontWeight: '500', color: '#475569' },
  // Schedule styles
  btnAddSchedule: { backgroundColor: '#2563EB', height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  btnAddScheduleText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  scheduleCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, elevation: 3, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  scheduleCardActive: { borderColor: '#93C5FD', borderWidth: 2, backgroundColor: '#F0F9FF' },
  scheduleHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  scheduleIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  scheduleTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', flex: 1 },
  scheduleSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 17 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  scheduleInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  scheduleInfoIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#E0F7FA', justifyContent: 'center', alignItems: 'center' },
  scheduleInfoLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  scheduleInfoValue: { fontSize: 13, color: '#1E293B', fontWeight: '600', flex: 1 },
  acaoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  acaoBadgeText: { fontSize: 11, fontWeight: '700' },
  scheduleFooter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scheduleFooterItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scheduleFooterText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  emptyScheduleCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 40, alignItems: 'center', elevation: 2, marginVertical: 10 },
  emptyScheduleTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 8, textAlign: 'center', marginTop: 12 },
  emptyScheduleText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  scheduleControlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#DBEAFE' },
  scheduleControlLabel: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  controlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  controlBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  scheduleInactiveNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  scheduleInactiveText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  // Modal schedule form
  modalOverlayBlack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  formCard: { backgroundColor: '#FFF', borderRadius: 25, padding: 25, maxHeight: '90%' },
  formTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#000', marginBottom: 5 },
  formSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  inputBox: { height: 48, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 14, overflow: 'hidden' },
  input: { flex: 1, fontSize: 15, color: '#000', paddingVertical: 0, outlineWidth: 0, outlineColor: "transparent" as any },
  row: { flexDirection: 'row' },
  formButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btnCancelForm: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCreateForm: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  btnCancelText: { color: '#64748B', fontWeight: 'bold', fontSize: 15 },
  btnCreateText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  dropdownContainer: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginTop: -10, marginBottom: 14, elevation: 3 },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownText: { fontSize: 15, color: '#1E293B' },
  // Profile modal
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