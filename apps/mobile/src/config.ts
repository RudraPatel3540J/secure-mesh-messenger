import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Resolve API host for:
 * - Physical device + Expo Go → same LAN IP as Metro bundler
 * - Android emulator → 10.0.2.2
 * - iOS simulator → localhost
 * Override anytime with EXPO_PUBLIC_API_HOST.
 */
function resolveHost(): string {
  if (process.env.EXPO_PUBLIC_API_HOST) {
    return process.env.EXPO_PUBLIC_API_HOST;
  }

  // Expo Go / dev client: hostUri looks like "192.168.1.20:8081"
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.linkingUri ||
    (Constants as any).experienceUrl ||
    '';

  const match = String(hostUri).match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  if (match?.[1]) {
    return match[1];
  }

  // debuggerHost from older Expo manifests
  const debuggerHost = (Constants.manifest as any)?.debuggerHost as string | undefined;
  if (debuggerHost?.includes(':')) {
    return debuggerHost.split(':')[0];
  }

  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  return 'localhost';
}

const HOST = resolveHost();
const PORT = process.env.EXPO_PUBLIC_API_PORT || '8787';

export const API_HOST = HOST;
export const API_BASE = `http://${HOST}:${PORT}/api`;
export const WS_URL = `ws://${HOST}:${PORT}/ws`;
