// screens/RecentsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const STORAGE_KEY = 'recentCalls';
const FILTERS = ['All', 'Missed', 'Incoming', 'Outgoing'];

export default function RecentsScreen() {
  const [recentCalls, setRecentCalls] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');

  // Reload calls every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      loadCalls();
    }, [])
  );

  const loadCalls = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const calls = JSON.parse(stored);
        calls.sort((a, b) => b.timestamp - a.timestamp);
        setRecentCalls(calls);
      } else {
        setRecentCalls([]);
      }
    } catch (e) {
      console.error('Error loading recents', e);
    }
  };

  const redial = async (phoneNumber) => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    try {
      const ip = await AsyncStorage.getItem('omniIp');
      const port = await AsyncStorage.getItem('omniPort');
      if (!ip || !port) {
        Alert.alert('Not connected', 'Pair with Omni first.');
        return;
      }
      const ws = new WebSocket(`ws://${ip}:${port}`);
      ws.onopen = () => {
        ws.send(`make_call:${cleanNumber}`);
        ws.close();
        addCallLog(phoneNumber, 'outgoing');
        loadCalls();
      };
      ws.onerror = () => Alert.alert('Connection failed');
    } catch (e) {}
  };

  const filteredCalls = activeFilter === 'All'
    ? recentCalls
    : recentCalls.filter(call => call.type === activeFilter.toLowerCase());

  const renderCall = ({ item }) => {
    let icon = '📥';
    let callStyle = styles.callIncoming;
    if (item.type === 'outgoing') {
      icon = '📤';
      callStyle = styles.callOutgoing;
    } else if (item.type === 'missed') {
      icon = '🔴';
      callStyle = styles.callMissed;
    }

    return (
      <TouchableOpacity style={styles.row} onPress={() => redial(item.number)}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.info}>
          <Text style={[styles.number, callStyle]}>{item.number}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recents</Text>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {FILTERS.map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              activeFilter === filter && styles.filterActive
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[
              styles.filterText,
              activeFilter === filter && styles.filterTextActive
            ]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Call list */}
      {filteredCalls.length === 0 ? (
        <Text style={styles.empty}>No {activeFilter === 'All' ? 'recent' : activeFilter.toLowerCase()} calls</Text>
      ) : (
        <FlatList
          data={filteredCalls}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderCall}
        />
      )}
    </View>
  );
}

// Helper to add a call log entry
export async function addCallLog(number, type = 'incoming') {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const calls = stored ? JSON.parse(stored) : [];
    const now = new Date();
    calls.push({
      number,
      type, // 'incoming', 'outgoing', 'missed'
      timestamp: now.getTime(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString(),
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
  } catch (e) {
    console.error('Error adding call log', e);
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    paddingTop: 60, paddingBottom: 10,
    backgroundColor: '#F2F2F7', alignItems: 'center',
  },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#000' },
  filterBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: '#F2F2F7', borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C6',
  },
  filterButton: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, backgroundColor: '#E5E5EA',
  },
  filterActive: { backgroundColor: '#007AFF' },
  filterText: { fontSize: 14, color: '#000' },
  filterTextActive: { color: '#fff' },
  empty: { textAlign: 'center', marginTop: 40, color: 'gray', fontSize: 16 },
  row: {
    flexDirection: 'row', paddingVertical: 16,
    paddingHorizontal: 20, borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C6', alignItems: 'center',
  },
  icon: { fontSize: 20, marginRight: 12 },
  info: { flex: 1 },
  number: { fontSize: 18 },
  callIncoming: { color: '#000' },
  callOutgoing: { color: '#007AFF' },
  callMissed: { color: 'red' },
  time: { fontSize: 14, color: 'gray', marginTop: 4 },
});