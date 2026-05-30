// screens/SettingsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase';
import { ref, get, set } from 'firebase/database';

export default function SettingsScreen({ navigation }) {
  const [status, setStatus] = useState('Checking...');
  const [hasLastConnection, setHasLastConnection] = useState(false);
  const [autoReconnect, setAutoReconnect] = useState(false);

  useEffect(() => {
    (async () => {
      const ip = await AsyncStorage.getItem('omniIp');
      setHasLastConnection(!!ip);
      const auto = await AsyncStorage.getItem('autoReconnect') === 'true';
      setAutoReconnect(auto);
      checkConnection();
    })();
  }, []);

  const checkConnection = async () => {
    const ip = await AsyncStorage.getItem('omniIp');
    if (!ip) {
      setStatus('Not paired');
      return;
    }
    const ws = new WebSocket(`ws://${ip}:8080`);
    ws.onopen = () => {
      setStatus('Connected to Omni');
      ws.close();
    };
    ws.onerror = () => setStatus('Not reachable');
    ws.ontimeout = () => setStatus('Timeout');
  };

  const handleDisengage = async () => {
    Alert.alert('Disengage', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Disengage',
        onPress: async () => {
          // Send disengage command
          try {
            const ip = await AsyncStorage.getItem('omniIp');
            const port = await AsyncStorage.getItem('omniPort');
            if (ip && port) {
              const ws = new WebSocket(`ws://${ip}:${port}`);
              ws.onopen = () => {
                ws.send('disengage');
                ws.close();
              };
            }
          } catch (e) {}
          await AsyncStorage.multiRemove(['omniIp', 'omniPort', 'echoDeviceId']);
          setHasLastConnection(false);
          setStatus('Disconnected');
          navigation.replace('Pairing');
        },
      },
    ]);
  };

  const handleScanAgain = () => {
    navigation.navigate('Pairing');
  };

  const handleConnectToLastOmni = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const snap = await get(ref(db, `users/${uid}/localIp`));
    const latestIp = snap.val();
    if (latestIp) {
      await AsyncStorage.setItem('omniIp', latestIp);
      await AsyncStorage.setItem('omniPort', '8080');
      setHasLastConnection(true);
      checkConnection();
    } else {
      Alert.alert('Error', 'Could not fetch latest Omni IP. Try scanning again.');
    }
  };

  const handleSignOut = () => {
    auth.signOut();
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={styles.label}>Connection Status</Text>
        <Text style={styles.value}>{status}</Text>
        <TouchableOpacity style={styles.button} onPress={checkConnection}>
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Scan Again */}
      <TouchableOpacity style={styles.row} onPress={handleScanAgain}>
        <Text style={styles.rowText}>Scan QR Code</Text>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {/* Connect to Last Omni (only if available) */}
      {hasLastConnection && (
        <TouchableOpacity style={styles.row} onPress={handleConnectToLastOmni}>
          <Text style={styles.rowText}>Reconnect to Last Omni</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Disengage */}
      {hasLastConnection && (
        <TouchableOpacity style={styles.row} onPress={handleDisengage}>
          <Text style={[styles.rowText, { color: 'red' }]}>Disengage Echo</Text>
        </TouchableOpacity>
      )}

      {/* Auto Reconnect Toggle */}
      <View style={styles.row}>
        <Text style={styles.rowText}>Auto Reconnect</Text>
        <Switch
          value={autoReconnect}
          onValueChange={async (val) => {
            setAutoReconnect(val);
            await AsyncStorage.setItem('autoReconnect', val.toString());
          }}
        />
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.row} onPress={handleSignOut}>
        <Text style={styles.rowText}>Sign Out</Text>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  label: { fontSize: 14, color: 'gray', marginBottom: 4 },
  value: { fontSize: 18, fontWeight: '500', marginBottom: 12 },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontSize: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 1,
  },
  rowText: { fontSize: 16 },
  arrow: { fontSize: 20, color: 'gray' },
});