import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  Alert
} from 'react-native';
import { 
  Bell, User, Mail, Phone, Briefcase, MapPin, Lock, X, Camera, Save, Eye, EyeOff,
  FileText, Building2, Zap, BarChart3
} from 'lucide-react-native';
import { useRouter } from 'expo-router'; 

// --- IMPORTAÇÕES FIREBASE FIRESTORE ---
import { 
  updatePassword, 
  deleteUser,
  onAuthStateChanged 
} from "firebase/auth";
import { auth, db } from '../services/firebaseConfig';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  collection, 
  query, 
  where, 
  collectionGroup, 
  getDocs 
} from "firebase/firestore";

const { width } = Dimensions.get('window');
const LogoImg = require('../assets/images/logo.png'); 

export default function ProfileScreen() {
  const router = useRouter();

  // Estados dos Campos Pessoais
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState(''); // ID da Empresa (ex: UFAM)
  const [location, setLocation] = useState('');
  
  // Estados de Senha
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  
  // Visibilidade das Senhas
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Estados de Erro e Feedback
  // Armazena referências necessárias para atualização (caminho do documento)
  const [originalData, setOriginalData] = useState<{ 
    empresaId: string; 
    userId: string; 
    docId: string; 
    senha?: string; 
  } | null>(null);
  
  const [companyError, setCompanyError] = useState(false);
  const [passError, setPassError] = useState(false);
  const [matchError, setMatchError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        // 1. Busca o usuário em todas as subcoleções 'usuarios'
        const userQuery = query(collectionGroup(db, 'usuarios'), where('userId', '==', user.uid));
        const userSnapshot = await getDocs(userQuery);

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userData = userDoc.data();
          
          // O ID da empresa é o ID do documento pai da subcoleção 'usuarios'
          const empresaId = userDoc.ref.parent.parent?.id || '';
          const docId = userDoc.id; // ID do documento do usuário (geralmente o UID)

          setFullName(userData.userName || 'Usuário');
          setEmail(userData.email || user.email);
          setPhone(userData.telefone || '');
          setCompany(empresaId);
          setLocation(userData.localizacao || '');
          
          setOriginalData({ 
            empresaId, 
            userId: user.uid, 
            docId: docId,
            senha: userData.senha // Guarda senha para validação local (se existir no DB)
          });
        }
      } catch (error) { 
        console.error("Erro ao carregar perfil:", error); 
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return 'US';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user || !originalData) return;
    setCompanyError(false);

    const newCompanyId = company.trim(); // ID da nova empresa (ex: "UFAM", "NovaEmpresa")
    const safeName = fullName.trim();

    try {
      // Lógica de Mudança de Empresa
      if (newCompanyId !== originalData.empresaId) {
        // Verifica se a nova empresa existe
        const newCompanyRef = doc(db, "empresas", newCompanyId);
        const newCompanySnap = await getDoc(newCompanyRef);

        if (!newCompanySnap.exists()) {
          setCompanyError(true);
          Alert.alert("Erro", "A empresa de destino não existe no sistema.");
          return;
        }

        // Move o usuário: Cria na nova e deleta na antiga
        const newUserRef = doc(db, "empresas", newCompanyId, "usuarios", originalData.docId);
        const oldUserRef = doc(db, "empresas", originalData.empresaId, "usuarios", originalData.docId);

        // Dados atualizados
        const payload = {
          userId: user.uid,
          userName: safeName,
          email: email.toLowerCase().trim(),
          telefone: phone,
          localizacao: location,
          senha: originalData.senha || "", // Mantém senha existente
          dataAtualizacao: new Date().toISOString()
        };

        await setDoc(newUserRef, payload);
        await deleteDoc(oldUserRef);

        Alert.alert("Sucesso", "Perfil e empresa atualizados!");
        
        // Atualiza estado original
        setOriginalData(prev => prev ? { ...prev, empresaId: newCompanyId } : null);

      } else {
        // Apenas atualiza os dados na mesma empresa
        const userRef = doc(db, "empresas", originalData.empresaId, "usuarios", originalData.docId);
        await updateDoc(userRef, {
          userName: safeName,
          email: email.toLowerCase().trim(),
          telefone: phone,
          localizacao: location,
          dataAtualizacao: new Date().toISOString()
        });
        Alert.alert("Sucesso", "Perfil atualizado!");
      }

    } catch (error) { 
      console.error(error);
      Alert.alert("Erro", "Falha ao salvar."); 
    }
  };

  const handleUpdatePassword = async () => {
    const user = auth.currentUser;
    if (!user || !originalData) return;
    
    setPassError(false);
    setMatchError(false);

    // Verificação da senha atual (comparação local conforme lógica original)
    // Nota: O ideal é usar reauthenticateWithCredential, mas mantive a lógica do seu código
    if (currentPass !== originalData.senha) { 
      setPassError(true); 
      return; 
    }
    
    if (newPass !== confirmNewPass || newPass === '') { 
      setMatchError(true); 
      return; 
    }

    try {
      await updatePassword(user, newPass);
      
      // Atualiza a senha no Firestore para manter a referência local (se necessário)
      const userRef = doc(db, "empresas", originalData.empresaId, "usuarios", originalData.docId);
      await updateDoc(userRef, { senha: newPass });

      // Atualiza estado local
      setOriginalData(prev => prev ? { ...prev, senha: newPass } : null);
      
      setSuccessMsg('Senha alterada com sucesso!');
      setCurrentPass(''); setNewPass(''); setConfirmNewPass('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      Alert.alert("Erro", "Não foi possível atualizar a senha. Tente relgar.");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert("Excluir Conta", "Tem certeza? Isso apagará seus dados permanentemente.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
          const user = auth.currentUser;
          if (user && originalData) {
            try {
              // Deleta do Firestore
              await deleteDoc(doc(db, "empresas", originalData.empresaId, "usuarios", originalData.docId));
              // Deleta a autenticação
              await deleteUser(user);
              router.replace('/');
            } catch (e) { 
              Alert.alert("Erro", "Relogue para excluir por segurança."); 
            }
          }
        }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAppBar}>
        <Image source={LogoImg} style={styles.topLogo} resizeMode="contain" />
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBadge}><Bell color="#000" size={24} /></TouchableOpacity>
          <TouchableOpacity style={styles.avatarCircleSmall}>
            <Text style={styles.avatarTextSmall}>{getInitials(fullName)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Dados Pessoais</Text>
          <Text style={styles.headerSubtitle}>Gerencie as informações de perfil</Text>
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.cardSectionTitle}>Informações de Perfil</Text>
          <Text style={styles.cardSectionSub}>Atualize seus dados pessoais e de contato</Text>

          <View style={styles.avatarContainer}>
            <View style={styles.largeAvatar}>
              <Text style={styles.largeAvatarText}>{getInitials(fullName)}</Text>
              <TouchableOpacity style={styles.cameraBtn}>
                <Camera size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.avatarInfo}>
              <Text style={styles.profileUserName}>{fullName || 'Usuário'}</Text>
              <Text style={styles.profileUserRole}>Administrador</Text>
              <Text style={styles.profileUserCompany}>{company || 'Empresa'}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          <InputLabel label="Nome completo" icon={<User size={20} />} value={fullName} onChangeText={setFullName} placeholder="Usuário" />
          <InputLabel label="Email" icon={<Mail size={20} />} value={email} onChangeText={setEmail} placeholder="usuario@email.com" />
          <InputLabel label="Telefone" icon={<Phone size={20} />} value={phone} onChangeText={setPhone} placeholder="(92) 99999-9999" />
          <InputLabel label="Empresa (ID)" icon={<Briefcase size={20} />} value={company} onChangeText={(t:any)=>{setCompany(t); setCompanyError(false)}} error={companyError} placeholder="Ex: UFAM" />
          <InputLabel label="Localização" icon={<MapPin size={20} />} value={location} onChangeText={setLocation} placeholder="Localização" />

          <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
            <Save color="#FFF" size={20} /><Text style={styles.btnSaveText}>Salvar alterações</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.cardSectionTitle}>Segurança</Text>
          <Text style={styles.cardSectionSub}>Atualize sua senha de acesso</Text>
          
          <InputLabel label="Senha Atual" icon={<Lock size={20} />} value={currentPass} onChangeText={(t:any)=>{setCurrentPass(t); setPassError(false)}} secureTextEntry={!showCurrent} error={passError} showEye onEyePress={()=>setShowCurrent(!showCurrent)} isEyeOpen={showCurrent} placeholder="••••••••" />
          <InputLabel label="Nova Senha" icon={<Lock size={20} />} value={newPass} onChangeText={(t:any)=>{setNewPass(t);}} secureTextEntry={!showNew} showEye onEyePress={()=>setShowNew(!showNew)} isEyeOpen={showNew} placeholder="Mínimo 8 caracteres" />
          <InputLabel label="Confirmar Nova Senha" icon={<Lock size={20} />} value={confirmNewPass} onChangeText={(t:any)=>{setConfirmNewPass(t); setMatchError(false)}} secureTextEntry={!showConfirm} error={matchError} showEye onEyePress={()=>setShowConfirm(!showConfirm)} isEyeOpen={showConfirm} placeholder="Confirmar nova senha" />
          
          {successMsg !== '' && <Text style={styles.successText}>{successMsg}</Text>}
          
          <TouchableOpacity style={styles.btnConfirmPassword} onPress={handleUpdatePassword}>
            <Lock color="#64748B" size={20} /><Text style={styles.btnConfirmPasswordText}>Confirmar Senha</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btnDelete} onPress={handleDeleteAccount}>
            <X color="#FFF" size={24} /><Text style={styles.btnDeleteText}>Deletar Conta</Text>
        </TouchableOpacity>
        
        <View style={{height: 100}} /> 
      </ScrollView>

      {/* FOOTER TAB BAR */}
      <View style={styles.bottomTab}>
        <TouchableOpacity onPress={() => router.push('/home')}><FileText size={24} color="#64748B" /></TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/ambientes')}><Building2 size={24} color="#64748B" /></TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/perifericos')}><Zap size={24} color="#64748B" /></TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/notificacao')}><Bell size={24} color="#64748B" /></TouchableOpacity>
        <TouchableOpacity><BarChart3 size={24} color="#64748B" /></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function InputLabel({ label, icon, value, onChangeText, secureTextEntry, error, showEye, onEyePress, isEyeOpen, placeholder }: any) {
  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.labelStyle}>{label}</Text>
      <View style={[styles.inputContainer, error && { borderColor: '#EF4444' }]}>
        {React.cloneElement(icon, { color: '#64748B', size: 18 })}
        <TextInput 
          style={styles.textInput} 
          value={value} 
          onChangeText={onChangeText} 
          secureTextEntry={secureTextEntry} 
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
        />
        {showEye && (
          <TouchableOpacity onPress={onEyePress}>
            {isEyeOpen ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topAppBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 5, backgroundColor: '#FFF' },
  topLogo: { width: 140, height: 90 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBadge: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarCircleSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarTextSmall: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  
  scrollContent: { paddingHorizontal: 16, paddingTop: 15 },
  headerSection: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#000' },
  headerSubtitle: { fontSize: 14, color: '#64748B' },

  cardMain: { backgroundColor: '#FFF', borderRadius: 32, padding: 24, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  cardSectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  cardSectionSub: { fontSize: 13, color: '#64748B', marginBottom: 25 },

  avatarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  largeAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  largeAvatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FFF', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 3, borderWidth: 1, borderColor: '#E2E8F0' },
  avatarInfo: { marginLeft: 16 },
  profileUserName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  profileUserRole: { fontSize: 14, color: '#64748B' },
  profileUserCompany: { fontSize: 13, color: '#94A3B8' },
  separator: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 20 },

  inputWrapper: { marginBottom: 16 },
  labelStyle: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 15, height: 48, gap: 10 },
  textInput: { flex: 1, fontSize: 15, color: '#1E293B',height:"90%", outlineWidth:0 , outlineColor:"transparent"},
  
  btnSave: { backgroundColor: '#2563EB', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  btnSaveText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

  btnConfirmPassword: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFF' },
  btnConfirmPasswordText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
  
  btnDelete: { backgroundColor: '#C00000', height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 4 },
  btnDeleteText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  successText: { color: '#10B981', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  
  bottomTab: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 70, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F1F5F9', position: 'absolute', bottom: 0, width: '100%' }
});