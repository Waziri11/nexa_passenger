import { Text } from './themed-primitives';
// Loaded only in a development/native build when an actual call begins.
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  AudioSession,
  LiveKitRoom,
  registerGlobals,
  useParticipants,
  useRoomContext,
} from '@livekit/react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Language } from '@nexadrop/core';
import { useTheme } from './theme';
registerGlobals();
function Controls({ lang, end }: { lang: Language; end: () => void }) {
  const { s, colors } = useTheme();
  const room = useRoomContext(),
    participants = useParticipants();
  const [muted, setMuted] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (room.remoteParticipants.size === 0) end();
    }, 90000);
    return () => clearTimeout(timer);
  }, [room]);
  return (
    <View style={{ alignItems: 'center', gap: 28 }}>
      <Ionicons name="call" size={50} color={colors.blue} />
      <Text style={s.heading}>
        {participants.length > 1
          ? lang === 'sw'
            ? 'Simu imeunganishwa'
            : 'Call connected'
          : lang === 'sw'
            ? 'Inasubiri kujibiwa…'
            : 'Waiting for an answer…'}
      </Text>
      {failed && (
        <Text>
          {lang === 'sw'
            ? 'Ruhusu kipaza sauti kuzungumza.'
            : 'Allow microphone access to speak.'}
        </Text>
      )}
      <View style={s.row}>
        <Pressable
          accessibilityLabel={
            lang === 'sw' ? 'Nyamazisha kipaza sauti' : 'Toggle microphone'
          }
          style={s.callButton}
          onPress={() =>
            void room.localParticipant
              .setMicrophoneEnabled(muted)
              .then(() => setMuted(!muted))
              .catch(() => setFailed(true))
          }
        >
          <Ionicons
            name={muted ? 'mic-off' : 'mic'}
            size={25}
            color={colors.blue}
          />
        </Pressable>
        <Pressable
          accessibilityLabel={lang === 'sw' ? 'Kata simu' : 'End call'}
          style={[s.callButton, { backgroundColor: colors.danger }]}
          onPress={end}
        >
          <Ionicons name="call" size={26} color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}
export function VoiceCall({
  call,
  lang,
  end,
}: {
  call: { token: string; serverUrl: string };
  lang: Language;
  end: () => void;
}) {
  const { s, colors } = useTheme();
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AudioSession.startAudioSession()
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch(() => {
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
      void AudioSession.stopAudioSession();
    };
  }, []);
  if (error)
    return (
      <View style={{ gap: 16 }}>
        <Text>
          {lang === 'sw'
            ? 'Imeshindikana kuanza simu. Angalia ruhusa za kipaza sauti.'
            : 'Could not start audio. Check microphone permissions.'}
        </Text>
        <Pressable onPress={end}>
          <Text style={s.link}>{lang === 'sw' ? 'Funga' : 'Close'}</Text>
        </Pressable>
      </View>
    );
  if (!ready)
    return (
      <Text>{lang === 'sw' ? 'Inaandaa sauti…' : 'Preparing audio…'}</Text>
    );
  return (
    <LiveKitRoom
      serverUrl={call.serverUrl}
      token={call.token}
      connect
      audio
      video={false}
      onDisconnected={end}
      onError={() => setError(true)}
    >
      <Controls lang={lang} end={end} />
    </LiveKitRoom>
  );
}
