// screens/ComposeScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, FlatList,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMessage } from './MessageStore';

export default function ComposeScreen({ navigation }) {
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [contacts, setContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        });
        setContacts(data);
      }
    })();
  }, []);

  const sendSms = async () => {
    const cleanNumber = number.replace(/\D/g, '');
    if (!cleanNumber || !message.trim()) {
      Alert.alert('Required', 'Enter number and message');
      return;
    }
    try {
      const ip = await AsyncStorage.getItem('omniIp');
      const port = await AsyncStorage.getItem('omniPort');
      if (!ip || !port) {
        Alert.alert('Not connected', 'Pair with Omni first.');
        return;
      }
      const ws = new WebSocket(`ws://${ip}:${port}`);
      ws.onopen = () => {
        ws.send(`send_sms:${cleanNumber}:${message.trim()}`);
        ws.close();
        // Save to local store as outgoing
        addMessage(cleanNumber, message.trim(), 'outgoing');
        Alert.alert('Sent', 'Message sent via Omni');
        setNumber('');
        setMessage('');
        navigation.goBack();
      };
      ws.onerror = () => Alert.alert('Connection failed');
    } catch (e) {}
  };

  const selectContact = (item) => {
    if (item.phoneNumbers && item.phoneNumbers.length > 0) {
      setNumber(item.phoneNumbers[0].number);
      setShowContacts(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Message</Text>
      <TextInput
        style={styles.input}
        placeholder="To: phone number"
        value={number}
        onChangeText={setNumber}
        keyboardType="phone-pad"
      />
      <TouchableOpacity onPress={() => setShowContacts(!showContacts)}>
        <Text style={styles.contactsButton}>Select from Contacts</Text>
      </TouchableOpacity>
      {showContacts && (
        <FlatList
          style={styles.contactList}
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => selectContact(item)} style={styles.contactRow}>
              <Text>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      <TextInput
        style={[styles.input, styles.messageInput]}
        placeholder="Message"
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <TouchableOpacity style={styles.sendButton} onPress={sendSms}>
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8,
    fontSize: 16, marginBottom: 12,
  },
  messageInput: { height: 100, textAlignVertical: 'top' },
  contactsButton: { color: '#007AFF', marginBottom: 12 },
  contactList: { maxHeight: 200, marginBottom: 12 },
  contactRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#eee' },
  sendButton: {
    backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center',
  },
  sendButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});