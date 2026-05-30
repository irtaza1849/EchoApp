// screens/MessageStore.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const MESSAGES_KEY = 'echo_messages';

// Load all conversations (array of { number, messages: [...] })
export async function loadConversations() {
  const stored = await AsyncStorage.getItem(MESSAGES_KEY);
  return stored ? JSON.parse(stored) : [];
}

export async function saveConversations(conversations) {
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(conversations));
}

// Add a message to a conversation. If conversation doesn't exist, create it.
export async function addMessage(number, text, type, timestamp = Date.now()) {
  const conversations = await loadConversations();
  const cleanNumber = number.replace(/\D/g, '');
  let conv = conversations.find(c => c.number === cleanNumber);
  if (!conv) {
    conv = { number: cleanNumber, messages: [] };
    conversations.push(conv);
  }
  conv.messages.push({ text, type, timestamp }); // type: 'incoming' | 'outgoing'
  await saveConversations(conversations);
  return conversations;
}

// Get all unique numbers (conversations list)
export async function getConversationList() {
  const conversations = await loadConversations();
  return conversations.map(c => c.number);
}