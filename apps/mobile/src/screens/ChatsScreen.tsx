import React, { useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../state/AppContext';
import { conversationIdFor } from '../lib/crypto';
import { previewForMessage } from '../types';
import { colors, spacing } from '../theme';

export function ChatsScreen() {
  const { friends, messages, identity, connectionLabel, online } = useApp();
  const navigation = useNavigation<any>();

  const rows = useMemo(() => {
    if (!identity) return [];
    return friends
      .map((f) => {
        const convId = conversationIdFor(identity.secureId, f.friend.secureId);
        const list = messages[convId] || [];
        const last = list[list.length - 1];
        return {
          key: f.friendshipId,
          friend: f.friend,
          lastText: last ? previewForMessage(last.plaintext) : 'No messages yet',
          lastAt: last?.createdAt,
          unread: list.filter((m) => !m.mine && m.status !== 'read').length,
        };
      })
      .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
  }, [friends, messages, identity]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <Text style={[styles.badge, !online && styles.badgeOffline]}>{connectionLabel}</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={
          <Text style={styles.empty}>Add a friend to start an encrypted conversation.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('ChatThread', { friend: item.friend })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.friend.username || item.friend.secureId).slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {item.friend.username ? `@${item.friend.username}` : item.friend.secureId}
              </Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastText}
              </Text>
            </View>
            {item.unread > 0 ? (
              <View style={styles.unread}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  badge: {
    color: colors.accent,
    fontSize: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeOffline: { color: colors.warning },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '700' },
  name: { color: colors.text, fontWeight: '600', fontSize: 16 },
  preview: { color: colors.textMuted, marginTop: 2 },
  unread: {
    backgroundColor: colors.accent,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#042F2E', fontWeight: '700', fontSize: 12 },
});
