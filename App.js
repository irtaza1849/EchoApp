// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import PairingScreen from './screens/PairingScreen';
import PaymentScreen from './screens/PaymentScreen';
import DialerTabs from './screens/DialerTabs';
import CallScreen from './screens/CallScreen';
import ComposeScreen from './screens/ComposeScreen';
import ConversationScreen from './screens/ConversationScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Pairing" component={PairingScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="Main" component={DialerTabs} />
        <Stack.Screen
          name="Call"
          component={CallScreen}
          options={{ presentation: 'modal', animationTypeForReplace: 'push' }}
        />
        <Stack.Screen name="Compose" component={ComposeScreen} />
        <Stack.Screen name="Conversation" component={ConversationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}