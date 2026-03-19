import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Dimensions,
  Alert
} from 'react-native';
import { 
  Bell, 
  ChevronDown, 
  FileText, 
  Building2, 
  Zap, 
  BarChart3, 
  X, 
  User, 
  LogOut, 
  ChevronRight,
  Thermometer,
  Droplets,
  Wind,
  TrendingUp
} from 'lucide-react-native';
import { LineChart } from "react-native-chart-kit";
import { useRouter } from 'expo-router'; 
import Svg, { Circle } from 'react-native-svg'; // --- IMPORT DO SVG ---

// --- INCLUSÃO FIREBASE ---
import { auth, database } from '../services/firebaseConfig';
import { ref, onValue } from "firebase/database";
import { signOut } from "firebase/auth";

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png'); 

export default function RelatoriosScreen() {
  const router = useRouter();
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  
  // Lógica de Índice (Pode ser alterado dinamicamente depois)
  const indiceConforto = 70; 
  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (indiceConforto / 100) * circumference;

  const [userData, setUserData] = useState({ 
    nome: 'Carregando...', 
    email: '', 
    iniciais: '..' 
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const empresasRef = ref(database, 'empresas');
      onValue(empresasRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          let nomeEncontrado = user.displayName || "Usuário";
          Object.keys(data).forEach(empresaKey => {
            const usuarios = data[empresaKey].usuarios;
            if (usuarios) {
              Object.keys(usuarios).forEach(userKey => {
                if (usuarios[userKey].uid === user.uid) {
                  nomeEncontrado = userKey.replace(/_/g, ' ');
                }
              });
            }
          });
          const iniciais = nomeEncontrado.split(' ').filter(n => n.length > 0).map(n => n[0]).join('').slice(0, 2).toUpperCase();
          setUserData({ nome: nomeEncontrado, email: user.email || "", iniciais: iniciais || "US" });
        }
      });
    }
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsProfileVisible(false);
      router.replace('/');
    } catch (error) {
      Alert.alert("Erro", "Não foi possível sair.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* --- TOP BAR --- */}
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
          <Text style={styles.headerTitle}>Relatórios</Text>
          <Text style={styles.headerSubtitle}>Análise inteligente dos seus ambientes</Text>
        </View>

        <View style={styles.selectorsRow}>
          <TouchableOpacity style={styles.dropdown}>
            <Text style={styles.dropdownText}>Todos os ambientes</Text>
            <ChevronDown color="#64748B" size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdown}>
            <Text style={styles.dropdownText}>Últimos 7 dias</Text>
            <ChevronDown color="#64748B" size={18} />
          </TouchableOpacity>
        </View>

        {/* --- CARD: ÍNDICE DE CONFORTO (SVG ATUALIZADO) --- */}
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>Índice de Conforto</Text>
          
          <View style={styles.gaugeContainer}>
            <Svg width="140" height="140" viewBox="0 0 140 140">
              {/* Círculo de Fundo (Trilho Cinza) */}
              <Circle
                cx="70"
                cy="70"
                r={radius}
                stroke="#F1F5F9"
                strokeWidth="12"
                fill="none"
              />
              {/* Círculo de Progresso (Verde) */}
              <Circle
                cx="70"
                cy="70"
                r={radius}
                stroke="#10B981"
                strokeWidth="12"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90, 70, 70)"
              />
            </Svg>
            <View style={styles.gaugeTextContainer}>
              <Text style={styles.gaugeValue}>{indiceConforto}</Text>
            </View>
          </View>

          <Text style={styles.statusMain}>Excelente</Text>
          <Text style={styles.statusDetail}>Baseado em temperatura, umidade, CO₂ e qualidade do ar</Text>
        </View>

        {/* --- RESTANTE DOS CARDS --- */}
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>Resumo do Período</Text>
          <View style={styles.metricsGrid}>
            <SummaryCard label="24.5°C" sub="Min: 22.8° | Max: 27.1°" icon={<Thermometer color="#EF4444" size={20}/>} bgColor="#FFF1F2" />
            <SummaryCard label="43%" sub="Min: 32% | Max: 55%" icon={<Droplets color="#3B82F6" size={20}/>} bgColor="#EFF6FF" />
            <SummaryCard label="Bom" sub="Qualidade do Ar" icon={<Wind color="#8B5CF6" size={20}/>} bgColor="#F5F3FF" />
            <SummaryCard label="Estável" sub="Tendência" icon={<TrendingUp color="#10B981" size={20}/>} bgColor="#ECFDF5" />
          </View>
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>Histórico de Temperatura e Umidade</Text>
          <LineChart
            data={{
              labels: ["06:00", "06:00", "07:00", "05:00"],
              datasets: [
                { data: [55, 35, 48, 38], color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, strokeWidth: 3 },
                { data: [25, 28, 24, 26], color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, strokeWidth: 3 }
              ]
            }}
            width={width - 80}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chartStyle}
          />
          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#EF4444'}]} /><Text style={styles.legendText}>Temperatura</Text></View>
            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#3B82F6'}]} /><Text style={styles.legendText}>Umidade</Text></View>
          </View>
        </View>

        <View style={{height: 100}} /> 
      </ScrollView>

      {/* --- MODAL DE PERFIL --- */}
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

      <View style={styles.bottomTab}>
        <TabItem icon={<FileText size={24} color="#64748B" />} onPress={() => router.push('/home')} />
        <TabItem icon={<Building2 size={24} color="#64748B" />} onPress={() => router.push('/ambientes')} />
        <TabItem icon={<Zap size={24} color="#64748B" />} onPress={() => router.push('/perifericos')} />
        <TabItem icon={<Bell size={24} color="#64748B" />} onPress={() => router.push('/notificacao')} />
        <TabItem icon={<BarChart3 size={24} color="#2563EB" />} active />
      </View>
    </SafeAreaView>
  );
}

// --- AUXILIARES ---
function SummaryCard({ label, sub, icon, bgColor }: any) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: bgColor }]}>
      {icon}
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summarySub}>{sub}</Text>
    </View>
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
  topAppBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 5, backgroundColor: '#FFF' },
  topLogo: { width: 140, height: 90 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBadge: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 15 },
  headerSection: { marginBottom: 15 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 14, color: '#64748B' },
  selectorsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  dropdown: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
  dropdownText: { fontSize: 13, color: '#1E293B', fontWeight: '500' },
  
  // GAUGE STYLES
  cardMain: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', alignSelf: 'flex-start', marginBottom: 20 },
  gaugeContainer: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gaugeTextContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  gaugeValue: { fontSize: 34, fontWeight: 'bold', color: '#1E293B' },
  
  statusMain: { fontSize: 20, fontWeight: 'bold', color: '#10B981', marginTop: 10 },
  statusDetail: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 5, lineHeight: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  summaryCard: { width: '48%', padding: 18, borderRadius: 20, gap: 8 },
  summaryLabel: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  summarySub: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  chartStyle: { marginVertical: 10, borderRadius: 16, marginLeft: -10 },
  legendRow: { flexDirection: 'row', gap: 20, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  bottomTab: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: '#FFF', flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8F0', paddingBottom: 20 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeIndicator: { position: 'absolute', bottom: 12, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#2563EB' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  modalBackdrop: { flex: 0.2 },
  profileSheet: { flex: 0.8, backgroundColor: '#FFF', padding: 24, paddingTop: 60, borderTopLeftRadius: 30, borderBottomLeftRadius: 30 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  profileTitle: { fontSize: 24, fontWeight: 'bold' },
  profileUserInfo: { alignItems: 'center', marginBottom: 20 },
  largeAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
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