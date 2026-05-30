// screens/KeypadScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, FlatList
} from 'react-native';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addCallLog } from './RecentsScreen';

const DIAL_BUTTONS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '*', '0', '#',
];

// T9 mapping
const T9_MAP = {
  '2': ['a','b','c'], '3': ['d','e','f'], '4': ['g','h','i'],
  '5': ['j','k','l'], '6': ['m','n','o'], '7': ['p','q','r','s'],
  '8': ['t','u','v'], '9': ['w','x','y','z'],
};

export default function KeypadScreen() {
  const [number, setNumber] = useState('');
  const [contacts, setContacts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

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

  const handlePress = (digit) => {
    setNumber((prev) => prev + digit);
    // T9 search
    if (digit !== '*' && digit !== '#') {
      const t9Letters = T9_MAP[digit] || [];
      const filtered = contacts.filter(c =>
        c.name &&
        c.phoneNumbers &&
        c.phoneNumbers.some(p =>
          p.number.includes(number + digit) ||
          c.name.toLowerCase().split(' ').some(part =>
            part.startsWith(t9Letters.join(''))
          )
        )
      );
      setSuggestions(filtered.slice(0, 5));
    }
  };

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1));
    if (number.length <= 1) setSuggestions([]);
    else {
      // re-filter based on new number
      const filtered = contacts.filter(c =>
        c.name &&
        c.phoneNumbers &&
        c.phoneNumbers.some(p => p.number.includes(number.slice(0, -1)))
      );
      setSuggestions(filtered.slice(0, 5));
    }
  };

  const selectSuggestion = (item) => {
    if (item.phoneNumbers && item.phoneNumbers.length > 0) {
      setNumber(item.phoneNumbers[0].number);
      setSuggestions([]);
    }
  };

  const handleCall = async () => {
    const cleanNumber = number.replace(/\D/g, '');
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
        addCallLog(number, 'outgoing');
        setNumber('');
        setSuggestions([]);
        Alert.alert('Dialling', `Calling ${cleanNumber} via Omni`);
      };
      ws.onerror = () => Alert.alert('Connection failed');
    } catch (e) {}
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Keypad</Text>
      </View>

      {/* Number display */}
      <View style={styles.displayContainer}>
        <TextInput
          style={styles.numberInput}
          value={number}
          editable={false}
          placeholder="Enter number"
          textAlign="center"
        />
        {number.length > 0 && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <Text style={styles.deleteIcon}>⌫</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* T9 Suggestions */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionRow}
                onPress={() => selectSuggestion(item)}
              >
                <Text style={styles.suggestionName}>{item.name}</Text>
                {item.phoneNumbers && (
                  <Text style={styles.suggestionNumber}>
                    {item.phoneNumbers[0].number}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Dialpad */}
      <View style={styles.dialpad}>
        {DIAL_BUTTONS.map((btn, index) => (
          <TouchableOpacity
            key={index}
            style={styles.dialButton}
            onPress={() => handlePress(btn)}
          >
            <Text style={styles.dialText}>{btn}</Text>
            {btn !== '*' && btn !== '#' && (
              <Text style={styles.letters}>{getLetters(btn)}</Text>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.callButton} onPress={handleCall}>
          <Text style={styles.callIcon}>📞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getLetters(digit) {
  const map = {
    '2': 'ABC', '3': 'DEF', '4': 'GHI',
    '5': 'JKL', '6': 'MNO', '7': 'PQRS',
    '8': 'TUV', '9': 'WXYZ',
  };
  return map[digit] || '';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    paddingTop: 60, paddingBottom: 10,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#000' },
  displayContainer: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginBottom: 10,
  },
  numberInput: {
    fontSize: 32, color: '#000', flex: 1, textAlign: 'center',
  },
  deleteButton: { position: 'absolute', right: 10 },
  deleteIcon: { fontSize: 28, color: '#007AFF' },
  suggestionsContainer: {
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 10,
    paddingVertical: 5,
  },
  suggestionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderColor: '#ddd',
  },
  suggestionName: { fontSize: 16, color: '#000' },
  suggestionNumber: { fontSize: 14, color: 'gray' },
  dialpad: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', marginTop: 20,
  },
  dialButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fff', justifyContent: 'center',
    alignItems: 'center', margin: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  dialText: { fontSize: 28, color: '#000' },
  letters: { fontSize: 10, color: 'gray', marginTop: 2, letterSpacing: 1 },
  callButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#34C759', justifyContent: 'center',
    alignItems: 'center', margin: 8,
  },
  callIcon: { fontSize: 30 },
});