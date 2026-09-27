import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Chips } from '@/components/Chips';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { clearToken, getToken, saveToken } from '@/lib/auth';
import { formatPeso } from '@/lib/format';
import { MARKETS, type Commodity, type MarketKey } from '@/lib/types';

/**
 * Manual price entry, the interim source while scrapers are finalized. Submissions go through the
 * same backend change-detection path: an unchanged price is acknowledged but not broadcast.
 */
export default function AdminScreen() {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getToken().then(setToken);
  }, []);

  if (token === undefined) return <ActivityIndicator color={Colors.accent} style={{ flex: 1 }} />;
  if (!token) return <LoginForm onLogin={setToken} />;
  return (
    <PriceEntryForm
      token={token}
      onLogout={async () => {
        await clearToken();
        setToken(null);
      }}
    />
  );
}

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { token, expiresAt } = await api.login(username.trim(), password);
      await saveToken(token, expiresAt);
      onLogin(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.form}>
        <Text style={styles.help}>Admins can enter Davao market prices manually.</Text>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="Sign in" onPress={submit} busy={busy} disabled={!username || !password} />
      </View>
    </KeyboardAvoidingView>
  );
}

function PriceEntryForm({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [catalog, setCatalog] = useState<Commodity[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Commodity | null>(null);
  const [market, setMarket] = useState<MarketKey>('bankerohan');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    api.catalog().then(setCatalog, (e: Error) => setMessage({ text: e.message, ok: false }));
  }, []);

  const q = query.trim().toLowerCase();
  const matches = catalog.filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.includes(q));
  const numeric = Number(price);
  const valid = selected && price.trim() !== '' && Number.isFinite(numeric) && numeric > 0;

  const submit = async () => {
    if (!selected || !valid) return;
    setBusy(true);
    setMessage(null);
    try {
      const { result } = await api.submitPrice(token, { commodityId: selected.id, marketLocation: market, price: numeric });
      setMessage(
        result.status === 'changed'
          ? {
              ok: true,
              text: `Published ${selected.name}: ${result.previousPrice ? `${formatPeso(result.previousPrice)} → ` : ''}${formatPeso(result.price)}`,
            }
          : { ok: true, text: `No change: ${selected.name} is already ${formatPeso(result.price)}. Nothing was broadcast.` },
      );
      setPrice('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onLogout();
      setMessage({ text: e instanceof Error ? e.message : 'Submit failed', ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.form}>
        {selected ? (
          <Pressable onPress={() => setSelected(null)} style={styles.selected}>
            <Text style={styles.selectedName}>{selected.name}</Text>
            <Text style={styles.link}>Change</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Find commodity"
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            <FlatList
              style={styles.picker}
              data={matches}
              keyExtractor={(c) => String(c.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.pickerItem} onPress={() => setSelected(item)}>
                  <Text style={styles.pickerText}>{item.name}</Text>
                  <Text style={styles.pickerMeta}>
                    {item.category} · /{item.unit}
                  </Text>
                </Pressable>
              )}
            />
          </>
        )}
      </View>

      <View>
        <Chips
          options={Object.entries(MARKETS).map(([value, label]) => ({ value: value as MarketKey, label }))}
          value={market}
          onChange={setMarket}
        />
      </View>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, styles.priceInput]}
          placeholder={`Price in ₱${selected ? ` per ${selected.unit}` : ''}`}
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
        />
        {message && <Text style={message.ok ? styles.success : styles.error}>{message.text}</Text>}
        <Button label="Submit price" onPress={submit} busy={busy} disabled={!valid} />
        <Pressable onPress={onLogout} style={styles.logout}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Button({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[styles.button, (busy || disabled) && { opacity: 0.5 }]}
      accessibilityRole="button">
      {busy ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, paddingTop: Spacing.lg, gap: Spacing.lg },
  form: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  help: { color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surfaceRaised,
    color: Colors.text,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  priceInput: { fontFamily: Fonts.mono, fontSize: 22 },
  picker: { maxHeight: 220, backgroundColor: Colors.surface, borderRadius: 8 },
  pickerItem: { padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  pickerText: { color: Colors.text, fontSize: 15 },
  pickerMeta: { color: Colors.textSecondary, fontSize: 12 },
  selected: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
  },
  selectedName: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  link: { color: Colors.accent, fontWeight: '600' },
  button: { backgroundColor: Colors.accent, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.background, fontWeight: '700', fontSize: 16 },
  error: { color: Colors.down },
  success: { color: Colors.up },
  logout: { alignSelf: 'center', padding: Spacing.sm },
});
