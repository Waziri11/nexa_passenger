import { copy } from './copy';
import React, { useEffect, useState } from 'react';
import {
  View,
  Pressable,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  categories,
  money,
  subscriptionAmount,
  subscriptionDue,
  cargoOnly,
  type Category,
  type Language,
  type SubscriptionMonths,
} from '@nexadrop/core';
import { Text } from './themed-primitives';
import { Button, Field } from './ui';
import { useTheme } from './theme';
import { api, preview } from './client';
import { previewApi } from './preview-client';
import { SubscriptionPayments } from './SubscriptionPayments';
export function FleetManager({
  language,
  phone,
  onActivated,
  onOwnership,
}: {
  language: Language;
  phone: string;
  onActivated: () => void;
  onOwnership?: (owns: boolean) => void;
}) {
  const { s } = useTheme();
  const sw = language === 'sw';
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    [category, setCategory] = useState<Category>('boda'),
    [plate, setPlate] = useState(''),
    [color, setColor] = useState(''),
    [payload, setPayload] = useState(''),
    [photo, setPhoto] = useState(''),
    [inviteVehicle, setInviteVehicle] = useState(''),
    [invitePhone, setInvitePhone] = useState('+255'),
    [acceptId, setAcceptId] = useState(''),
    [licence, setLicence] = useState(''),
    [expiry, setExpiry] = useState(''),
    [front, setFront] = useState(''),
    [back, setBack] = useState(''),
    [face, setFace] = useState(''),
    [payVehicle, setPayVehicle] = useState<string | undefined>(),
    [period, setPeriod] = useState<SubscriptionMonths>(1);
  const call = (path: string, body?: unknown) =>
    preview ? previewApi('/fleet' + path, body) : api('/fleet' + path, body);
  const load = async () => {
    const result = await call('');
    setData(result);
    onOwnership?.(result.vehicles.length > 0);
  };
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void run(load);
  }, []);
  async function photoUpload(set: (id: string) => void, camera: boolean) {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        sw ? 'Ruhusu kamera au picha' : 'Allow camera or photo access',
      );
    const options = {
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      base64: true,
      quality: 0.6,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const image = result.assets[0];
    if (preview) set(image.uri);
    else
      set(
        (
          await api('/uploads', {
            mime: image.mimeType || 'image/jpeg',
            base64: image.base64,
          })
        ).id,
      );
  }
  const photoField = (
    label: string,
    value: string,
    set: (id: string) => void,
  ) => (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>
        {label}
        {value ? ' ✓' : ''}
      </Text>
      <View style={[s.row, { flexWrap: 'wrap' }]}>
        <Button
          secondary
          title={sw ? 'Pakia picha' : 'Upload photo'}
          onPress={() => void run(() => photoUpload(set, false))}
        />
        <Button
          secondary
          title={sw ? 'Piga picha' : 'Take photo'}
          onPress={() => void run(() => photoUpload(set, true))}
        />
      </View>
      {preview && value && (
        <Image
          source={{ uri: value }}
          style={{ height: 80, width: 120, borderRadius: 8 }}
        />
      )}
    </View>
  );
  return (
    <View style={{ gap: 16 }}>
      <Text style={s.title}>
        {sw ? 'Magari yangu na madereva' : 'My vehicles and drivers'}
      </Text>
      <Text style={s.subtitle}>
        {sw
          ? 'Sajili magari mengi, mwalike dereva kwa namba yake, na lipia usajili wa kila gari. Mmiliki asiyeendesha hahitaji leseni yake; kila dereva anahitaji leseni yake kuthibitishwa.'
          : 'Register multiple vehicles, invite drivers by phone and pay each vehicle’s subscription. A non-driving owner needs no driving licence; every driver must have their own licence approved.'}
      </Text>
      {preview && (
        <Text style={s.small}>
          {sw
            ? 'Muonekano wa majaribio: uthibitisho wa simu, leseni na malipo si wa moja kwa moja. Hakuna uidhinishaji au malipo halisi.'
            : 'Fleet preview: phone/licence checks and payments are simulated. No real approval or payment is granted.'}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {busy && <ActivityIndicator />}
      <Button
        secondary
        title={sw ? 'Sasisha' : 'Refresh'}
        onPress={() => void run(load)}
      />
      <Button
        title={sw ? 'Ongeza gari' : 'Add vehicle'}
        onPress={() => setAdding(!adding)}
      />
      {adding && (
        <View style={s.card}>
          <Text style={s.heading}>{sw ? 'Gari jipya' : 'New vehicle'}</Text>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            {categories.map((c) => (
              <Pressable
                key={c}
                style={[s.typeChip, category === c && s.selected]}
                onPress={() => setCategory(c)}
              >
                <Text style={s.bold}>{copy[language][c]}</Text>
              </Pressable>
            ))}
          </View>
          <Field
            label={sw ? 'Namba ya usajili' : 'Registration number'}
            value={plate}
            onChange={setPlate}
          />
          <Field
            label={sw ? 'Rangi' : 'Colour'}
            value={color}
            onChange={setColor}
          />
          <Field
            label={
              sw
                ? 'Uwezo wa mzigo wa mtengenezaji (kg)'
                : 'Manufacturer payload capacity (kg)'
            }
            value={payload}
            onChange={setPayload}
            keyboard="decimal-pad"
          />
          <Text style={s.small}>
            {sw
              ? 'Huu ni uzito wa mzigo unaoruhusiwa, si uzito wa gari. Msimamizi lazima athibitishe kabla ya kutumika kupokea mizigo.'
              : 'Enter payload, not vehicle gross weight. Administration must verify it before cargo matching.'}
          </Text>
          {photoField(
            sw ? 'Picha ya gari' : 'Vehicle photograph',
            photo,
            setPhoto,
          )}
          <Text style={s.bold}>
            {money(subscriptionAmount(category))} / {sw ? 'mwezi' : 'month'}
          </Text>
          <Button
            title={sw ? 'Wasilisha gari' : 'Submit vehicle'}
            disabled={
              busy ||
              plate.trim().length < 4 ||
              color.trim().length < 2 ||
              !photo ||
              !Number.isFinite(Number(payload)) ||
              Number(payload) <= 0
            }
            onPress={() =>
              void run(async () => {
                await call('/vehicles', {
                  category,
                  plate,
                  vehicleColor: color,
                  payloadKg: Number(payload),
                  photoId: photo,
                });
                setAdding(false);
                setPlate('');
                setColor('');
                setPayload('');
                setPhoto('');
                await load();
              })
            }
          />
        </View>
      )}
      {data?.vehicles.map((v: any) => (
        <View style={s.card} key={v.id}>
          <Text style={s.heading}>
            {v.plate} · {copy[language][v.category as Category]}
          </Text>
          <Text>
            {v.vehicle_color} · {v.approval}
          </Text>
          <Text style={s.small}>
            {sw ? 'Uwezo uliothibitishwa' : 'Verified payload'}:{' '}
            {v.payload_kg
              ? `${v.payload_kg} kg`
              : sw
                ? 'Unasubiri uhakiki'
                : 'Awaiting review'}
          </Text>
          <Text style={s.bold}>
            {money(subscriptionAmount(v.category))} /{' '}
            {sw ? 'mwezi kwa gari' : 'month per vehicle'}
          </Text>
          <Text>
            {v.driver_name
              ? `${v.driver_name} · ${v.driver_phone} · ${v.assignment_status}`
              : sw
                ? 'Hakuna dereva aliyekubali bado'
                : 'No accepted driver yet'}
          </Text>
          {v.assignment_status ? (
            <Button
              secondary
              title={sw ? 'Ondoa uteuzi wa dereva' : 'Release driver'}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await call('/vehicles/' + v.id + '/release', {});
                  await load();
                  onActivated();
                })
              }
            />
          ) : (
            <Button
              secondary
              title={sw ? 'Mwalike dereva' : 'Invite driver'}
              onPress={() => setInviteVehicle(v.id)}
            />
          )}
          {!cargoOnly(v.category) &&
            v.approval === 'approved' &&
            v.assignment_status === 'active' &&
            subscriptionDue(v).due &&
            !preview && (
              <Button
                title={sw ? 'Lipa usajili wa gari' : 'Pay vehicle subscription'}
                onPress={() => setPayVehicle(v.id)}
              />
            )}
          <Text style={s.small}>
            {cargoOnly(v.category)
              ? sw
                ? 'Usafirishaji unasubiri uzinduzi; hakuna malipo yanayotozwa.'
                : 'Delivery launch pending; no payment is collected.'
              : sw
                ? 'Usajili unahusu gari hata dereva akibadilika.'
                : 'The subscription stays with this vehicle when its driver changes.'}
          </Text>
          {!!subscriptionDue(v).dueAt && (
            <Text>
              {sw ? 'Malipo yanahitajika' : 'Payment due'}:{' '}
              {new Date(subscriptionDue(v).dueAt!).toLocaleDateString()}
            </Text>
          )}
        </View>
      ))}
      {!!inviteVehicle && (
        <View style={s.card}>
          <Field
            label={sw ? 'Namba ya simu ya dereva' : 'Driver phone number'}
            value={invitePhone}
            onChange={setInvitePhone}
            keyboard="phone-pad"
          />
          <Text style={s.small}>
            {sw
              ? 'Dereva afungue Nexadrop Driver kwa namba hii na aende Magari kukubali mwaliko na kupakia leseni.'
              : 'The driver signs in to Nexadrop Driver with this number, then opens Fleet to accept and upload a licence.'}
          </Text>
          <Button
            title={sw ? 'Tengeneza mwaliko' : 'Create invitation'}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await call('/vehicles/' + inviteVehicle + '/invite', {
                  phone: invitePhone,
                });
                setInviteVehicle('');
                await load();
              })
            }
          />
          <Button
            secondary
            title={sw ? 'Funga' : 'Close'}
            onPress={() => setInviteVehicle('')}
          />
        </View>
      )}
      {data?.outgoing.map((i: any) => (
        <View style={s.card} key={i.id}>
          <Text>
            {i.phone} · {sw ? 'Mwaliko unasubiri' : 'Invitation pending'}
          </Text>
          <Button
            secondary
            title={sw ? 'Ghairi mwaliko' : 'Cancel invitation'}
            onPress={() =>
              void run(async () => {
                await call('/invitations/' + i.id + '/cancel', {});
                await load();
              })
            }
          />
        </View>
      ))}
      {data?.invitations.map((i: any) => (
        <View style={s.card} key={i.id}>
          <Text style={s.heading}>
            {sw ? 'Mwaliko wa kuendesha' : 'Driving invitation'}: {i.plate}
          </Text>
          <Text>
            {i.owner_name} · {i.vehicle_color}
          </Text>
          <Button
            title={sw ? 'Kubali na pakia leseni' : 'Accept and upload licence'}
            onPress={() => setAcceptId(i.id)}
          />
        </View>
      ))}
      {!!acceptId && (
        <View style={s.card}>
          <Text style={s.heading}>
            {sw ? 'Leseni yako mwenyewe' : 'Your own driving licence'}
          </Text>
          <Field
            label={sw ? 'Namba ya leseni' : 'Licence number'}
            value={licence}
            onChange={setLicence}
          />
          <Field
            label={sw ? 'Tarehe ya mwisho (YYYY-MM-DD)' : 'Expiry (YYYY-MM-DD)'}
            value={expiry}
            onChange={setExpiry}
          />
          {photoField(
            sw ? 'Mbele ya leseni' : 'Licence front',
            front,
            setFront,
          )}
          {photoField(sw ? 'Nyuma ya leseni' : 'Licence back', back, setBack)}
          {photoField(
            sw ? 'Picha yako' : 'Your profile photograph',
            face,
            setFace,
          )}
          <Text style={s.small}>
            {sw
              ? 'Leseni, utambulisho na gari lazima vikaguliwe na msimamizi kabla ya kupokea kazi.'
              : 'Your licence, identity and the vehicle require administrator review before receiving jobs.'}
          </Text>
          <Button
            title={
              sw ? 'Wasilisha leseni na ukubali' : 'Submit licence and accept'
            }
            disabled={
              busy ||
              !front ||
              !back ||
              !face ||
              licence.trim().length < 4 ||
              !/^\d{4}-\d{2}-\d{2}$/.test(expiry)
            }
            onPress={() =>
              void run(async () => {
                await call('/invitations/' + acceptId + '/accept', {
                  licenceNumber: licence,
                  licenceExpiry: expiry,
                  licenceFront: front,
                  licenceBack: back,
                  profilePhoto: face,
                });
                setAcceptId('');
                setFront('');
                setBack('');
                setFace('');
                await load();
              })
            }
          />
          <Button
            secondary
            title={sw ? 'Funga' : 'Close'}
            onPress={() => setAcceptId('')}
          />
        </View>
      )}
      {data?.assignments.map((a: any) => (
        <View style={s.card} key={a.id}>
          <Text style={s.heading}>
            {a.plate} · {a.status}
          </Text>
          {a.licence_approval !== 'approved' && (
            <Button
              secondary
              title={sw ? 'Thibitisha utambulisho' : 'Verify identity'}
              onPress={() =>
                void run(async () => {
                  if (preview)
                    throw new Error(
                      sw
                        ? 'Uhakiki wa majaribio pekee; unasubiri msimamizi.'
                        : 'Preview verification only; administrator review pending.',
                    );
                  const result = await api('/drivers/identity', {});
                  if (result.url) await Linking.openURL(result.url);
                  await load();
                })
              }
            />
          )}
          <Text>
            {sw ? 'Gari' : 'Vehicle'}: {a.vehicle_approval} ·{' '}
            {sw ? 'Leseni' : 'Licence'}: {a.licence_approval || 'pending'}
          </Text>
          {
            <Button
              title={sw ? 'Tumia gari hili' : 'Use this vehicle'}
              disabled={
                busy ||
                preview ||
                a.vehicle_approval !== 'approved' ||
                a.licence_approval !== 'approved' ||
                cargoOnly(a.category)
              }
              onPress={() =>
                void run(async () => {
                  await call('/assignments/' + a.id + '/activate', {});
                  await load();
                  onActivated();
                })
              }
            />
          }
        </View>
      ))}
      {!preview && (
        <SubscriptionPayments
          visible={!!payVehicle}
          vehicleId={payVehicle}
          onClose={() => setPayVehicle(undefined)}
          language={language}
          phone={phone}
          onPaid={async () => {
            await load();
          }}
          periodMonths={period}
          onPeriodChange={setPeriod}
        />
      )}
    </View>
  );
}
