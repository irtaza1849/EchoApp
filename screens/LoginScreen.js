// screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, db } from '../firebase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please fill in both fields.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      const user = userCredential.user;

      // Check if email is verified
      if (!user.emailVerified) {
        // Offer to resend verification email
        Alert.alert(
          'Email Not Verified',
          'You haven’t verified your email yet. Check your spam folder. Resend verification?',
          [
            {
              text: 'Resend',
              onPress: async () => {
                await sendEmailVerification(user);
                Alert.alert('Sent', 'Verification email sent. Please check your inbox and spam folder.');
                await auth.signOut();
              },
            },
            { text: 'Cancel', onPress: () => auth.signOut() },
          ]
        );
        setLoading(false);
        return;
      }

      // Email verified → check subscription status
      const snapshot = await get(ref(db, `users/${user.uid}/subscriptionExpiry`));
      const expiry = snapshot.val() || 0;

      if (expiry > Date.now()) {
        // Active subscription → go to pairing screen
        navigation.replace('Pairing');
      } else {
        // Expired → go to payment screen
        navigation.replace('Payment');
      }
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Echo</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Log In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.link}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#1C1C1E',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#1C1C1E',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
});