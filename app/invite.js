import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function InviteScreen() {
  const { role, listId } = useLocalSearchParams();
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);

  const validRole = role && ['writer', 'shopper', 'viewer'].includes(role);

  const handleAccept = async () => {
    setAccepting(true);
    await AsyncStorage.setItem(
      'guestSession',
      JSON.stringify({
        guestId: `guest_${Date.now()}`,
        role,
        listId,
        acceptedAt: new Date().toISOString(),
      })
    );
    try {
      const rawStatus = await AsyncStorage.getItem('listfygo_invite_status');
      const statusMap = rawStatus ? JSON.parse(rawStatus) : {};
      if (!statusMap[listId]) statusMap[listId] = {};
      statusMap[listId][role] = 'Connected';
      await AsyncStorage.setItem('listfygo_invite_status', JSON.stringify(statusMap));
    } catch {}
    router.replace('/');
  };

  const handleCancel = () => {
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ListfyGo Invite</Text>

      {validRole ? (
        <>
          <Text style={styles.body}>
            You have been invited as{' '}
            <Text style={styles.role}>{role}</Text>.
          </Text>

          {listId ? (
            <Text style={styles.hint}>List ID: {listId}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, styles.btnAccept]}
            onPress={handleAccept}
            disabled={accepting}
          >
            <Text style={styles.btnText}>
              {accepting ? 'Opening...' : 'Accept Invite'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={handleCancel}>
            <Text style={[styles.btnText, { color: '#94a3b8' }]}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.body}>This invite link is invalid or has expired.</Text>
          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={handleCancel}>
            <Text style={[styles.btnText, { color: '#94a3b8' }]}>Go to app</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071120',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  body: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },
  role: {
    color: '#60a5fa',
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  hint: {
    color: '#334155',
    fontSize: 11,
    marginBottom: 28,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnAccept: {
    backgroundColor: '#0A63FF',
  },
  btnCancel: {
    backgroundColor: '#0f1f38',
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
