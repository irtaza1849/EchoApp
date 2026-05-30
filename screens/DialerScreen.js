import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, FlatList, ActivityIndicator
} from 'react-native';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DialerScreen({ navigation }) {
  const [number, setNumber] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    })();
  }, []);

  const makeCall = async (numberToCall) => {
    const cleanNumber = numberToCall.replace(/\D/g, '');
    if (cleanNumber.length === 0) {
      Alert.alert('Enter a number');
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
        ws.send(`make_call:${cleanNumber}`);
        ws.close();
        Alert.alert('Dialling', `Calling ${cleanNumber} via Omni`);
        setNumber('');
        setShowContacts(false);
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
      <Text style={styles.title}>Make a Call</Text>
      <TextInput
        style={styles.input}
        value={number}
        onChangeText={setNumber}
        placeholder="Enter number"
        keyboardType="phone-pad"
      />
      <View style={styles.row}>
        <TouchableOpacity style={styles.halfButton} onPress={() => makeCall(number)}>
          <Text style={styles.buttonText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.halfButton} onPress={() => setShowContacts(!showContacts)}>
          <Text style={styles.buttonText}>Contacts</Text>
        </TouchableOpacity>
      </View>

      {showContacts && (
        loading ? <ActivityIndicator size="large" color="#1C1C1E" /> : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.contactItem} onPress={() => selectContact(item)}>
                <Text style={styles.contactName}>{item.name}</Text>
                {item.phoneNumbers && <Text style={styles.contactNumber}>{item.phoneNumbers[0].number}</Text>}
              </TouchableOpacity>
            )}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#ccc', padding: 14, borderRadius: 8,
    fontSize: 24, textAlign: 'center', marginBottom: 20
  },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  halfButton: {
    backgroundColor: '#1C1C1E', padding: 14, borderRadius: 8,
    width: '40%', alignItems: 'center'
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  contactItem: {
    paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee'
  },
  contactName: { fontSize: 16, fontWeight: '500' },
  contactNumber: { fontSize: 14, color: 'gray' },
});