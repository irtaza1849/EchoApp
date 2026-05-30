// screens/ContactUtils.js
import * as Contacts from 'expo-contacts';

export async function getContactNameByNumber(phoneNumber) {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Contacts permission denied');
      return null;
    }
    // Normalize input number: keep only digits
    const cleanInput = phoneNumber.replace(/\D/g, '');

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    });

    for (const contact of data) {
      if (contact.phoneNumbers) {
        for (const phone of contact.phoneNumbers) {
          // Normalize stored number: keep only digits
          const cleanStored = phone.number.replace(/\D/g, '');
          // Check if stored number contains input or vice versa (handles prefixes)
          if (cleanStored.includes(cleanInput) || cleanInput.includes(cleanStored)) {
            return contact.name || null;
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return null;
  }
}