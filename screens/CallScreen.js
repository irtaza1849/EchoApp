// screens/CallScreen.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Vibration,
} from 'react-native';
import { Audio } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addCallLog } from './RecentsScreen';
import WebRTCClient from './WebRTCClient';
import { RTCView, mediaDevices } from 'react-native-webrtc';

export default function CallScreen({ route, navigation }) {
  const { number, timestamp, name } = route.params || {};
  const [displayName, setDisplayName] = useState(name || null);
  const [callState, setCallState] = useState('ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [duration, setDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState(null);
  const ringtoneRef = useRef(null);
  const signalSocketRef = useRef(null);
  const webrtcRef = useRef(null);
  const mountedRef = useRef(true);
  const timerRef = useRef(null);
  const localStreamRef = useRef(null);

  useKeepAwake();

  const safeGoBack = useCallback(() => {
    if (mountedRef.current && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  useEffect(() => {
    mountedRef.current = true;
    const playRingtone = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/ringtone.mp3'),
          { shouldPlay: true, isLooping: true }
        );
        ringtoneRef.current = sound;
      } catch (error) {
        Vibration.vibrate([500, 1000, 500, 1000], true);
      }
    };
    playRingtone();

    if (!name) requestOmniContactLookup();

    return () => {
      mountedRef.current = false;
      if (ringtoneRef.current) {
        ringtoneRef.current.stopAsync().catch(() => {});
        ringtoneRef.current.unloadAsync().catch(() => {});
      }
      Vibration.cancel();
      if (signalSocketRef.current) signalSocketRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (webrtcRef.current) webrtcRef.current.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const requestOmniContactLookup = async () => {
    try {
      const ip = await AsyncStorage.getItem('omniIp');
      const port = await AsyncStorage.getItem('omniPort');
      if (!ip || !port) return;
      const ws = new WebSocket(`ws://${ip}:${port}`);
      ws.onopen = () => ws.send(`lookup_contact:${number}`);
      ws.onmessage = (e) => {
        if (e.data.startsWith('contact_info:')) {
          const parts = e.data.split(':');
          if (parts.length >= 3) {
            const respName = parts.slice(2).join(':');
            if (respName && respName !== 'Unknown') setDisplayName(respName);
          }
          ws.close();
        }
      };
    } catch (e) {}
  };

  const sendCommand = async (command) => {
    try {
      const ip = await AsyncStorage.getItem('omniIp');
      const port = await AsyncStorage.getItem('omniPort');
      if (!ip || !port) return;
      const ws = new WebSocket(`ws://${ip}:${port}`);
      ws.onopen = () => {
        ws.send(command);
        ws.close();
      };
    } catch (e) {}
  };

  const startWebRTC = async () => {
    try {
      const ip = await AsyncStorage.getItem('omniIp');
      const port = await AsyncStorage.getItem('omniPort');
      if (!ip || !port) return;

      // Open signalling WebSocket
      const ws = new WebSocket(`ws://${ip}:${port}`);
      signalSocketRef.current = ws;

      const webrtc = new WebRTCClient();
      webrtcRef.current = webrtc;
      await webrtc.createPeerConnection();

      // Get local audio stream
      const localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = localStream;
      localStream.getTracks().forEach(track => webrtc.pc.addTrack(track, localStream));

      webrtc.onRemoteStream = (stream) => {
        setRemoteStream(stream);
      };

      webrtc.onSignal = (msg) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      };

      ws.onmessage = (e) => {
        webrtc.handleSignal(e.data);
      };

      ws.onopen = () => {
        // Create offer and start WebRTC negotiation
        webrtc.createOffer();
        setCallState('active');
        timerRef.current = setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);
      };

      ws.onerror = () => {
        setCallState('ended');
        setTimeout(safeGoBack, 1000);
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          setCallState('ended');
          setTimeout(safeGoBack, 1000);
        }
      };
    } catch (err) {
      setCallState('ended');
      setTimeout(safeGoBack, 1000);
    }
  };

  const handleAnswer = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.stopAsync().catch(() => {});
      ringtoneRef.current.unloadAsync().catch(() => {});
    }
    Vibration.cancel();
    sendCommand('answer_call');
    startWebRTC();
    addCallLog(number, 'incoming');
  };

  const handleReject = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.stopAsync().catch(() => {});
      ringtoneRef.current.unloadAsync().catch(() => {});
    }
    Vibration.cancel();
    sendCommand('reject_call');
    addCallLog(number, 'missed');
    safeGoBack();
  };

  const handleEndCall = () => {
    if (signalSocketRef.current) signalSocketRef.current.close();
    if (webrtcRef.current) webrtcRef.current.close();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    sendCommand('reject_call');
    safeGoBack();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted; // toggle
      });
    }
  };

  const toggleSpeaker = () => {
    setIsSpeaker(!isSpeaker);
    // On iOS, speaker is controlled by Audio category; on Android, we can't do much in managed workflow.
    // Placeholder.
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {callState === 'ringing' && (
        <>
          <Text style={styles.callerTitle}>Incoming Call</Text>
          <Text style={styles.number}>{displayName || number || 'Unknown'}</Text>
          {displayName && <Text style={styles.numberLabel}>{number}</Text>}
          <Text style={styles.time}>{new Date(timestamp).toLocaleTimeString()}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.rejectButton]} onPress={handleReject}>
              <Text style={styles.buttonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.answerButton]} onPress={handleAnswer}>
              <Text style={styles.buttonText}>Answer</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {callState === 'active' && (
        <>
          <Text style={styles.callerTitle}>Active Call</Text>
          <Text style={styles.number}>{displayName || number || 'Unknown'}</Text>
          <Text style={styles.duration}>{formatDuration(duration)}</Text>
          {remoteStream && (
            <RTCView streamURL={remoteStream.toURL()} style={styles.remoteAudio} />
          )}
          <View style={styles.controlRow}>
            <TouchableOpacity style={[styles.controlButton, isMuted && styles.controlActive]} onPress={toggleMute}>
              <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
              <Text style={styles.controlLabel}>Mute</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, isSpeaker && styles.controlActive]} onPress={toggleSpeaker}>
              <Text style={styles.controlIcon}>{isSpeaker ? '🔊' : '🔈'}</Text>
              <Text style={styles.controlLabel}>Speaker</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.button, styles.endCallButton]} onPress={handleEndCall}>
            <Text style={styles.buttonText}>End Call</Text>
          </TouchableOpacity>
        </>
      )}

      {callState === 'ended' && (
        <>
          <Text style={styles.callerTitle}>Call Ended</Text>
          <Text style={styles.number}>{displayName || number || 'Unknown'}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', padding: 20 },
  callerTitle: { color: '#fff', fontSize: 24, marginBottom: 20 },
  number: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginBottom: 10 },
  numberLabel: { color: '#aaa', fontSize: 16, marginBottom: 20 },
  time: { color: '#aaa', fontSize: 18, marginBottom: 40 },
  duration: { color: '#aaa', fontSize: 24, marginBottom: 30 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', width: '60%' },
  controlRow: { flexDirection: 'row', justifyContent: 'space-around', width: '80%', marginBottom: 30 },
  controlButton: { backgroundColor: '#333', paddingVertical: 20, paddingHorizontal: 20, borderRadius: 50, alignItems: 'center', justifyContent: 'center', width: 80, height: 80 },
  controlActive: { backgroundColor: '#007AFF' },
  controlIcon: { fontSize: 28 },
  controlLabel: { color: '#fff', fontSize: 12, marginTop: 4 },
  button: { paddingVertical: 20, paddingHorizontal: 30, borderRadius: 50, marginTop: 20 },
  rejectButton: { backgroundColor: 'red' },
  answerButton: { backgroundColor: 'green' },
  endCallButton: { backgroundColor: 'red' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  remoteAudio: { width: 0, height: 0 }, // hidden, audio only
});