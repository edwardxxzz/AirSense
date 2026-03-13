import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Pressable,
  Dimensions
} from 'react-native';
import { 
  Bell, 
  FileText, 
  Building2, 
  Zap, 
  BarChart3, 
  X, 
  User, 
  LogOut, 
  ChevronRight,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Lock,
  Camera,
  Save
} from 'lucide-react-native';
import { useRouter } from 'expo-router'; 

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png'); 

export default function ProfileScreen() {
  const router = useRouter();
  const [isProfileVisible, setIsProfileVisible] = useState(false);

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
            <Text style={styles.avatarText}>US</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Dados Pessoais</Text>
          <Text style={styles.headerSubtitle}>Gerencie as informações de perfil</Text>
        </View>

        {/* --- CARD 1: INFORMAÇÕES DE PERFIL --- */}
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>Informações de Perfil</Text>
          <Text style={styles.cardSubtitle}>Atualize seus dados pessoais e de contato</Text>

          <View style={styles.avatarContainer}>
            <View style={styles.mainAvatar}>
              <Text style={styles.mainAvatarText}>US</Text>
              <TouchableOpacity style={styles.cameraBtn}>
                <Camera color="#64748B" size={16} />
              </TouchableOpacity>
            </View>
            <View style={styles.avatarInfo}>
                <Text style={styles.userNameText}>Usuário</Text>
                <Text style={styles.userRoleText}>Administrador</Text>
                <Text style={styles.userCompanyText}>Empresa</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <InputLabel label="Nome completo" icon={<User size={20} />} placeholder="Usuário" />
          <InputLabel label="Email" icon={<Mail size={20} />} placeholder="Usuário" />
          <InputLabel label="Telefone" icon={<Phone size={20} />} placeholder="(92) 99999-9999" />
          <InputLabel label="Empresa" icon={<Briefcase size={20} />} placeholder="Empresa" />
          <InputLabel label="Localização" icon={<MapPin size={20} />} placeholder="Manaus, AM" />

          <TouchableOpacity style={styles.btnSave}>
            <Save color="#FFF" size={20} />
            <Text style={styles.btnSaveText}>Salvar alterações</Text>
          </TouchableOpacity>
        </View>

        {/* --- CARD 2: SEGURANÇA --- */}
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>Segurança</Text>
          <Text style={styles.cardSubtitle}>Atualize sua senha de acesso</Text>

          <InputLabel label="Senha Atual" icon={<Lock size={20} />} placeholder="••••••••" secureTextEntry />
          <InputLabel label="Nova Senha" icon={<Lock size={20} />} placeholder="Mínimo 8 caracteres" secureTextEntry />
          <InputLabel label="Confirmar Nova Senha" icon={<Lock size={20} />} placeholder="Confirmar nova senha" secureTextEntry />

          <TouchableOpacity style={styles.btnConfirmPassword}>
            <Lock color="#64748B" size={20} />
            <Text style={styles.btnConfirmPasswordText}>Confirmar Senha</Text>
          </TouchableOpacity>
        </View>

        {/* BOTÃO DELETAR CONTA */}
        <TouchableOpacity style={styles.btnDelete} onPress={() => router.replace('/')}>
            <X color="#FFF" size={24} />
            <Text style={styles.btnDeleteText}>Deletar Conta</Text>
        </TouchableOpacity>

        <View style={{height: 120}} /> 
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
              <View style={styles.largeAvatar}><Text style={styles.largeAvatarText}>US</Text></View>
              <Text style={styles.userName}>Usuário</Text>
              <Text style={styles.userEmail}>usuario@empresa.com</Text>
            </View>
            <div style={styles.separator} />
            <TouchableOpacity style={styles.configItem} onPress={() => setIsProfileVisible(false)}>
              <View style={styles.configItemLeft}>
                <View style={styles.configIconBox}><User color="#1E293B" size={22} /></View>
                <View><Text style={styles.configItemTitle}>Minha Conta</Text><Text style={styles.configItemSub}>Dados Pessoais</Text></View>
              </View>
              <ChevronRight color="#1E293B" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSignOut, { marginTop: 25 }]} onPress={() => { setIsProfileVisible(false); router.replace('/'); }}>
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
        <TabItem icon={<Bell size={24} color="#64748B" />} onPress={() => router.push('/notificacao')} />
        <TabItem icon={<BarChart3 size={24} color="#64748B" />} onPress={() => router.push('/relatorios')} />
      </View>
    </SafeAreaView>
  );
}

// --- COMPONENTE DE INPUT COM ESTADO DE FOCO E SOMBRA ---
function InputLabel({ label, icon, placeholder, secureTextEntry }: any) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.labelStyle}>{label}</Text>
      <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
        {React.cloneElement(icon, { color: isFocused ? '#2563EB' : '#64748B' })}
        <TextInput 
    style={styles.textInput} // Aqui entrarão as regras de altura e outline
    placeholder={placeholder} 
    placeholderTextColor="#94A3B8"
    secureTextEntry={secureTextEntry}
    onFocus={() => setIsFocused(true)}
     onBlur={() => setIsFocused(false)}
  {...({ outlineStyle: 'none' } as any)} 
/>
      </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topAppBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 5, backgroundColor: '#FFF' },
  topLogo: { width: 140, height: 60 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBadge: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 15 },
  headerSection: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  headerSubtitle: { fontSize: 14, color: '#64748B' },

  cardMain: { 
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5, 
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  cardSubtitle: { fontSize: 12, color: '#64748B', marginBottom: 20, marginTop: 4 },
  
  avatarContainer: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  mainAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  mainAvatarText: { color: '#FFF', fontSize: 36, fontWeight: 'bold' },
  cameraBtn: { 
    position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FFF', width: 34, height: 34, borderRadius: 17, 
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 4,
  },
  avatarInfo: { flex: 1, justifyContent: 'center', gap: 2 },
  userNameText: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  userRoleText: { fontSize: 14, color: '#64748B' },
  userCompanyText: { fontSize: 12, color: '#94A3B8' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10, marginBottom: 20 },

  inputWrapper: { marginBottom: 16 },
  labelStyle: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
  inputContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', 
    borderRadius: 12, paddingHorizontal: 15, height: 52, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  inputContainerFocused: { borderColor: '#000000', borderWidth: 2, shadowOpacity: 0.08, shadowRadius: 5 },
  textInput: { flex: 1, fontSize: 15, color: '#1E293B', fontWeight: '500',height:'90%', outlineWidth:0, outlineColor:'transparent' },

  btnSave: { backgroundColor: '#2563EB', height: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  btnSaveText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  btnConfirmPassword: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, backgroundColor: '#FFF' },
  btnConfirmPasswordText: { color: '#64748B', fontWeight: 'bold', fontSize: 16 },
  btnDelete: { backgroundColor: '#CC0000', height: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  btnDeleteText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

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