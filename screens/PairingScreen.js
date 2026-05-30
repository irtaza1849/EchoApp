// screens/PairingScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set } from 'firebase/database';
import { db, auth } from '../firebase';

export default function PairingScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [omniIp, setOmniIp] = useState('');
  const [omniPort, setOmniPort] = useState(8080);
  const [connecting, setConnecting] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('8080');

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission]);

  const connectToOmni = (code, ip, port) => {
    setConnecting(true);
    const wsUrl = `ws://${ip}:${port}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = async () => {
      let echoDeviceId = await AsyncStorage.getItem('echoDeviceId');
      if (!echoDeviceId) {
        echoDeviceId = 'Echo-' + Date.now().toString(36);
        await AsyncStorage.setItem('echoDeviceId', echoDeviceId);
      }

      const confirmMsg = `pair_confirm:${code}:${echoDeviceId}`;
      socket.send(confirmMsg);

      const user = auth.currentUser;
      if (user) {
        await set(ref(db, `users/${user.uid}/pairedEcho`), echoDeviceId);
        await AsyncStorage.setItem('omniIp', ip);
        await AsyncStorage.setItem('omniPort', port.toString());
      }

      setConnecting(false);
      socket.close();
      Alert.alert('Paired!', 'Echo is now connected to Omni.', [
        { text: 'OK', onPress: () => navigation.replace('Main') }
      ]);
    };

    socket.onerror = () => {
      setConnecting(false);
      // Keep the input visible so user can try again
      Alert.alert('Connection failed', `Could not connect to ${ip}:${port}. Please check the IP and try again.`);
    };

    socket.ontimeout = () => {
      setConnecting(false);
      Alert.alert('Timeout', 'Connection timed out.');
    };
  };

  // QR scanned handler
  const handleBarcodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const qrData = JSON.parse(data);
      if (qrData.code && qrData.ip) {
        const code = qrData.code.toString().trim();
        const ip = qrData.ip.trim();
        const port = qrData.port || 8080;
        if (code.length === 6 && /^\d{6}$/.test(code)) {
          setPairingCode(code);
          setOmniIp(ip);
          setOmniPort(port);
          connectToOmni(code, ip, port);
        } else {
          Alert.alert('Invalid', 'QR code content invalid.');
          setScanned(false);
        }
      } else {
        // Maybe plain code (old format)
        const code = data.trim();
        if (code.length === 6 && /^\d{6}$/.test(code)) {
          setPairingCode(code);
          // Need IP – show manual input with the code pre‑filled
          setManualCode(code);
          setShowManualEntry(true);
        } else {
          Alert.alert('Invalid QR', 'Cannot read pairing info.');
          setScanned(false);
        }
      }
    } catch (e) {
      const code = data.trim();
      if (code.length === 6 && /^\d{6}$/.test(code)) {
        setPairingCode(code);
        setManualCode(code);
        setShowManualEntry(true);
      } else {
        Alert.alert('Invalid QR', 'QR format not recognised.');
        setScanned(false);
      }
    }
  };

  const handleManualConnect = () => {
    const code = manualCode.trim();
    const ip = manualIp.trim();
    const port = parseInt(manualPort) || 8080;
    if (!code || !ip) {
      Alert.alert('Required', 'Please enter both pairing code and IP address.');
      return;
    }
    setPairingCode(code);
    setOmniIp(ip);
    setOmniPort(port);
    connectToOmni(code, ip, port);
  };

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Manual entry UI
  if (showManualEntry) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>Enter Omni Details</Text>
        <TextInput
          style={styles.input}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="6-digit Pairing Code"
          keyboardType="number-pad"
          maxLength={6}
        />
        <TextInput
          style={styles.input}
          value={manualIp}
          onChangeText={setManualIp}
          placeholder="Omni IP Address"
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          value={manualPort}
          onChangeText={setManualPort}
          placeholder="Port (default 8080)"
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.button} onPress={handleManualConnect}>
          <Text style={styles.buttonText}>Connect</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => setShowManualEntry(false)}>
          <Text style={styles.buttonText}>Scan QR Instead</Text>
        </TouchableOpacity>
        {connecting && <ActivityIndicator size="large" color="#1C1C1E" />}
      </KeyboardAvoidingView>
    );
  }

  // QR scanner UI
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan Omni QR Code</Text>

      {!scanned ? (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
      ) : (
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Pairing Code:</Text>
          <Text style={styles.code}>{pairingCode}</Text>
        </View>
      )}

      {connecting && <ActivityIndicator size="large" color="#1C1C1E" />}

      {/* Show IP input and Connect button if connection failed (scanned but not connected) */}
      {scanned && !connecting && (
        <View style={styles.ipContainer}>
          <Text style={styles.ipLabel}>Omni IP Address:</Text>
          <TextInput
            style={styles.input}
            value={omniIp}
            onChangeText={setOmniIp}
            placeholder="Enter Omni IP"
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            value={omniPort.toString()}
            onChangeText={(text) => setOmniPort(parseInt(text) || 8080)}
            placeholder="Port"
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.button} onPress={() => connectToOmni(pairingCode, omniIp, omniPort)}>
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#555' }]} onPress={() => {
            setScanned(false);
            setOmniIp('');
            setPairingCode('');
          }}>
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* "Enter Code Manually" button always visible when scanner is shown */}
      {!scanned && !connecting && (
        <TouchableOpacity style={styles.button} onPress={() => setShowManualEntry(true)}>
          <Text style={styles.buttonText}>Enter Code Manually</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { color: '#fff', fontSize: 20, marginBottom: 20 },
  camera: { width: 300, height: 300, marginBottom: 20 },
  codeContainer: { alignItems: 'center', marginBottom: 20 },
  codeLabel: { color: '#fff', fontSize: 18 },
  code: { color: '#0f0', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  ipContainer: { alignItems: 'center', width: '100%' },
  ipLabel: { color: '#fff', fontSize: 18, marginBottom: 8 },
  input: {
    backgroundColor: '#fff', width: 200, padding: 12, borderRadius: 8, textAlign: 'center',
    fontSize: 16, marginBottom: 12
  },
  button: {
    backgroundColor: '#1C1C1E', paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 8, marginTop: 10, width: 250, alignItems: 'center'
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  permissionText: { color: '#fff', marginBottom: 20, fontSize: 18 },
});