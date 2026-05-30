// screens/DialerTabs.js
import React, { useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import KeypadScreen from './KeypadScreen';
import RecentsScreen from './RecentsScreen';
import ContactsScreen from './ContactsScreen';
import MessagesScreen from './MessagesScreen';
import SettingsScreen from './SettingsScreen';
import { addMessage } from './MessageStore';

const Tab = createBottomTabNavigator();

export default function DialerTabs() {
  const wsRef = useRef(null);

  // Persistent WebSocket for incoming SMS and call events
  useEffect(() => {
    const connectForEvents = async () => {
      const ip = await AsyncStorage.getItem('omniIp');
      const port = await AsyncStorage.getItem('omniPort');
      if (!ip || !port) return;

      const deviceId = await AsyncStorage.getItem('echoDeviceId');
      const ws = new WebSocket(`ws://${ip}:${port}`);

      ws.onopen = () => {
        if (deviceId) ws.send(`identify:${deviceId}`);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'incoming_sms') {
            // Save to local message store
            addMessage(data.sender, data.message, 'incoming');
          }
          // If it's a call, the CallScreen navigation is handled in CallScreen.js itself.
          // This persistent connection also helps keep the pairing alive.
        } catch {
          // Ignore plain text messages (paired/unpaired/disengage)
        }
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        // Reconnect after 5 seconds
        setTimeout(connectForEvents, 5000);
      };

      wsRef.current = ws;
    };

    connectForEvents();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Keypad') iconName = focused ? 'keypad' : 'keypad-outline';
          else if (route.name === 'Recents') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Contacts') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Messages') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: { backgroundColor: '#F9F9F9', borderTopWidth: 0.5, borderTopColor: '#C6C6C6' },
        tabBarLabelStyle: { fontSize: 10 },
      })}
    >
      <Tab.Screen name="Keypad" component={KeypadScreen} />
      <Tab.Screen name="Recents" component={RecentsScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}