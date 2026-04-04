import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  Pressable, Image, ScrollView, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, ArrowRight, Eye, EyeOff, User, Building } from 'lucide-react-native';
import { useRouter } from 'expo-router';

// --- FIREBASE SERVICES ---
import { auth, db } from '../services/firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail
} from "firebase/auth";

// Métodos do Firestore
import { doc, setDoc, getDoc, collection, addDoc } from "firebase/firestore";

const LogoImg = require('../assets/images/logo.png');

export default function LoginScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('Entrar');
  const [cadStep, setCadStep] = useState(1);
  
  // Estados dos Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Estados de UI
  const [secureText, setSecureText] = useState(true);
  const [secureTextConfirm, setSecureTextConfirm] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [hasLoginError, setHasLoginError] = useState(false);

  const isEmailValid = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  const canLogin = isEmailValid(email) && password.length > 0;
  const isStep1Complete = fullName.length >= 2 && isEmailValid(email) && company.length > 1;
  const isStep2Complete = password.length >= 8 && password === confirmPassword && agreeTerms;

  // --- LOGIN LOGIC ---
  const handleLogin = async () => {
    setHasLoginError(false); 
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/home');
    } catch (error: any) {
      setHasLoginError(true);
      Alert.alert("Erro", "Falha ao entrar. Verifique suas credenciais.");
    }
  };

  // --- SIGN UP LOGIC (Passo a Passo da Lógica) ---
  const handleSignUp = async () => {
    try {
      console.log("Iniciando cadastro...");
      
      // 1. Criar usuário no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      console.log("Usuário criado no Auth com UID:", uid);

      // 2. Gerar ID seguro para a empresa (remove caracteres proibidos do Firestore)
      const safeCompany = company.trim().replace(/[.#$[\]]/g, "_");
      console.log("ID da Empresa:", safeCompany);

      // 3. Referência do documento da empresa
      const empresaRef = doc(db, "empresas", safeCompany);
      const empresaSnap = await getDoc(empresaRef);

      // 4. Se a empresa NÃO existe, criar a estrutura inicial baseada na nova modelagem
      if (!empresaSnap.exists()) {
        console.log("Criando nova estrutura da empresa (Integração Hardware)...");
        const dataAtualIso = new Date().toISOString();
        
        // Cria doc da empresa
        await setDoc(empresaRef, {
          nome: safeCompany,
          criadoEm: dataAtualIso
        });

        // NOVA ESTRUTURA: Cria coleção 'centrais' > 'macRPI'
        await setDoc(doc(db, "empresas", safeCompany, "centrais", "macRPI"), {
          ip_local: "",
          nome: "",
          online: false
        });

        // NOVA ESTRUTURA: Cria subcoleção 'historico_geral' com o primeiro registro temporal
        const historicoRef = collection(db, "empresas", safeCompany, "historico_geral");
        await addDoc(historicoRef, {
          timestamp: Date.now(),
          hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          indice_conforto: 0,
          luminosidade: 0,
          qual_do_ar: 0,
          temperatura_media: 0,
          umidade:0
        });

        // NOVA ESTRUTURA: Cria coleção 'ambientes' > 'ambiente_1'
        const ambiente1Ref = doc(db, "empresas", safeCompany, "ambientes", "ambiente_1");
        await setDoc(ambiente1Ref, {
          dados: {
            central_id: "central 1",
            criadoEM: dataAtualIso,
            nome: "ambiente 1",
            receptor_id: "receptor1"
          },
          sensores: {
            luminosidade: 0,
            presenca: false,
            temperatura: 0,
            umidade: 0
          }
        });

        // NOVA ESTRUTURA: Subcoleção 'historico' do ambiente_1
        await setDoc(doc(ambiente1Ref, "historico", "registro_inicial"), {
          co2: 0,
          luminosidade: 0,
          presenca: 0,
          qualidade_ar: 100,
          temperatura: 0,
          timestamp: dataAtualIso,
          umidade: 0,
          indice_geral:0,
        });

        // NOVA ESTRUTURA: Subcoleção 'perifericos' do ambiente_1
        await setDoc(doc(ambiente1Ref, "perifericos", "ar_condicionado"), {
          geral: {
            ligado: false,
            marca: "",
            modelo: "",
            temperatura: 24
          }
        });
      }

      // 5. Criar o documento do Usuário (na subcoleção usuarios da empresa)
      console.log("Salvando dados do usuário no Firestore...");
      
      await setDoc(doc(db, "empresas", safeCompany, "usuarios", uid), {
        email: email.toLowerCase().trim(),
        userName: fullName,
        userId: uid,
        dataLogin: new Date().toISOString(),
        senha: "Gerenciada pelo Firebase Auth" 
      });

      console.log("Cadastro completo!");
      Alert.alert("Sucesso", "Conta criada com sucesso!");
      router.replace('/home');
      
    } catch (error: any) {
      console.error("Erro no cadastro:", error);
      Alert.alert("Erro no cadastro", error.message);
    }
  };

  const handleRecovery = async () => {
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert("Recuperação", "Link enviado para o seu e-mail.");
      setTab('Entrar');
    } catch (error: any) { Alert.alert("Erro", "E-mail não encontrado."); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image source={LogoImg} style={styles.logoEstilo} resizeMode="contain" />
            </View>
          </View>

          <View style={styles.navBar}>
            {['Entrar', 'Cadastrar', 'Recuperar'].map((item) => (
              <Pressable key={item} onPress={() => { setTab(item); setCadStep(1); setHasLoginError(false); }} style={[styles.navItem, tab === item && styles.navItemActive]}>
                <Text style={[styles.navText, tab === item && styles.navTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.welcomeSection}>
            <Text style={styles.title}>
              {tab === 'Entrar' ? 'Bem-vindo de volta' : tab === 'Cadastrar' ? 'Criar sua conta' : 'Esqueceu sua senha?'}
            </Text>
            <Text style={styles.subtitle}>
              {tab === 'Entrar' ? 'Entre na sua conta para continuar' : tab === 'Cadastrar' ? 'Preencha seus dados para começar' : 'Digite seu email e enviaremos instruções.'}
            </Text>
            {tab === 'Entrar' && hasLoginError && (
              <Text style={styles.errorTextSubtle}>email ou senha incorretos</Text>
            )}
          </View>

          <View style={styles.form}>
            {tab === 'Entrar' && (
              <>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputGroup, (hasLoginError || (email.length > 0 && !isEmailValid(email))) && styles.inputError]}>
                  <Mail color="#000" size={20} />
                  <View style={styles.separator} />
                  <TextInput style={styles.input} placeholder="seu@email.com" value={email} onChangeText={(text) => { setEmail(text); setHasLoginError(false); }} autoCapitalize="none" placeholderTextColor="#94A3B8" {...({ outlineStyle: 'none' } as any)} />
                </View>

                <View style={styles.labelRow}><Text style={styles.label}>Senha</Text><TouchableOpacity onPress={() => setTab('Recuperar')}><Text style={styles.forgotText}>Esqueceu a senha?</Text></TouchableOpacity></View>
                <View style={[styles.inputGroup, hasLoginError && styles.inputError]}>
                  <Lock color="#000" size={20} />
                  <View style={styles.separator} />
                  <TextInput style={styles.input} placeholder="Sua senha" secureTextEntry={secureText} value={password} onChangeText={(text) => { setPassword(text); setHasLoginError(false); }} placeholderTextColor="#94A3B8" {...({ outlineStyle: 'none' } as any)} />
                  <TouchableOpacity onPress={() => setSecureText(!secureText)}>
                    {secureText ? <EyeOff color="#64748B" size={20} /> : <Eye color="#64748B" size={20} />}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity disabled={!canLogin} onPress={handleLogin} style={{ marginTop: 25 }}>
                  <LinearGradient colors={['#0097B2', '#2B58E2']} start={{x:0, y:0}} end={{x:1, y:0}} style={[styles.mainButton, !canLogin && {opacity: 0.5}]}>
                    <Text style={styles.buttonText}>Entrar</Text>
                    <ArrowRight color="white" size={20} />
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {tab === 'Cadastrar' && (
              <View>
                <View style={styles.stepperContainer}>
                  <View style={[styles.stepCircle, styles.stepActive]}><Text style={styles.stepText}>1</Text></View>
                  <View style={[styles.stepLine, cadStep === 2 && styles.stepLineActive]} />
                  <View style={[styles.stepCircle, cadStep === 2 && styles.stepActive]}><Text style={styles.stepText}>2</Text></View>
                </View>

                {cadStep === 1 ? (
                  <>
                    <Text style={styles.label}>Nome Completo</Text>
                    <View style={styles.inputGroup}><User color="#000" size={20} /><View style={styles.separator} /><TextInput style={styles.input} placeholder="Seu nome" value={fullName} onChangeText={setFullName} placeholderTextColor="#94A3B8" {...({ outlineStyle: 'none' } as any)} /></View>
                    <Text style={styles.label}>Email Corporativo</Text>
                    <View style={[styles.inputGroup, email.length > 0 && !isEmailValid(email) && styles.inputError]}><Mail color="#000" size={20} /><View style={styles.separator} /><TextInput style={styles.input} placeholder="seu@empresa.com" value={email} onChangeText={setEmail} autoCapitalize="none" placeholderTextColor="#94A3B8" {...({ outlineStyle: 'none' } as any)} /></View>
                    <Text style={styles.label}>Empresa</Text>
                    <View style={styles.inputGroup}><Building color="#000" size={20} /><View style={styles.separator} /><TextInput style={styles.input} placeholder="Nome da empresa" value={company} onChangeText={setCompany} placeholderTextColor="#94A3B8" {...({ outlineStyle: 'none' } as any)} /></View>
                    <TouchableOpacity disabled={!isStep1Complete} onPress={() => setCadStep(2)} style={{ marginTop: 25 }}>
                      <LinearGradient colors={['#0097B2', '#2B58E2']} start={{x:0, y:0}} end={{x:1, y:0}} style={[styles.mainButton, !isStep1Complete && {opacity: 0.5}]}>
                        <Text style={styles.buttonText}>Continuar</Text>
                        <ArrowRight color="white" size={20} />
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Senha</Text>
                    <View style={styles.inputGroup}>
                      <Lock color="#000" size={20} /><View style={styles.separator} />
                      <TextInput style={styles.input} placeholder="Mínimo 8 caracteres" secureTextEntry={secureText} value={password} onChangeText={setPassword} placeholderTextColor="#94A3B8" {...({ outlineStyle: 'none' } as any)} />
                      <TouchableOpacity onPress={() => setSecureText(!secureText)}>{secureText ? <EyeOff color="#64748B" size={20} /> : <Eye color="#64748B" size={20} />}</TouchableOpacity>
                    </View>
                    <Text style={styles.label}>Confirma Senha</Text>
                    <View style={[styles.inputGroup, confirmPassword.length > 0 && password !== confirmPassword && styles.inputError]}>
                      <Lock color="#000" size={20} /><View style={styles.separator} />
                      <TextInput style={styles.input} placeholder="Digite novamente" secureTextEntry={secureTextConfirm} value={confirmPassword} onChangeText={setConfirmPassword} placeholderTextColor="#94A3B8" {...({ outlineStyle: 'none' } as any)} />
                      <TouchableOpacity onPress={() => setSecureTextConfirm(!secureTextConfirm)}>{secureTextConfirm ? <EyeOff color="#64748B" size={20} /> : <Eye color="#64748B" size={20} />}</TouchableOpacity>
                    </View>
                    <View style={styles.termsRow}>
                      <TouchableOpacity style={styles.checkboxSmall} onPress={() => setAgreeTerms(!agreeTerms)}>{agreeTerms && <View style={styles.checkboxCheckedSmall} />}</TouchableOpacity>
                      <Text style={styles.termsText}>Concordo com os <Text style={styles.linkBlue}>Termos de Uso</Text></Text>
                    </View>
                    <View style={styles.dualButtons}>
                      <TouchableOpacity style={styles.btnBack} onPress={() => setCadStep(1)}><Text style={styles.btnBackText}>Voltar</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.btnFinish} disabled={!isStep2Complete} onPress={handleSignUp}>
                        <LinearGradient colors={['#0097B2', '#2B58E2']} start={{x:0, y:0}} end={{x:1, y:0}} style={[styles.buttonGradient, !isStep2Complete && { opacity: 0.5 }]}><Text style={styles.buttonText}>Criar conta</Text><ArrowRight color="white" size={18} /></LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {tab === 'Recuperar' && (
              <View>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputGroup, email.length > 0 && !isEmailValid(email) && styles.inputError]}><Mail color="#000" size={20} /><View style={styles.separator} /><TextInput style={styles.input} placeholder="seu@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" placeholderTextColor="#94A3B8" {...({ outlineStyle: 'none' } as any)} /></View>
                <TouchableOpacity disabled={!isEmailValid(email)} style={{ marginTop: 30 }} onPress={handleRecovery}>
                  <LinearGradient colors={['#0097B2', '#2B58E2']} start={{x:0, y:0}} end={{x:1, y:0}} style={[styles.mainButton, !isEmailValid(email) && {opacity: 0.5}]}>
                    <Text style={styles.buttonText}>Enviar link</Text>
                    <ArrowRight color="white" size={20} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingHorizontal: 25, paddingVertical: 40, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 0 },
  logoContainer: { width: 160, height: 200, marginBottom: 0 },
  logoEstilo: { width: '100%', height: '100%', borderRadius: 12 },
  navBar: { flexDirection: 'row', width: '100%', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 6, marginBottom: 25 },
  navItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  navItemActive: { backgroundColor: '#FFF', elevation: 3 },
  navText: { color: '#64748B', fontWeight: '600' },
  navTextActive: { color: '#1E293B' },
  welcomeSection: { width: '100%', alignItems: 'center', marginBottom: 25 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
  subtitle: { color: '#64748B', textAlign: 'center', marginTop: 8, paddingHorizontal: 10, lineHeight: 20 },
  errorTextSubtle: { color: '#ef4444', fontSize: 13, fontWeight: '600', marginTop: 5, textAlign: 'center' },
  form: { width: '100%' },
  label: { color: '#1E293B', fontWeight: '600', marginBottom: 8, marginTop: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, height: 56 },
  separator: { width: 5 },
  input: { flex: 1, height: '90%', color: '#1E293B', fontSize: 15, paddingHorizontal:10 , outlineColor:"transparent", outlineWidth:0},
  inputError: { borderColor: '#ef4444' },
  forgotText: { color: '#0097B2', fontSize: 13, marginTop: 18 },
  mainButton: { flexDirection: 'row', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginRight: 10 },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  stepCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  stepActive: { backgroundColor: '#0097B2' },
  stepText: { color: 'white', fontWeight: 'bold' },
  stepLine: { width: 40, height: 3, backgroundColor: '#E2E8F0', marginHorizontal: 10 },
  stepLineActive: { backgroundColor: '#0097B2' },
  termsRow: { flexDirection: 'row', marginTop: 20, alignItems: 'center' },
  checkboxSmall: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#0097B2', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  checkboxCheckedSmall: { width: 10, height: 10, backgroundColor: '#0097B2' },
  termsText: { fontSize: 12, color: '#64748B', marginLeft: 10, flex: 1 },
  linkBlue: { color: '#0097B2', fontWeight: '600' },
  dualButtons: { flexDirection: 'row', gap: 12, marginTop: 25, width: '100%', height: 56 },
  btnBack: { flex: 1, height: '100%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  btnBackText: { fontWeight: '600', color: '#64748B' },
  btnFinish: { flex: 1.8, height: '100%', borderRadius: 12, overflow: 'hidden' },
  buttonGradient: { flexDirection: 'row', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
});