import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Modal,
  ActionSheetIOS,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '../state/AppContext';
import { conversationIdFor } from '../lib/crypto';
import type { PublicIdentity } from '../types';
import { parseMessagePayload } from '../types';
import { colors, spacing } from '../theme';

export function ChatThreadScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const friend = route.params.friend as PublicIdentity;
  const { identity, messages, sendText, sendAttachment, online, markConversationRead } = useApp();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const convId = useMemo(
    () => (identity ? conversationIdFor(identity.secureId, friend.secureId) : ''),
    [identity, friend.secureId],
  );
  const list = messages[convId] || [];

  useEffect(() => {
    if (convId) void markConversationRead(convId);
  }, [convId, markConversationRead, list.length]);

  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendText(friend, trimmed);
      setText('');
    } catch (e: any) {
      Alert.alert('Send failed', e.message || 'Could not send');
    } finally {
      setSending(false);
    }
  };

  const sendPickedFile = async (opts: {
    uri: string;
    name: string;
    mime: string;
    kind: 'image' | 'video' | 'document';
  }) => {
    setSending(true);
    setMenuOpen(false);
    try {
      const info = await FileSystem.getInfoAsync(opts.uri);
      const size = (info as any).size || 0;
      const dataBase64 = await FileSystem.readAsStringAsync(opts.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await sendAttachment(friend, {
        kind: opts.kind,
        name: opts.name,
        mime: opts.mime,
        dataBase64,
        size: size || Math.ceil((dataBase64.length * 3) / 4),
      });
    } catch (e: any) {
      Alert.alert('Attachment failed', e.message || 'Could not send file');
    } finally {
      setSending(false);
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to share images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await sendPickedFile({
      uri: asset.uri,
      name: asset.fileName || `photo_${Date.now()}.jpg`,
      mime: asset.mimeType || 'image/jpeg',
      kind: 'image',
    });
  };

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow media access to share videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await sendPickedFile({
      uri: asset.uri,
      name: asset.fileName || `video_${Date.now()}.mp4`,
      mime: asset.mimeType || 'video/mp4',
      kind: 'video',
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await sendPickedFile({
      uri: asset.uri,
      name: asset.name || `file_${Date.now()}`,
      mime: asset.mimeType || 'application/octet-stream',
      kind: 'document',
    });
  };

  const openAttachMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo', 'Video', 'Document'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) void pickPhoto();
          if (index === 2) void pickVideo();
          if (index === 3) void pickDocument();
        },
      );
      return;
    }
    setMenuOpen(true);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: friend.username ? `@${friend.username}` : 'Chat',
      headerRight: () => (
        <Pressable onPress={openAttachMenu} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>Attach</Text>
        </Pressable>
      ),
    });
  }, [navigation, friend.username]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <Text style={styles.banner}>E2EE · photos / videos / docs encrypted before send</Text>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: 8, paddingBottom: 20 }}
        renderItem={({ item }) => {
          const payload = parseMessagePayload(item.plaintext);
          return (
            <View style={[styles.bubble, item.mine ? styles.mine : styles.other]}>
              {payload.type === 'attachment' && payload.kind === 'image' ? (
                <Image
                  source={{ uri: `data:${payload.mime};base64,${payload.dataBase64}` }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : null}
              {payload.type === 'attachment' && payload.kind !== 'image' ? (
                <View style={styles.fileChip}>
                  <Text style={styles.fileKind}>
                    {payload.kind === 'video' ? 'VIDEO' : 'FILE'}
                  </Text>
                  <Text style={styles.fileName} numberOfLines={2}>
                    {payload.name}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {Math.round((payload.size || 0) / 1024)} KB · encrypted
                  </Text>
                </View>
              ) : null}
              {payload.type === 'text' ? (
                <Text style={styles.bubbleText}>{payload.text}</Text>
              ) : null}
              <Text style={styles.status}>
                {new Date(item.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {item.mine ? ` · ${item.status}` : ''}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <Pressable style={styles.attachBtn} onPress={openAttachMenu} disabled={sending}>
          <Text style={styles.attachBtnText}>+</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={online ? 'Encrypted message' : 'Offline — will queue'}
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable style={styles.send} onPress={onSend} disabled={sending}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Share encrypted</Text>
            <Pressable style={styles.menuItem} onPress={() => void pickPhoto()}>
              <Text style={styles.menuItemText}>Photo</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => void pickVideo()}>
              <Text style={styles.menuItemText}>Video</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => void pickDocument()}>
              <Text style={styles.menuItemText}>Document (PDF, etc.)</Text>
            </Pressable>
            <Pressable style={styles.menuCancel} onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  banner: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.bubbleMine },
  other: { alignSelf: 'flex-start', backgroundColor: colors.bubbleOther },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 20 },
  status: { color: colors.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' },
  image: { width: 220, height: 160, borderRadius: 12, marginBottom: 4 },
  fileChip: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    padding: 10,
    minWidth: 160,
  },
  fileKind: { color: colors.accent, fontWeight: '800', fontSize: 11, marginBottom: 4 },
  fileName: { color: colors.text, fontWeight: '600' },
  fileMeta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
    backgroundColor: colors.bgElevated,
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBtnText: { color: colors.accent, fontSize: 24, fontWeight: '700', marginTop: -2 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendText: { color: '#042F2E', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  menuCard: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 28,
    borderColor: colors.border,
    borderTopWidth: 1,
  },
  menuTitle: { color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 10 },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuItemText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  menuCancel: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  menuCancelText: { color: colors.danger, fontWeight: '700' },
});
