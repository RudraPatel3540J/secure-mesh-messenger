import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Pressable, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../state/AppContext';
import { colors, spacing } from '../theme';

export function SettingsScreen() {
  const { identity, username, privacy, updatePrivacy, gpsRequiredOk, cellularRequiredOk, connectionLabel } =
    useApp();

  const copyId = async () => {
    if (!identity) return;
    await Clipboard.setStringAsync(identity.secureId);
    Alert.alert('Copied', 'Secure ID copied to clipboard');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Identity</Text>
        <Text style={styles.meta}>Username: {username ? `@${username}` : 'not set'}</Text>
        <Text style={styles.meta}>Secure ID:</Text>
        <Pressable onPress={copyId}>
          <Text style={styles.mono}>{identity?.secureId}</Text>
        </Pressable>
        <Text style={styles.hint}>Private keys stay in Secure Store on this device.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Device gates</Text>
        <Text style={styles.meta}>Network: {connectionLabel}</Text>
        <Text style={styles.meta}>
          Connectivity OK: {cellularRequiredOk ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.meta}>GPS ready: {gpsRequiredOk ? 'Yes' : 'No / not granted'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Privacy dashboard</Text>
        <Toggle
          label="Ghost Mode"
          value={privacy.ghostMode}
          onChange={(v) => updatePrivacy({ ghostMode: v, locationSharing: v ? 'ghost' : 'off' })}
        />
        <Toggle
          label="Read receipts"
          value={privacy.readReceipts}
          onChange={(v) => updatePrivacy({ readReceipts: v })}
        />
        <Toggle
          label="Typing indicator"
          value={privacy.typingIndicator}
          onChange={(v) => updatePrivacy({ typingIndicator: v })}
        />
        <Toggle
          label="Public username discovery"
          value={privacy.publicUsernameDiscovery}
          onChange={(v) => updatePrivacy({ publicUsernameDiscovery: v })}
        />
        <Toggle
          label="Nearby discovery"
          value={privacy.nearbyDiscovery}
          onChange={(v) => updatePrivacy({ nearbyDiscovery: v })}
        />
        <Toggle
          label="Relay participation"
          value={privacy.relayParticipation}
          onChange={(v) => updatePrivacy({ relayParticipation: v })}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Security model</Text>
        <Text style={styles.meta}>• X25519 sealed boxes for message & location payloads</Text>
        <Text style={styles.meta}>• Ed25519 identity signing keys</Text>
        <Text style={styles.meta}>• Server stores ciphertext only</Text>
        <Text style={styles.meta}>• Blockchain DID deferred (optional module)</Text>
        <Text style={styles.meta}>• Multi-hop mesh deferred (Nearby phase)</Text>
      </View>
    </ScrollView>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accentDim, false: colors.border }}
        thumbColor={value ? colors.accent : '#777'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56, paddingHorizontal: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: 8,
  },
  section: { color: colors.text, fontWeight: '700', marginBottom: 4 },
  meta: { color: colors.textMuted, lineHeight: 20 },
  mono: { color: colors.accent, fontFamily: 'Courier', marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  label: { color: colors.text, flex: 1, paddingRight: 12 },
});
