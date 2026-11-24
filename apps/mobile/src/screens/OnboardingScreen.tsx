import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../state/AppContext';
import { API_BASE } from '../config';
import { colors, spacing } from '../theme';

export function OnboardingScreen() {
  const { identity, unlock, setupAccount } = useApp();
  const [mode, setMode] = useState<'welcome' | 'create' | 'unlock'>(
    identity ? 'unlock' : 'welcome',
  );
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);

  const onCreate = async () => {
    if (pin.length < 4) {
      Alert.alert('PIN required', 'Use at least 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('PIN mismatch', 'PIN and confirmation must match.');
      return;
    }
    setBusy(true);
    try {
      const result = await setupAccount({
        username: username.trim() || undefined,
        pin,
      });
      setPhrase(result.recoveryPhrase);
      Alert.alert(
        'Backup tip (MVP)',
        `Secure ID: ${result.secureId}\n\nPhrase (demo only — restore not enabled yet):\n${result.recoveryPhrase}\n\nKeep this device safe. Losing it without a backup means losing this identity.`,
      );
    } catch (e: any) {
      Alert.alert(
        'Setup failed',
        `${e.message || 'Could not register identity'}\n\nTrying: ${API_BASE}\n\nPhone and Mac must be on the same Wi‑Fi. Restart Expo after code changes.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const onUnlock = async () => {
    setBusy(true);
    try {
      const ok = await unlock(pin);
      if (!ok) Alert.alert('Wrong PIN', 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'welcome') {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>Secure Mesh Messenger</Text>
        <Text style={styles.sub}>
          Cryptographic identity. End-to-end encrypted chat. Optional live location. No phone
          number required.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => setMode('create')}>
          <Text style={styles.primaryText}>Create Secure Identity</Text>
        </Pressable>
        {identity ? (
          <Pressable style={styles.secondaryBtn} onPress={() => setMode('unlock')}>
            <Text style={styles.secondaryText}>Unlock existing identity</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (mode === 'unlock') {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>Unlock</Text>
        <Text style={styles.sub}>Enter your app PIN to decrypt local keys.</Text>
        <TextInput
          style={styles.input}
          value={pin}
          onChangeText={setPin}
          placeholder="PIN"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          keyboardType="number-pad"
        />
        <Pressable style={styles.primaryBtn} onPress={onUnlock} disabled={busy}>
          {busy ? <ActivityIndicator color="#042F2E" /> : <Text style={styles.primaryText}>Unlock</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.brand}>Create identity</Text>
      <Text style={styles.sub}>
        Keys are generated on this device. Private keys never leave the phone.
      </Text>
      <Text style={styles.apiHint}>API: {API_BASE}</Text>
      <Text style={styles.label}>Username (optional)</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        placeholder="@alexmesh"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.label}>App PIN</Text>
      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={setPin}
        placeholder="At least 4 digits"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        keyboardType="number-pad"
      />
      <TextInput
        style={styles.input}
        value={confirmPin}
        onChangeText={setConfirmPin}
        placeholder="Confirm PIN"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        keyboardType="number-pad"
      />
      {phrase ? (
        <View style={styles.phraseBox}>
          <Text style={styles.label}>Recovery phrase — write this down</Text>
          <Text style={styles.phrase}>{phrase}</Text>
        </View>
      ) : null}
      <Pressable style={styles.primaryBtn} onPress={onCreate} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#042F2E" />
        ) : (
          <Text style={styles.primaryText}>Generate & Register</Text>
        )}
      </Pressable>
      <Pressable onPress={() => setMode('welcome')}>
        <Text style={styles.link}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  brand: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  apiHint: {
    color: colors.accent,
    fontSize: 11,
    fontFamily: 'Courier',
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryText: { color: '#042F2E', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  link: { color: colors.accent, textAlign: 'center', marginTop: spacing.md },
  phraseBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  phrase: { color: colors.text, fontFamily: 'Courier', marginTop: 8 },
});
