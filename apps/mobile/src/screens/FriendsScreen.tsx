import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useApp } from '../state/AppContext';
import { colors, spacing } from '../theme';

export function FriendsScreen() {
  const { identity, friends, requests, addFriendByQuery, respondRequest, refreshFriends } =
    useApp();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const onAdd = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const found = await addFriendByQuery(query.trim());
      Alert.alert('Request sent', `Friend request sent to ${found.username || found.secureId}`);
      setQuery('');
    } catch (e: any) {
      Alert.alert('Could not add', e.message || 'Lookup failed');
    } finally {
      setBusy(false);
    }
  };

  const shareId = async () => {
    if (!identity) return;
    await Share.share({
      message: `Add me on Secure Mesh Messenger: ${identity.secureId}`,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Friends</Text>
      <Text style={styles.sub}>Connect by username or Secure ID — no phone number.</Text>

      {identity ? (
        <View style={styles.qrCard}>
          <QRCode value={identity.secureId} size={140} backgroundColor="#fff" />
          <Text style={styles.secureId}>{identity.secureId}</Text>
          <Pressable onPress={shareId}>
            <Text style={styles.link}>Share Secure ID</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Username or Secure ID"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        <Pressable style={styles.btn} onPress={onAdd} disabled={busy}>
          <Text style={styles.btnText}>Add</Text>
        </Pressable>
      </View>

      {requests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requests</Text>
          {requests.map((r) => (
            <View key={r.id} style={styles.reqRow}>
              <Text style={styles.name}>
                {r.from.username ? `@${r.from.username}` : r.from.secureId}
              </Text>
              <View style={styles.reqActions}>
                <Pressable onPress={() => respondRequest(r.id, true)}>
                  <Text style={styles.accept}>Accept</Text>
                </Pressable>
                <Pressable onPress={() => respondRequest(r.id, false)}>
                  <Text style={styles.reject}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <FlatList
        data={friends}
        keyExtractor={(item) => item.friendshipId}
        onRefresh={() => void refreshFriends()}
        refreshing={false}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Your friends</Text>}
        ListEmptyComponent={<Text style={styles.empty}>No friends yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.friendRow}>
            <Text style={styles.name}>
              {item.friend.username ? `@${item.friend.username}` : item.friend.secureId}
            </Text>
            <Text style={styles.meta}>{item.friend.secureId}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56, paddingHorizontal: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textMuted, marginBottom: spacing.md },
  qrCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    gap: 8,
    marginBottom: spacing.md,
  },
  secureId: { color: colors.text, fontFamily: 'Courier', fontSize: 12 },
  link: { color: colors.accent, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  btnText: { color: '#042F2E', fontWeight: '700' },
  section: { marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  reqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reqActions: { flexDirection: 'row', gap: 16 },
  accept: { color: colors.success, fontWeight: '700' },
  reject: { color: colors.danger, fontWeight: '600' },
  friendRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { color: colors.text, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted },
});
