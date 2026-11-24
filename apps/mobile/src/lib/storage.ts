import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IdentityBundle } from './crypto';
import type { PrivacySettings } from '../types';

const IDENTITY_KEY = 'smm.identity';
const TOKEN_KEY = 'smm.token';
const PIN_KEY = 'smm.pinHash';
const PIN_SALT = 'smm.pinSalt';
const PRIVACY_KEY = 'smm.privacy';
const MESSAGES_KEY = 'smm.messages';
const FRIENDS_CACHE = 'smm.friends';
const LOCATIONS_KEY = 'smm.locations';

export async function saveIdentity(identity: IdentityBundle) {
  await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(identity));
}

export async function loadIdentity(): Promise<IdentityBundle | null> {
  const raw = await SecureStore.getItemAsync(IDENTITY_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearIdentity() {
  await SecureStore.deleteItemAsync(IDENTITY_KEY);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT);
}

export async function clearSessionToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function savePinHash(hash: string, salt: string) {
  await SecureStore.setItemAsync(PIN_KEY, hash);
  await SecureStore.setItemAsync(PIN_SALT, salt);
}

export async function loadPinSecrets(): Promise<{ hash: string; salt: string } | null> {
  const hash = await SecureStore.getItemAsync(PIN_KEY);
  const salt = await SecureStore.getItemAsync(PIN_SALT);
  if (!hash || !salt) return null;
  return { hash, salt };
}

export const defaultPrivacy: PrivacySettings = {
  locationSharing: 'off',
  ghostMode: true,
  temporaryShareUntil: null,
  nearbyDiscovery: false,
  relayParticipation: false,
  readReceipts: true,
  typingIndicator: true,
  publicUsernameDiscovery: true,
};

export async function savePrivacy(settings: PrivacySettings) {
  await AsyncStorage.setItem(PRIVACY_KEY, JSON.stringify(settings));
}

export async function loadPrivacy(): Promise<PrivacySettings> {
  const raw = await AsyncStorage.getItem(PRIVACY_KEY);
  return raw ? { ...defaultPrivacy, ...JSON.parse(raw) } : defaultPrivacy;
}

export async function saveMessages(messages: unknown) {
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

export async function loadMessages<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(MESSAGES_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveFriendsCache(friends: unknown) {
  await AsyncStorage.setItem(FRIENDS_CACHE, JSON.stringify(friends));
}

export async function loadFriendsCache<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(FRIENDS_CACHE);
  return raw ? JSON.parse(raw) : null;
}

export async function saveLocations(locations: unknown) {
  await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}

export async function loadLocations<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(LOCATIONS_KEY);
  return raw ? JSON.parse(raw) : null;
}
