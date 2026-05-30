// screens/VoicemailScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, FlatList
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDINGS_KEY = 'voicemails';

export default function VoicemailScreen() {
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(null); // index of currently playing recording
  const recordingRef = useRef(null);
  const playbackRef = useRef(null);

  useEffect(() => {
    loadRecordings();
    return () => {
      if (playbackRef.current) playbackRef.current.unloadAsync();
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync();
    };
  }, []);

  const loadRecordings = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECORDINGS_KEY);
      if (stored) setRecordings(JSON.parse(stored));
    } catch (e) {}
  };

  const saveRecordings = async (newList) => {
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(newList));
    setRecordings(newList);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Allow microphone access to record voicemails.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const timestamp = Date.now();
      const newEntry = {
        uri,
        timestamp,
        name: new Date(timestamp).toLocaleString(),
      };
      const updated = [newEntry, ...recordings];
      await saveRecordings(updated);
      recordingRef.current = null;
    } catch (err) {
      Alert.alert('Error', 'Failed to save recording');
    } finally {
      setIsRecording(false);
    }
  };

  const playRecording = async (uri, index) => {
    try {
      if (playbackRef.current) {
        await playbackRef.current.unloadAsync();
        playbackRef.current = null;
        setIsPlaying(null);
      }
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      playbackRef.current = sound;
      setIsPlaying(index);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(null);
          playbackRef.current = null;
        }
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const deleteRecording = (index) => {
    Alert.alert('Delete', 'Delete this voicemail?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          const updated = recordings.filter((_, i) => i !== index);
          await saveRecordings(updated);
        },
      },
    ]);
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => playRecording(item.uri, index)}
      >
        <Text style={styles.icon}>{isPlaying === index ? '⏸️' : '▶️'}</Text>
      </TouchableOpacity>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
      </View>
      <TouchableOpacity onPress={() => deleteRecording(index)}>
        <Text style={styles.deleteIcon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Voicemail</Text>
      </View>

      {/* Record button */}
      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recordingActive]}
        onPress={isRecording ? stopRecording : startRecording}
      >
        <Text style={styles.recordIcon}>{isRecording ? '⏹️' : '🎙️'}</Text>
        <Text style={styles.recordText}>
          {isRecording ? 'Recording... tap to stop' : 'Record Voicemail'}
        </Text>
      </TouchableOpacity>

      {recordings.length === 0 ? (
        <Text style={styles.empty}>No voicemails</Text>
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.timestamp.toString()}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    paddingTop: 60, paddingBottom: 10,
    backgroundColor: '#F2F2F7', alignItems: 'center',
  },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#000' },
  recordButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#007AFF', margin: 20, padding: 16, borderRadius: 12,
  },
  recordingActive: { backgroundColor: 'red' },
  recordIcon: { fontSize: 24, marginRight: 10 },
  recordText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, color: 'gray', fontSize: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 4,
    padding: 12, borderRadius: 10,
  },
  playButton: { marginRight: 12 },
  icon: { fontSize: 22 },
  info: { flex: 1 },
  name: { fontSize: 16, color: '#000' },
  deleteIcon: { fontSize: 20, marginLeft: 12 },
});