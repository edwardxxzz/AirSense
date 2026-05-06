import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="home" />
      <Stack.Screen name="ambientes" />
      <Stack.Screen name="ambiente" />
      <Stack.Screen name="perifericos" />
      <Stack.Screen name="notificacao" />
      <Stack.Screen name="relatorios" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
