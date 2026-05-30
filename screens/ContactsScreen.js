// screens/ContactsScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ContactsScreen() {
  const [contacts, setContacts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        });
        const sorted = data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setContacts(sorted);
        setFiltered(sorted);
      }
    })();
  }, []);

  const handleSearch = (text) => {
    setSearch(text);
    if (text.trim() === '') {
      setFiltered(contacts);
    } else {
      const lowerText = text.toLowerCase();
      const filteredList = contacts.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(lowerText)) ||
          (c.phoneNumbers && c.phoneNumbers.some((p) => p.number.includes(text)))
      );
      setFiltered(filteredList);
    }
  };

  const callContact = async (phoneNumber) => {
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
        Alert.alert('Dialling', `Calling ${cleanNumber} via Omni`);
      };
      ws.onerror = () => Alert.alert('Connection failed');
    } catch (e) {}
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => {
        if (item.phoneNumbers && item.phoneNumbers.length > 0) {
          callContact(item.phoneNumbers[0].number);
        }
      }}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.name || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.name}>{item.name || 'No Name'}</Text>
        {item.phoneNumbers && item.phoneNumbers.length > 0 && (
          <Text style={styles.phone}>{item.phoneNumbers[0].number}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
      </View>

      {/* Search bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search"
        value={search}
        onChangeText={handleSearch}
      />

      {/* Contact list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={20}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    paddingTop: 60,
    paddingBottom: 10,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  searchInput: {
    backgroundColor: '#E5E5EA',
    margin: 10,
    padding: 10,
    borderRadius: 10,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C6',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  contactInfo: { flex: 1 },
  name: { fontSize: 16, color: '#000' },
  phone: { fontSize: 14, color: 'gray', marginTop: 2 },
});