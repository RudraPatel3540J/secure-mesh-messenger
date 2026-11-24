import React from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { useApp } from '../state/AppContext';
import { colors, spacing } from '../theme';

export function NearbyScreen() {
  const { privacy, updatePrivacy, online, connectionLabel } = useApp();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearby</Text>
      <Text style={styles.sub}>
        Nearby / mesh relay is prepared in the product architecture. This MVP includes discovery
        controls and offline queue awareness; BLE multi-hop shipping comes in a later phase.
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Nearby discovery</Text>
          <Switch
            value={privacy.nearbyDiscovery}
            onValueChange={(v) => updatePrivacy({ nearbyDiscovery: v })}
            trackColor={{ true: colors.accentDim, false: colors.border }}
            thumbColor={privacy.nearbyDiscovery ? colors.accent : '#777'}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Relay participation (opt-in)</Text>
          <Switch
            value={privacy.relayParticipation}
            onValueChange={(v) => updatePrivacy({ relayParticipation: v })}
            trackColor={{ true: colors.accentDim, false: colors.border }}
            thumbColor={privacy.relayParticipation ? colors.accent : '#777'}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Transport status</Text>
        <Text style={styles.meta}>Network: {connectionLabel}</Text>
        <Text style={styles.meta}>Internet path: {online ? 'Available' : 'Unavailable — store & forward'}</Text>
        <Text style={styles.meta}>
          Discovery: {privacy.nearbyDiscovery ? 'Armed (awaiting native BLE module)' : 'Off'}
        </Text>
        <Text style={styles.meta}>
          Relay: {privacy.relayParticipation ? 'Willing' : 'Disabled (default)'}
        </Text>
      </View>

      <Pressable
        style={styles.btn}
        onPress={() => updatePrivacy({ nearbyDiscovery: false, relayParticipation: false })}
      >
        <Text style={styles.btnText}>Disable all nearby features</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56, paddingHorizontal: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.text, fontWeight: '600', flex: 1, paddingRight: 12 },
  section: { color: colors.text, fontWeight: '700', marginBottom: 4 },
  meta: { color: colors.textMuted, lineHeight: 20 },
  btn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { color: colors.danger, fontWeight: '700' },
});
