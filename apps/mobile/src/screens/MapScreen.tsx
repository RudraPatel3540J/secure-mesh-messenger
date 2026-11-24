import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useApp } from '../state/AppContext';
import { colors, spacing } from '../theme';

function freshness(updatedAt: string) {
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age < 60_000) return { label: 'Live', color: colors.success };
  if (age < 10 * 60_000) return { label: 'Recent', color: colors.accent };
  if (age < 60 * 60_000) return { label: 'Stale', color: colors.warning };
  return { label: 'Offline', color: colors.textMuted };
}

export function MapScreen() {
  const { locations, privacy, updatePrivacy, gpsRequiredOk, shareMyLocationOnce } = useApp();
  const entries = useMemo(() => Object.values(locations), [locations]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Map</Text>
      <Text style={styles.sub}>
        Friend locations arrive as encrypted envelopes. Server never sees coordinates.
      </Text>

      <View style={styles.controls}>
        <Pressable
          style={[styles.chip, privacy.ghostMode && styles.chipOn]}
          onPress={() => updatePrivacy({ ghostMode: !privacy.ghostMode, locationSharing: privacy.ghostMode ? 'friends' : 'ghost' })}
        >
          <Text style={styles.chipText}>{privacy.ghostMode ? 'Ghost Mode ON' : 'Ghost Mode'}</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, privacy.locationSharing === 'friends' && styles.chipOn]}
          onPress={() => updatePrivacy({ ghostMode: false, locationSharing: 'friends' })}
        >
          <Text style={styles.chipText}>Share with friends</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, privacy.locationSharing === 'temporary' && styles.chipOn]}
          onPress={() =>
            updatePrivacy({
              ghostMode: false,
              locationSharing: 'temporary',
              temporaryShareUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            })
          }
        >
          <Text style={styles.chipText}>1 hour</Text>
        </Pressable>
        <Pressable
          style={styles.chip}
          onPress={() => {
            void (async () => {
              const result = await shareMyLocationOnce();
              if (!result.ok) {
                Alert.alert('Location unavailable', result.error || 'Could not get GPS fix');
              }
            })();
          }}
        >
          <Text style={styles.chipText}>Share now</Text>
        </Pressable>
      </View>

      <Text style={styles.gps}>
        GPS: {gpsRequiredOk ? 'Ready' : 'Off / denied — enable location in emulator Extended controls'}
      </Text>

      <View style={styles.mapCanvas}>
        <Text style={styles.mapHint}>Friend pins</Text>
        {entries.length === 0 ? (
          <Text style={styles.empty}>No friend locations yet.</Text>
        ) : (
          entries.map((loc) => {
            // Simple projected markers for MVP (no native maps dependency required to run)
            const x = ((loc.longitude + 180) / 360) * 100;
            const y = ((90 - loc.latitude) / 180) * 100;
            const f = freshness(loc.updatedAt);
            return (
              <View
                key={loc.secureId}
                style={[styles.pin, { left: `${Math.min(92, Math.max(4, x))}%`, top: `${Math.min(88, Math.max(8, y))}%` }]}
              >
                <View style={[styles.dot, { backgroundColor: f.color }]} />
                <Text style={styles.pinLabel}>{loc.username || loc.secureId.slice(0, 10)}</Text>
              </View>
            );
          })
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {entries.map((loc) => {
          const f = freshness(loc.updatedAt);
          return (
            <View key={loc.secureId} style={styles.card}>
              <Text style={styles.name}>{loc.username ? `@${loc.username}` : loc.secureId}</Text>
              <Text style={styles.meta}>
                {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)} · ±{Math.round(loc.accuracy)}m
              </Text>
              <Text style={{ color: f.color, marginTop: 4, fontWeight: '600' }}>
                {f.label} · updated {new Date(loc.updatedAt).toLocaleTimeString()}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56, paddingHorizontal: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textMuted, marginBottom: spacing.md },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  gps: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  mapCanvas: {
    height: 220,
    borderRadius: 16,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  mapHint: { color: colors.textMuted, padding: 10, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 60 },
  pin: { position: 'absolute', alignItems: 'center', width: 80, marginLeft: -40 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  pinLabel: { color: colors.text, fontSize: 10, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: 8,
    borderColor: colors.border,
    borderWidth: 1,
  },
  name: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.textMuted, marginTop: 2, fontFamily: 'Courier', fontSize: 12 },
});
