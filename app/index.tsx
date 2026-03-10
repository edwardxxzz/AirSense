import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  Pressable, 
  Image, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, ArrowRight, Eye, EyeOff, User, Building } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const LogoImg = require('../assets/images/logo.png');
const GoogleIcon = require('../assets/images/google_logo.png');

export default function LoginScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('Entrar'); 
  const [cadStep, setCadStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [secureTextConfirm, setSecureTextConfirm] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Validação: Aceita gmail.com ou qualquer coisa.com
  const isEmailValid = (text: string) => {
    const regex = /^[a-zA-Z0-9._%+-]+@(?:gmail\.com|[a-zA-Z0-9.-]+\.com)$/;
    return regex.test(text);
  };

  const canLogin = isEmailValid(email) && password.length > 0;
  const isStep1Complete = fullName.length > 3 && isEmailValid(email) && company.length > 1;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image source={LogoImg} style={styles.logoEstilo} resizeMode="contain" />
            </View>
            <Text style={styles.appName}>Arsense</Text>
          </View>

          <View style={styles.navBar}>
            {['Entrar', 'Cadastrar', 'Recuperar'].map((item) => (
              <Pressable key={item} onPress={() => { setTab(item); setCadStep(1); }} style={[styles.navItem, tab === item && styles.navItemActive]}>
                <Text style={[styles.navText, tab === item && styles.navTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.welcomeSection}>
            <Text style={styles.title}>
              {tab === 'Entrar' ? 'Bem-vindo de volta' : tab === 'Cadastrar' ? 'Criar sua conta' : 'Esqueceu sua senha?'}
            </Text>
            <Text style={styles.subtitle}>
              {tab === 'Entrar' ? 'Entre na sua conta para continuar' : tab === 'Cadastrar' ? 'Preencha seus dados para começar' : 'Digite seu email e enviaremos instruções para redefinir sua senha.'}
            </Text>
          </View>

          <View style={styles.form}>
            {/* --- ABA ENTRAR --- */}
            {tab === 'Entrar' && (
              <>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputGroup, email.length > 0 && !isEmailValid(email) && styles.inputError]}>
                  <Mail color="#000" size={20} />
                  <View style={styles.separator} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="seu@email.com" 
                    value={email} 
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.labelRow}><Text style={styles.label}>Senha</Text><TouchableOpacity onPress={() => setTab('Recuperar')}><Text style={styles.forgotText}>Esqueceu a senha?</Text></TouchableOpacity></View>
                <View style={styles.inputGroup}>
                  <Lock color="#000" size={20} />
                  <View style={styles.separator} />
                  <TextInput style={styles.input} placeholder="Sua senha" secureTextEntry={secureText} value={password} onChangeText={setPassword} placeholderTextColor="#94A3B8" />
                  <TouchableOpacity onPress={() => setSecureText(!secureText)}>{secureText ? <EyeOff color="#64748B" size={20} /> : <Eye color="#64748B" size={20} />}</TouchableOpacity>
                </View>

                <View style={styles.rememberContainer}>
                  <TouchableOpacity style={styles.checkbox} onPress={() => setRememberMe(!rememberMe)}>{rememberMe && <View style={styles.checkboxChecked} />}</TouchableOpacity>
                  <Text style={styles.rememberText}>Manter conectado</Text>
                </View>

                <TouchableOpacity disabled={!canLogin} onPress={() => router.replace('/home')}>
                  <LinearGradient colors={['#0097B2', '#2B58E2']} start={{x:0, y:0}} end={{x:1, y:0}} style={[styles.mainButton, !canLogin && {opacity: 0.5}]}>
                    <Text style={styles.buttonText}>Entrar</Text>
                    <ArrowRight color="white" size={20} />
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.dividerContainer}><View style={styles.divider} /><Text style={styles.dividerText}> ou continue com </Text><View style={styles.divider} /></View>
                <TouchableOpacity style={styles.googleButton}><Image source={GoogleIcon} style={styles.googleIcon} /><Text style={styles.googleButtonText}>Entrar com Google</Text></TouchableOpacity>
              </>
            )}

            {/* --- ABA CADASTRAR --- */}
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
                    <View style={styles.inputGroup}><User color="#000" size={20} /><View style={styles.separator} /><TextInput style={styles.input} placeholder="Seu nome" value={fullName} onChangeText={setFullName} placeholderTextColor="#94A3B8" /></View>
                    
                    <Text style={styles.label}>Email Corporativo</Text>
                    <View style={[styles.inputGroup, email.length > 0 && !isEmailValid(email) && styles.inputError]}><Mail color="#000" size={20} /><View style={styles.separator} /><TextInput style={styles.input} placeholder="seu@empresa.com" value={email} onChangeText={setEmail} autoCapitalize="none" placeholderTextColor="#94A3B8" /></View>
                    
                    <Text style={styles.label}>Empresa</Text>
                    <View style={styles.inputGroup}><Building color="#000" size={20} /><View style={styles.separator} /><TextInput style={styles.input} placeholder="Nome da empresa" value={company} onChangeText={setCompany} placeholderTextColor="#94A3B8" /></View>
                    
                    <TouchableOpacity disabled={!isStep1Complete} onPress={() => setCadStep(2)}>
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
                      <TextInput style={styles.input} placeholder="Mínimo 8 caracteres" secureTextEntry={secureText} value={password} onChangeText={setPassword} placeholderTextColor="#94A3B8" />
                      <TouchableOpacity onPress={() => setSecureText(!secureText)}>{secureText ? <EyeOff color="#64748B" size={20} /> : <Eye color="#64748B" size={20} />}</TouchableOpacity>
                    </View>
                    <View style={styles.strengthContainer}>{[1, 2, 3, 4].map((i) => (<View key={i} style={[styles.strengthBar, password.length >= i * 2 && { backgroundColor: '#0097B2' }]} />))}</View>
                    <Text style={styles.helperText}>Use letras maiúsculas, minúsculas, números e símbolos</Text>
                    
                    <Text style={styles.label}>Confirma Senha</Text>
                    <View style={styles.inputGroup}>
                      <Lock color="#000" size={20} /><View style={styles.separator} />
                      <TextInput style={styles.input} placeholder="Digite novamente" secureTextEntry={secureTextConfirm} value={confirmPassword} onChangeText={setConfirmPassword} placeholderTextColor="#94A3B8" />
                      <TouchableOpacity onPress={() => setSecureTextConfirm(!secureTextConfirm)}>{secureTextConfirm ? <EyeOff color="#64748B" size={20} /> : <Eye color="#64748B" size={20} />}</TouchableOpacity>
                    </View>
                    
                    <View style={styles.termsRow}>
                      <TouchableOpacity style={styles.checkboxSmall} onPress={() => setAgreeTerms(!agreeTerms)}>{agreeTerms && <View style={styles.checkboxCheckedSmall} />}</TouchableOpacity>
                      <Text style={styles.termsText}>Concordo com os <Text style={styles.linkBlue}>Termos de Uso</Text> e <Text style={styles.linkBlue}>Política de Privacidade</Text></Text>
                    </View>
                    
                    <View style={styles.dualButtons}>
                      <TouchableOpacity style={styles.btnBack} onPress={() => setCadStep(1)}><Text style={styles.btnBackText}>Voltar</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.btnFinish} disabled={!agreeTerms || password !== confirmPassword || password.length < 8} onPress={() => console.log("Cadastro Concluído")}>
                        <LinearGradient colors={['#0097B2', '#2B58E2']} style={styles.buttonGradient}><Text style={styles.buttonText}>Criar conta</Text><ArrowRight color="white" size={18} /></LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* --- ABA RECUPERAR --- */}
            {tab === 'Recuperar' && (
              <View>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputGroup, email.length > 0 && !isEmailValid(email) && styles.inputError]}>
                  <Mail color="#000" size={20} />
                  <View style={styles.separator} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="seu@email.com" 
                    value={email} 
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                
                <TouchableOpacity disabled={!isEmailValid(email)} style={{ marginTop: 30 }}>
                  <LinearGradient colors={['#0097B2', '#2B58E2']} start={{x:0, y:0}} end={{x:1, y:0}} style={[styles.mainButton, !isEmailValid(email) && {opacity: 0.5}]}>
                    <Text style={styles.buttonText}>Enviar link de recuperação</Text>
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
  header: { alignItems: 'center', marginBottom: 25 },
  logoContainer: { width: 90, height: 90, marginBottom: 10 },
  logoEstilo: { width: '100%', height: '100%', borderRadius: 12 },
  appName: { fontSize: 26, fontWeight: '800', color: '#000' },
  navBar: { flexDirection: 'row', width: '100%', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 6, marginBottom: 25 },
  navItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  navItemActive: { backgroundColor: '#FFF', elevation: 3 },
  navText: { color: '#64748B', fontWeight: '600' },
  navTextActive: { color: '#1E293B' },
  welcomeSection: { width: '100%', alignItems: 'center', marginBottom: 25 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
  subtitle: { color: '#64748B', textAlign: 'center', marginTop: 8, paddingHorizontal: 10, lineHeight: 20 },
  form: { width: '100%' },
  label: { color: '#1E293B', fontWeight: '600', marginBottom: 8, marginTop: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    height: 56 
  },
  separator: { width: 5 },
  input: { flex: 1, height: '100%', color: '#1E293B', fontSize: 15, paddingHorizontal:10  },
  inputError: { borderColor: '#ef4444' },
  forgotText: { color: '#0097B2', fontSize: 13, marginTop: 18 },
  mainButton: { flexDirection: 'row', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 25 },
  buttonGradient: { flexDirection: 'row', width: '100%', height: '100%', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginRight: 10 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { color: '#94A3B8', fontSize: 12, marginHorizontal: 12 },
  googleButton: { width: '100%', height: 56, borderWidth: 1.5, borderColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  googleIcon: { width: 22, height: 22, marginRight: 12 },
  googleButtonText: { color: '#000', fontWeight: '600' },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  stepCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  stepActive: { backgroundColor: '#0097B2' },
  stepText: { color: 'white', fontWeight: 'bold' },
  stepLine: { width: 40, height: 3, backgroundColor: '#E2E8F0', marginHorizontal: 10 },
  stepLineActive: { backgroundColor: '#0097B2' },
  strengthContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  strengthBar: { height: 4, flex: 1, backgroundColor: '#E2E8F0', borderRadius: 2, marginHorizontal: 2 },
  helperText: { fontSize: 11, color: '#94A3B8', marginTop: 8, textAlign: 'center' },
  termsRow: { flexDirection: 'row', marginTop: 20, alignItems: 'center' },
  checkboxSmall: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#0097B2', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  checkboxCheckedSmall: { width: 10, height: 10, backgroundColor: '#0097B2' },
  termsText: { fontSize: 12, color: '#64748B', marginLeft: 10, flex: 1 },
  linkBlue: { color: '#0097B2', fontWeight: '600' },
  dualButtons: { flexDirection: 'row', gap: 12, marginTop: 25 },
  btnBack: { flex: 1, height: 56, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnBackText: { fontWeight: '600', color: '#64748B' },
  btnFinish: { flex: 1.8 },
  rememberContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: '#0097B2', borderRadius: 5, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { width: 12, height: 12, backgroundColor: '#0097B2', borderRadius: 2 },
  rememberText: { color: '#64748B', fontSize: 14 }
});