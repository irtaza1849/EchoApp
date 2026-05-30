// firebase.js
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🔁 Replace with YOUR Firebase web app config
const firebaseConfig = {
  apiKey: "AIzaSyA6NpAbZ3x1p9JQgBoqo8jfkOkmuzecp7Q",
  authDomain: "omniecho-7858c.firebaseapp.com",
  databaseURL: "https://omniecho-7858c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "omniecho-7858c",
  storageBucket: "omniecho-7858c.firebasestorage.app",
  messagingSenderId: "186991245665",
  appId: "1:186991245665:web:476e0fd23592377970ed20"
};

const app = initializeApp(firebaseConfig);

// Use AsyncStorage persistence so auth state survives app restarts
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getDatabase(app);
export { auth };