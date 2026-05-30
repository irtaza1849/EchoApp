// screens/DialerTabs.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import KeypadScreen from './KeypadScreen';
import RecentsScreen from './RecentsScreen';
import ContactsScreen from './ContactsScreen';
import VoicemailScreen from './VoicemailScreen';
import SettingsScreen from './SettingsScreen';

const Tab = createBottomTabNavigator();

export default function DialerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Keypad') {
            iconName = focused ? 'keypad' : 'keypad-outline';
          } else if (route.name === 'Recents') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Contacts') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Voicemail') {
            iconName = focused ? 'recording' : 'recording-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF', // iOS blue
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#F9F9F9',
          borderTopWidth: 0.5,
          borderTopColor: '#C6C6C6',
        },
        tabBarLabelStyle: {
          fontSize: 10,
        },
      })}
    >
      <Tab.Screen name="Keypad" component={KeypadScreen} />
      <Tab.Screen name="Recents" component={RecentsScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Voicemail" component={VoicemailScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}