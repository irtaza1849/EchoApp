// screens/ConversationScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadConversations, addMessage } from './MessageStore';

export default function ConversationScreen({ route, navigation }) {
  const { number } = route.params;
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    (async () => {
      const conversations = await loadConversations();
      const conv = conversations.find(c => c.number === number);
      if (conv) setMessages(conv.messages);
    })();
  }, [number]);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    const cleanNumber = number.replace(/\D/g, '');
    try {
      const ip = await AsyncStorage.getItem('omniIp');
      const port = await AsyncStorage.getItem('omniPort');
      if (!ip || !port) {
        Alert.alert('Not connected', 'Pair with Omni first.');
        return;
      }
      const ws = new WebSocket(`ws://${ip}:${port}`);
      ws.onopen = () => {
        ws.send(`send_sms:${cleanNumber}:${replyText.trim()}`);
        ws.close();
        // Save outgoing message locally
        addMessage(cleanNumber, replyText.trim(), 'outgoing');
        setMessages(prev => [...prev, { text: replyText.trim(), type: 'outgoing', timestamp: Date.now() }]);
        setReplyText('');
      };
      ws.onerror = () => Alert.alert('Connection failed');
    } catch (e) {}
  };

  const renderMessage = ({ item }) => (
    <View style={[styles.bubble, item.type === 'outgoing' ? styles.outgoing : styles.incoming]}>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Conversation with {number}</Text>
      <FlatList
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderMessage}
        style={styles.messageList}
      />
      <View style={styles.replyBar}>
        <TextInput
          style={styles.replyInput}
          placeholder="Type a message"
          value={replyText}
          onChangeText={setReplyText}
        />
        <TouchableOpacity onPress={sendReply} style={styles.sendBtn}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { paddingTop: 60, paddingBottom: 10, textAlign: 'center', fontSize: 20, fontWeight: 'bold' },
  messageList: { flex: 1, paddingHorizontal: 10 },
  bubble: { padding: 10, borderRadius: 12, marginVertical: 4, maxWidth: '80%' },
  incoming: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  outgoing: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  messageText: { color: '#000' },
  replyBar: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center' },
  replyInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10 },
  sendBtn: { marginLeft: 10, padding: 10 },
  sendText: { color: '#007AFF', fontWeight: '600' },
});