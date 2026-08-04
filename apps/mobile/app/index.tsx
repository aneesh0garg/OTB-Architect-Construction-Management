import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View>
        <Text style={styles.brand}>ORBITA</Text>
        <Text style={styles.title}>Field work, connected.</Text>
        <Text style={styles.body}>
          The native shell is ready for offline site capture and role-aware project work.
        </Text>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f7f9f7' },
  brand: { fontSize: 13, fontWeight: '700', letterSpacing: 2, color: '#256b4b' },
  title: { marginTop: 12, fontSize: 34, fontWeight: '700', color: '#17221e' },
  body: { marginTop: 12, fontSize: 16, lineHeight: 24, color: '#526158' },
});
