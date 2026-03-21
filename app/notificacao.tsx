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
  Alert
} from 'react-native';
import { 
  Bell, 
  BellOff,
  FileText, 
  Building2, 
  Zap, 
  BarChart3, 
  X, 
  User, 
  LogOut, 
  ChevronRight ,
  Check,
  Info,
} from 'lucide-react-native';
import { useRouter } from 'expo-router'; 

// --- FIREBASE FIRESTORE MIGRATION ---
import { auth, db } from '../services/firebaseConfig';
import { signOut, onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  collectionGroup, 
  getDocs 
} from "firebase/firestore";

const LogoImg = require('../assets/images/logo.png'); 

export default function NotificacaoScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Todos'); 
  const [isProfileVisible, setIsProfileVisible] = useState(false);

  // --- ESTADO PARA DADOS REAIS DO USUÁRIO ---
  const [userData, setUserData] = useState({ 
    nome: 'Carregando...', 
    email: '', 
    iniciais: '..' 
  });

  // --- LÓGICA DE BUSCA DE DADOS (FIRESTORE) ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserData({ nome: 'Desconhecido', email: '', iniciais: '..' });
        return;
      }

      try {
        // 1. Buscar o documento do usuário na subcoleção 'usuarios' de qualquer empresa
        const userQuery = query(collectionGroup(db, 'usuarios'), where('userId', '==', user.uid));
        const userSnapshot = await getDocs(userQuery);

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const dataUser = userDoc.data();
          
          // 2. Pegar o nome (campo userName conforme padrão do Firestore)
          const nomeEncontrado = dataUser.userName || "Usuário";
          
          // 3. Calcular iniciais
          const iniciais = nomeEncontrado
            .split(' ')
            .filter((n: string) => n.length > 0)
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          setUserData({
            nome: nomeEncontrado,
            email: user.email || "",
            iniciais: iniciais || "US"
          });
        }
      } catch (error) {
        console.error("Erro ao buscar dados do usuário:", error);
      }
    });

    return () => unsubscribeAuth();
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

  const renderEmptyState = () => {
    switch (activeTab) {
      case 'Não Lidos':
        return (
          <View style={styles.emptyContainer}>
            <View style={styles.iconCircle}><BellOff color="#94A3B8" size={40} /></View>
            <Text style={styles.emptyTitle}>Nenhum alerta não lido</Text>
            <Text style={styles.emptySubtitle}>Todos os alertas foram lidos</Text>
          </View>
        );
      case 'Resolvidos':
        return (
          <View style={styles.emptyContainer}>
            <View style={styles.iconCircle}><BellOff color="#94A3B8" size={40} /></View>
            <Text style={styles.emptyTitle}>Nenhum alerta resolvido</Text>
            <Text style={styles.emptySubtitle}>O sistema está funcionando normalmente</Text>
          </View>
        );
      default:
        return (
          <View style={styles.emptyContainer}>
            <View style={styles.iconCircle}><BellOff color="#94A3B8" size={40} /></View>
            <Text style={styles.emptyTitle}>Nenhum alerta</Text>
            <Text style={styles.emptySubtitle}>O sistema está funcionando normalmente</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* --- TOP BAR --- */}
      <View style={styles.topAppBar}>
        <Image source={LogoImg} style={styles.topLogo} resizeMode="contain" />
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBadge} activeOpacity={0.7}>
            <Bell color="#2563EB" size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarCircle} onPress={() => setIsProfileVisible(true)}>
            <Text style={styles.avatarText}>{userData.iniciais}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Alertas</Text>
          <Text style={styles.headerSubtitle}>Todos os alertas lidos</Text>
        </View>

        <View style={styles.tabBarShadow}>
            <View style={styles.tabBar}>
                <FilterButton 
                    label="Todos" 
                    icon={<Bell size={18} color={activeTab === 'Todos' ? '#1E293B' : '#64748B'} />} 
                    active={activeTab === 'Todos'} 
                    onPress={() => setActiveTab('Todos')} 
                />
                <FilterButton 
                    label="Não Lidos" 
                    icon={<Info style={[styles.dotIcon, {borderColor: activeTab === 'Não Lidos' ? '#1E293B' : '#64748B'}]} />} 
                    active={activeTab === 'Não Lidos'} 
                    onPress={() => setActiveTab('Não Lidos')} 
                />
                <FilterButton 
                    label="Resolvidos" 
                    icon={<Check size={18} color={activeTab === 'Resolvidos' ? '#1E293B' : '#64748B'} />} 
                    active={activeTab === 'Resolvidos'} 
                    onPress={() => setActiveTab('Resolvidos')} 
                />
            </View>
        </View>

        <View style={styles.mainCard}>
            {renderEmptyState()}
        </View>

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

      {/* --- BOTTOM TAB --- */}
      <View style={styles.bottomTab}>
        <TabItem icon={<FileText size={24} color="#64748B" />} onPress={() => router.push('/home')} />
        <TabItem icon={<Building2 size={24} color="#64748B" />} onPress={() => router.push('/ambientes')} />
        <TabItem icon={<Zap size={24} color="#64748B" />} onPress={() => router.push('/perifericos')} />
        <TabItem icon={<Bell size={24} color="#2563EB" />} active onPress={() => router.push('/notificacao')} />
        <TabItem icon={<BarChart3 size={24} color="#64748B" />} onPress={() => router.push('/relatorios')} />
      </View>
    </SafeAreaView>
  );
}

function FilterButton({ label, icon, active, onPress }: any) {
    return (
        <TouchableOpacity 
            style={[styles.filterBtn, active && styles.filterBtnActive]} 
            onPress={onPress}
        >
            {icon}
            <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>{label}</Text>
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
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  headerSubtitle: { fontSize: 14, color: '#64748B' },
  tabBarShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3, marginBottom: 20 },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 14, padding: 6, gap: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  filterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 8 },
  filterBtnActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  filterBtnText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  filterBtnTextActive: { color: '#1E293B', fontWeight: 'bold' },
  dotIcon: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  mainCard: { backgroundColor: '#FFF', borderRadius: 24, minHeight: 300, padding: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  emptyContainer: { alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
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