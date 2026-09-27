import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useLive } from './LiveProvider';

const LABEL = { live: 'LIVE', connecting: 'CONNECTING', offline: 'OFFLINE' } as const;
const COLOR = { live: Colors.up, connecting: Colors.accent, offline: Colors.down } as const;

export function ConnectionBadge() {
  const { status } = useLive();
  return (
    <View style={styles.wrap} accessibilityLabel={`Connection ${LABEL[status].toLowerCase()}`}>
      <View style={[styles.dot, { backgroundColor: COLOR[status] }]} />
      <Text style={[styles.text, { color: COLOR[status] }]}>{LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
