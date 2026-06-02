import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function InviteScreen() {
  const { role, listId } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    async function handleInvite() {
      if (role && listId) {
        await AsyncStorage.setItem(
          'pendingInvite',
          JSON.stringify({ role, listId, receivedAt: new Date().toISOString() })
        );
      }
      router.replace('/');
    }
    handleInvite();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Opening invite...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071120',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
});
