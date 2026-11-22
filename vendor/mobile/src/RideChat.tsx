import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import { type Language } from '@nexadrop/core';
import { api, apiOrigin, preview, sessionToken, uuid } from './client';
import { previewApi } from './preview-client';
import { useTheme } from './theme';
import { Text, TextInput } from './themed-primitives';
import { mergeMessages, type ChatMessage } from './chat-model';
import { Button } from './ui';
export function RideChat({
  rideId,
  userId,
  contact,
  language,
  close,
  call,
  onRead,
  focused,
}: {
  rideId: string;
  userId: string;
  contact: any;
  language: Language;
  close: () => void;
  call: () => void;
  onRead: () => void;
  focused: boolean;
}) {
  const { s, colors } = useTheme(),
    sw = language === 'sw';
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [draft, setDraft] = useState(''),
    [pending, setPending] = useState<{ clientId: string; body: string } | null>(
      null,
    );
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [older, setOlder] = useState(false),
    [more, setMore] = useState(false),
    [writable, setWritable] = useState(true),
    [failed, setFailed] = useState(false),
    [outboxReady, setOutboxReady] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    alive = useRef(true),
    checking = useRef(false),
    lastRead = useRef('0'),
    follow = useRef(true),
    sendLock = useRef(false),
    paged = useRef(false),
    dirty = useRef(false),
    visible = useRef(focused);
  visible.current = focused;
  const key = `flash.chat.outbox.${preview ? 'preview' : 'api'}.${userId}.${rideId}`;
  const request = (suffix = '', body?: unknown) =>
    preview
      ? previewApi(`/rides/${rideId}/chat${suffix}`, body)
      : api(`/rides/${rideId}/chat${suffix}`, body);
  async function refresh() {
    if (checking.current) {
      dirty.current = true;
      return;
    }
    checking.current = true;
    try {
      const page = await request();
      if (!alive.current) return;
      setMessages((old) => mergeMessages(old, page.messages));
      if (!paged.current) setMore(page.hasMore);
      setWritable(page.writable);
      setFailed(false);
      const newest = page.messages.at(-1)?.id;
      if (
        newest &&
        BigInt(newest) > BigInt(lastRead.current) &&
        AppState.currentState === 'active' &&
        visible.current
      ) {
        await request('/read', { uptoId: newest });
        if (!alive.current) return;
        lastRead.current = newest;
        onRead();
      }
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      checking.current = false;
      if (alive.current) setLoading(false);
      if (dirty.current && alive.current) {
        dirty.current = false;
        void refresh();
      }
    }
  }
  useEffect(() => {
    if (focused) void refresh();
  }, [focused]);
  useEffect(() => {
    alive.current = true;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (!alive.current) return;
        try {
          const value = JSON.parse(raw || 'null');
          if (value?.clientId && typeof value.body === 'string')
            setPending(value);
        } catch {
          setFailed(true);
        }
        setOutboxReady(true);
      })
      .catch(() => {
        if (alive.current) {
          setFailed(true);
          setOutboxReady(true);
        }
      });
    void refresh();
    const socket = !preview
      ? io(apiOrigin, { auth: { token: sessionToken() } })
      : null;
    socket?.on('chat:message', (event) => {
      if (event.rideId === rideId) void refresh();
    });
    socket?.on('ride:changed', (event) => {
      if (event.id === rideId) void refresh();
    });
    socket?.on('connect', () => void refresh());
    const timer = setInterval(
      () => {
        if (AppState.currentState === 'active') {
          if (socket) {
            socket.auth = { token: sessionToken() };
            if (!socket.connected) socket.connect();
          }
          void refresh();
        }
      },
      preview ? 1500 : 5000,
    );
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      alive.current = false;
      clearInterval(timer);
      listener.remove();
      back.remove();
      socket?.disconnect();
    };
  }, [rideId, userId]);
  async function send() {
    if (sendLock.current || !outboxReady) return;
    const item = pending || { clientId: uuid(), body: draft.trim() };
    if (!item.body) return;
    sendLock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(item));
      if (!alive.current) return;
      setPending(item);
      setDraft('');
      const result = await request('', item);
      if (!alive.current) return;
      setMessages((old) => mergeMessages(old, [result.message]));
      follow.current = true;
      await AsyncStorage.removeItem(key);
      if (!alive.current) return;
      setPending(null);
      void refresh();
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      sendLock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (
      pending &&
      messages.some(
        (m) => m.sender_id === userId && m.client_id === pending.clientId,
      )
    )
      void AsyncStorage.removeItem(key)
        .then(() => {
          if (alive.current) setPending(null);
        })
        .catch(() => {});
  }, [messages, pending?.clientId]);
  const confirmed =
    pending &&
    messages.some(
      (m) => m.sender_id === userId && m.client_id === pending.clientId,
    );
  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, s.root, { zIndex: 100 }]}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={[s.header, { gap: 12 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sw ? 'Rudi' : 'Back'}
            onPress={close}
            style={s.callButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.blue} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.heading} numberOfLines={1}>
              {contact?.full_name ||
                (sw ? 'Mazungumzo ya safari' : 'Trip chat')}
            </Text>
            <Text style={s.small}>
              {sw ? 'Mazungumzo ya safari' : 'Trip chat'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sw ? 'Piga simu' : 'Call'}
            onPress={call}
            style={s.callButton}
          >
            <Ionicons name="call" size={23} color={colors.blue} />
          </Pressable>
        </View>
        {loading && (
          <ActivityIndicator style={{ padding: 12 }} color={colors.blue} />
        )}
        {failed && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={s.error}>
              {sw
                ? 'Muunganisho umekatika au ujumbe haukutumwa. Jaribu tena.'
                : 'Connection unavailable or message not sent. Please retry.'}
            </Text>
            <Button
              title={sw ? 'Jaribu tena' : 'Retry'}
              secondary
              onPress={() => void (pending ? send() : refresh())}
            />
          </View>
        )}
        <ScrollView
          ref={scroll}
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } =
              event.nativeEvent;
            follow.current =
              contentSize.height - contentOffset.y - layoutMeasurement.height <
              100;
          }}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (follow.current && !older)
              scroll.current?.scrollToEnd({ animated: true });
          }}
        >
          {more && (
            <Button
              title={sw ? 'Ujumbe wa awali' : 'Earlier messages'}
              secondary
              disabled={older}
              onPress={() =>
                void (async () => {
                  setOlder(true);
                  paged.current = true;
                  follow.current = false;
                  try {
                    const page = await request('?before=' + messages[0].id);
                    if (alive.current) {
                      setMessages((old) => mergeMessages(page.messages, old));
                      setMore(page.hasMore);
                    }
                  } catch {
                    if (alive.current) setFailed(true);
                  } finally {
                    if (alive.current) setOlder(false);
                  }
                })()
              }
            />
          )}
          {!messages.length && !loading && (
            <Text style={[s.small, { textAlign: 'center', padding: 20 }]}>
              {sw
                ? 'Andika ujumbe kuhusu sehemu ya kupandia au safari yako.'
                : 'Send a message about pickup or your trip.'}
            </Text>
          )}
          {messages.map((message) => (
            <View
              key={message.id}
              style={{
                alignSelf:
                  message.sender_id === userId ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: 14,
                borderRadius: 18,
                backgroundColor:
                  message.sender_id === userId
                    ? colors.blueTint
                    : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 16, lineHeight: 23 }} selectable>
                {message.body}
              </Text>
              <Text style={[s.small, { alignSelf: 'flex-end' }]}>
                {new Date(message.created_at).toLocaleTimeString(
                  sw ? 'sw-TZ' : 'en-TZ',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Africa/Dar_es_Salaam',
                  },
                )}
              </Text>
            </View>
          ))}
          {pending && !confirmed && (
            <View
              style={[
                s.card,
                {
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  backgroundColor: colors.blueTint,
                },
              ]}
            >
              <Text>{pending.body}</Text>
              <Text style={s.small}>
                {busy
                  ? sw
                    ? 'Inatuma…'
                    : 'Sending…'
                  : sw
                    ? 'Haijatumwa bado'
                    : 'Not sent yet'}
              </Text>
              {!busy && (
                <Pressable
                  onPress={() =>
                    void AsyncStorage.removeItem(key).then(() => {
                      setDraft(pending.body);
                      setPending(null);
                    })
                  }
                >
                  <Text style={s.link}>
                    {sw ? 'Rudisha kwenye rasimu' : 'Return to draft'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
        {writable ? (
          <View
            style={[
              s.bookingDock,
              { flexDirection: 'row', alignItems: 'flex-end' },
            ]}
          >
            <TextInput
              accessibilityLabel={sw ? 'Ujumbe' : 'Message'}
              placeholder={sw ? 'Andika ujumbe…' : 'Type a message…'}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={2000}
              editable={!pending && !busy}
              style={[s.input, { flex: 1, maxHeight: 120, minHeight: 48 }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                pending
                  ? sw
                    ? 'Tuma tena'
                    : 'Retry sending'
                  : sw
                    ? 'Tuma'
                    : 'Send'
              }
              disabled={busy || !outboxReady || (!pending && !draft.trim())}
              onPress={() => void send()}
              style={[
                s.callButton,
                {
                  backgroundColor: colors.primary,
                  opacity: busy || (!pending && !draft.trim()) ? 0.5 : 1,
                },
              ]}
            >
              <Ionicons
                name={pending ? 'refresh' : 'send'}
                size={22}
                color={colors.onPrimary}
              />
            </Pressable>
          </View>
        ) : (
          <Text style={[s.notice, { margin: 16 }]}>
            {sw
              ? 'Safari imefungwa. Unaweza kusoma ujumbe uliopita.'
              : 'Trip closed. You can read previous messages.'}
          </Text>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
