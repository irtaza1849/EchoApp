// screens/MessagesScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadConversations } from './MessageStore';

export default function MessagesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const convs = await loadConversations();
        setConversations(convs);
      })();
    }, [])
  );

  const openConversation = (number) => {
    navigation.navigate('Conversation', { number });
  };

  const renderItem = ({ item }) => {
    const lastMsg = item.messages[item.messages.length - 1];
    return (
      <TouchableOpacity style={styles.row} onPress={() => openConversation(item.number)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.number[0] || '?'}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.number}>{item.number}</Text>
          <Text style={styles.preview} numberOfLines={1}>
            {lastMsg ? lastMsg.text : 'No messages'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.composeButton}
          onPress={() => navigation.navigate('Compose')}
        >
          <Text style={styles.composeIcon}>✏️</Text>
        </TouchableOpacity>
      </View>
      {conversations.length === 0 ? (
        <Text style={styles.empty}>No conversations</Text>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.number}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    paddingTop: 60, paddingBottom: 10, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#000' },
  composeButton: { padding: 8 },
  composeIcon: { fontSize: 24 },
  empty: { textAlign: 'center', marginTop: 40, color: 'gray' },
  row: {
    flexDirection: 'row', padding: 16,
    borderBottomWidth: 0.5, borderColor: '#C6C6C6', alignItems: 'center',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18 },
  info: { flex: 1 },
  number: { fontSize: 16, fontWeight: '500' },
  preview: { fontSize: 14, color: 'gray', marginTop: 2 },
});