// screens/MainScreen.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity,
  Platform, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase';
import { ref, onChildAdded, push, off, get } from 'firebase/database';
import { getContactNameByNumber } from './ContactUtils';

export default function MainScreen({ navigation }) {
  const [status, setStatus] = useState('Connecting...');
  const [calls, setCalls] = useState([]);
  const [messages, setMessages] = useState([]);
  const [hasLastConnection, setHasLastConnection] = useState(false);
  const [hotspotInfo, setHotspotInfo] = useState(null);
  const [showHotspotBanner, setShowHotspotBanner] = useState(false);

  const socketRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const firebaseListenerRef = useRef(null);
  const processedTimestamps = useRef(new Set());

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    (async () => {
      const ip = await AsyncStorage.getItem('omniIp');
      setHasLastConnection(!!ip);

      const savedSsid = await AsyncStorage.getItem('hotspotSSID');
      const savedPwd = await AsyncStorage.getItem('hotspotPassword');
      if (savedSsid && savedPwd) {
        setHotspotInfo({ ssid: savedSsid, password: savedPwd });
      }

      if (uid) fetchHotspotFromFirebase();
    })();

    connectWebSocket();
    if (uid) startFirebaseListener();

    const interval = setInterval(checkNetworkAndPrompt, 10000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (uid) stopFirebaseListener();
    };
  }, [uid]);

  const fetchHotspotFromFirebase = async () => {
    try {
      const snap = await get(ref(db, `users/${uid}/hotspotInfo`));
      if (snap.exists()) {
        const data = snap.val();
        const ssid = data.ssid;
        const password = data.password;
        if (ssid && password) {
          setHotspotInfo({ ssid, password });
          await AsyncStorage.setItem('hotspotSSID', ssid);
          await AsyncStorage.setItem('hotspotPassword', password);
        }
      }
    } catch (e) {}
  };

  const fetchLatestOmniIp = async () => {
    if (!uid) return null;
    try {
      const snap = await get(ref(db, `users/${uid}/localIp`));
      return snap.val();
    } catch (e) {
      return null;
    }
  };

  const checkNetworkAndPrompt = async () => {
    if (!hotspotInfo) return;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      setShowHotspotBanner(false);
    } else {
      setShowHotspotBanner(true);
    }
  };

  const connectWebSocket = async () => {
    try {
      const ip = await AsyncStorage.getItem('omniIp');
      const port = await AsyncStorage.getItem('omniPort');
      const deviceId = await AsyncStorage.getItem('echoDeviceId');

      if (!ip || !port) {
        setStatus('No saved Omni. Please pair again.');
        return;
      }

      const wsUrl = `ws://${ip}:${port}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setStatus('Connected (local)');
        setShowHotspotBanner(false);
        if (deviceId) ws.send(`identify:${deviceId}`);
      };

      ws.onmessage = async (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'incoming_call' || data.type === 'incoming_sms') {
            if (data.timestamp) processedTimestamps.current.add(data.timestamp);
            if (data.type === 'incoming_call') {
              handleIncomingCall(data.number, data.timestamp);
            } else {
              setMessages(prev => [...prev, data]);
            }
          }
        } catch {
          if (e.data === 'paired') {
            setStatus('Connected (local)');
            setShowHotspotBanner(false);
          } else if (e.data === 'unpaired') {
            ws.close();
            setStatus('Unpaired');
            Alert.alert('Not Paired', 'Omni does not recognise this Echo.', [
              { text: 'OK', onPress: () => navigation.replace('Pairing') }
            ]);
          } else if (e.data === 'disengage') {
            clearConnectionData();
            ws.close();
            setStatus('Disconnected by Omni');
            Alert.alert('Disengaged', 'Omni has disconnected this Echo.');
          }
          // contact_info is handled in CallScreen directly
        }
      };

      ws.onerror = () => setStatus('Local connection error – using internet relay');
      ws.onclose = () => {
        setStatus('Disconnected from local – using internet relay if available');
        AsyncStorage.getItem('omniIp').then(ip => {
          if (ip && !reconnectTimeout.current) {
            reconnectTimeout.current = setTimeout(connectWebSocket, 5000);
          }
        });
      };

      socketRef.current = ws;
    } catch (err) {
      setStatus('Cannot connect locally – using internet relay');
    }
  };

  const startFirebaseListener = () => {
    if (!uid) return;
    const eventsRef = ref(db, `users/${uid}/events`);
    firebaseListenerRef.current = onChildAdded(eventsRef, async (snapshot) => {
      const data = snapshot.val();
      if (data.timestamp && processedTimestamps.current.has(data.timestamp)) return;
      if (data.type === 'incoming_call') {
        handleIncomingCall(data.number, data.timestamp);
      } else if (data.type === 'incoming_sms') {
        setMessages(prev => [...prev, data]);
      }
    });
  };

  const stopFirebaseListener = () => {
    if (!uid) return;
    const eventsRef = ref(db, `users/${uid}/events`);
    off(eventsRef, 'child_added', firebaseListenerRef.current);
  };

  const handleIncomingCall = async (number, timestamp) => {
    const localName = await getContactNameByNumber(number);
    navigation.navigate('Call', { number, timestamp, name: localName || null });
  };

  const sendCommand = async (command) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(command);
    } else {
      if (!uid) return;
      const cmdRef = ref(db, `users/${uid}/commandQueue`);
      await push(cmdRef, { command });
    }
  };

  const handleDisengageFromEcho = async () => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    await sendCommand('disengage');
    if (socketRef.current) socketRef.current.close();
    await clearConnectionData();
    stopFirebaseListener();
    setStatus('Disconnected');
    Alert.alert('Disengaged', 'You have disconnected from Omni.', [{ text: 'OK' }]);
  };

  const clearConnectionData = async () => {
    await AsyncStorage.multiRemove(['omniIp', 'omniPort', 'echoDeviceId', 'hotspotSSID', 'hotspotPassword']);
    setHasLastConnection(false);
    setHotspotInfo(null);
  };

  const handleScanAgain = () => {
    if (socketRef.current) socketRef.current.close();
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    stopFirebaseListener();
    navigation.replace('Pairing');
  };

  const handleConnectToLastOmni = async () => {
    if (socketRef.current) socketRef.current.close();
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    setStatus('Fetching latest Omni IP...');
    const latestIp = await fetchLatestOmniIp();
    if (latestIp) {
      await AsyncStorage.setItem('omniIp', latestIp);
      const port = await AsyncStorage.getItem('omniPort') || '8080';
      await AsyncStorage.setItem('omniPort', port);
      setHasLastConnection(true);
    }
    setStatus('Connecting...');
    connectWebSocket();
  };

  const openWifiSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:root=WIFI');
    } else {
      Linking.sendIntent('android.settings.WIFI_SETTINGS');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Echo</Text>
      <Text style={styles.statusText}>Status: {status}</Text>

      {showHotspotBanner && hotspotInfo && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Connect to Omni Hotspot</Text>
          <Text style={styles.bannerText}>
            SSID: {hotspotInfo.ssid}{'\n'}
            Password: {hotspotInfo.password}
          </Text>
          <TouchableOpacity style={styles.smallButton} onPress={openWifiSettings}>
            <Text style={styles.buttonText}>Open Wi‑Fi Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.logs}>
        <Text style={styles.sectionTitle}>Calls:</Text>
        {calls.length === 0 ? <Text style={styles.empty}>No calls yet</Text> :
          calls.map((call, i) => (
            <Text key={i} style={styles.logItem}>📞 {call.number} at {new Date(call.timestamp).toLocaleTimeString()}</Text>
          ))
        }
        <Text style={styles.sectionTitle}>Messages:</Text>
        {messages.length === 0 ? <Text style={styles.empty}>No messages yet</Text> :
          messages.map((msg, i) => (
            <Text key={i} style={styles.logItem}>💬 {msg.sender}: {msg.message}</Text>
          ))
        }
      </View>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Dialer')}>
        <Text style={styles.buttonText}>Make a Call</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleDisengageFromEcho}>
        <Text style={styles.buttonText}>Disengage from Omni</Text>
      </TouchableOpacity>

      {(status.includes('Disconnect') || status.includes('No saved') || status.includes('Unpaired')) && (
        <View style={{ marginTop: 12 }}>
          <TouchableOpacity style={styles.buttonSecondary} onPress={handleScanAgain}>
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
          {hasLastConnection && (
            <TouchableOpacity style={styles.buttonSecondary} onPress={handleConnectToLastOmni}>
              <Text style={styles.buttonText}>Connect to Last Omni</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  statusText: { fontSize: 18, marginBottom: 20, textAlign: 'center', color: '#1C1C1E' },
  logs: { flex: 1, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  empty: { color: 'gray', marginBottom: 12 },
  logItem: { fontSize: 16, marginBottom: 4 },
  banner: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderColor: '#FFA000',
    borderWidth: 1,
  },
  bannerTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  bannerText: { fontSize: 14, marginBottom: 8 },
  smallButton: {
    backgroundColor: '#1C1C1E',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  button: {
    backgroundColor: '#1C1C1E', padding: 16, borderRadius: 8, alignItems: 'center',
    marginBottom: 10
  },
  buttonSecondary: {
    backgroundColor: '#555', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 10
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});