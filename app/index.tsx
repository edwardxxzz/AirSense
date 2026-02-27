import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, ArrowRight } from 'lucide-react-native'; // Ícones modernos
const LogoImg = require('../assets/images/logo.png');

export default function LoginScreen() {
  const [tab, setTab] = useState('Entrar'); // Estado para controlar a barra de navegação

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
      {/* LOGO E TITULO */}
<View style={styles.header}>
  <View style={styles.logoContainer}>
    <Image 
      source={LogoImg} 
      style={styles.logoEstilo} 
      resizeMode="contain" // Isso impede que a imagem fique esticada ou cortada
    />
  </View>
  <Text style={styles.appName}>AirSense</Text>
</View>

        {/* BARRA DE NAVEGAÇÃO (TAB BAR) */}
        <View style={styles.navBar}>
          {['Entrar', 'Cadastrar', 'Recuperar'].map((item) => (
            <Pressable 
              key={item} 
              onPress={() => setTab(item)}
              style={[styles.navItem, tab === item && styles.navItemActive]}
            >
              <Text style={[styles.navText, tab === item && styles.navTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        {/* TEXTOS DE BOAS-VINDAS */}
        <View style={styles.welcomeSection}>
          <Text style={styles.title}>Bem-vindo de volta</Text>
          <Text style={styles.subtitle}>Entre na sua conta para continuar</Text>
        </View>

        {/* FORMULÁRIO */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputGroup}>
            <Mail color="#666" size={20} style={styles.icon} />
            <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor="#999" />
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.label}>Senha</Text>
            <TouchableOpacity><Text style={styles.forgotText}>Esqueceu a senha?</Text></TouchableOpacity>
          </View>
          <View style={styles.inputGroup}>
            <Lock color="#666" size={20} style={styles.icon} />
            <TextInput style={styles.input} placeholder="••••••" secureTextEntry placeholderTextColor="#999" />
          </View>

          {/* BOTÃO ENTRAR COM GRADIENTE */}
          <TouchableOpacity activeOpacity={0.8}>
            <LinearGradient colors={['#0097B2', '#2B58E2']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.button}>
              <Text style={styles.buttonText}>Entrar</Text>
              <ArrowRight color="white" size={20} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
           <View style={styles.divider} /><Text style={styles.dividerText}> ou continue com </Text><View style={styles.divider} />
        </View>

        {/* BOTÃO GOOGLE */}
        <TouchableOpacity style={styles.googleButton}>
           <Text style={styles.googleButtonText}>G  Entrar com o Google</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 25, alignItems: 'center' },
  logoIcon: { fontSize: 30 },
  
  navBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 5, marginBottom: 40 },
  navItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  navItemActive: { backgroundColor: '#FFFFFF', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  navText: { color: '#64748B', fontWeight: '500' },
  navTextActive: { color: '#1E293B' },

  welcomeSection: { width: '100%', alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
  subtitle: { color: '#64748B', marginTop: 5 },

  form: { width: '100%' },
  label: { color: '#1E293B', fontWeight: '600', marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  forgotText: { color: '#0097B2', fontSize: 13 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 15 },
  icon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: '#1E293B' },

  button: { flexDirection: 'row', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginRight: 10 },

  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { color: '#94A3B8', fontSize: 12 },

  googleButton: { width: '100%', height: 55, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  googleButtonText: { color: '#1E293B', fontWeight: '600' },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20, // Espaço extra no topo, se necessário
  },
  logoContainer: {
    width: 70,                  // Tamanho total do quadrado
    height: 70,
    backgroundColor: '#0097B2', // O azul do Figma
    borderRadius: 16,           // Cantos arredondados do Figma
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    // Adicione padding para criar o respiro interno para o ícone branco
    padding: 15,                
    
    // Sombra leve para dar profundidade (opcional, estilo iOS/Android)
    elevation: 4, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoEstilo: {
    // Agora que o container tem padding, a imagem pode ocupar 100% 
    // do espaço interno restante sem tocar nas bordas.
    width: '100%', 
    height: '100%',
  },
  appName: {
    fontSize: 26,            // Tamanho do Figma
    fontWeight: '800',       // Peso extra bold do Figma
    color: '#000000',        // Preto puro
    letterSpacing: -0.5,     // Aproxima um pouco as letras
  },
});