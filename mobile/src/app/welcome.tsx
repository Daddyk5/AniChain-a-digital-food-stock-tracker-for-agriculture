import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { WELCOME_SLIDES } from '@/constants/welcomePhotos';
import { markWelcomeSeen } from '@/lib/onboarding';

// Wikimedia asks API/media clients to identify themselves.
const PHOTO_USER_AGENT = 'AniChain/1.0 (Davao market price tracker; mobile app)';

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const last = index === WELCOME_SLIDES.length - 1;

  const finish = () => {
    markWelcomeSeen();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.screen}>
      <FlatList
        ref={list}
        data={WELCOME_SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.photo.sourceUrl}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            {/* Shown while the photo loads, or if Wikimedia is unreachable on this network. */}
            <LinearGradient
              colors={[item.tint, Colors.background]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 0.7 }}
              style={StyleSheet.absoluteFill}
            />
            <Image
              source={{ uri: item.photo.uri, headers: { 'User-Agent': PHOTO_USER_AGENT } }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
              cachePolicy="disk"
              accessibilityLabel={item.photo.title}
            />
            <LinearGradient
              colors={['rgba(11,14,17,0.55)', 'rgba(11,14,17,0.1)', 'rgba(11,14,17,0.85)', Colors.background]}
              locations={[0, 0.3, 0.62, 0.82]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.copy, { paddingBottom: insets.bottom + 132 }]}>
              <Text style={styles.heading}>{item.heading}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync(item.photo.sourceUrl)}
                accessibilityRole="link"
                accessibilityLabel={`Photo credit: ${item.photo.title} by ${item.photo.author}, ${item.photo.license}. Opens Wikimedia Commons.`}>
                <Text style={styles.credit}>
                  Photo: {item.photo.title} · {item.photo.author} · {item.photo.license} · Wikimedia Commons
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <View style={[styles.brand, { top: insets.top + Spacing.lg }]} pointerEvents="none">
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" />
        <Text style={styles.brandText}>AniChain</Text>
        <Text style={styles.brandTag}>DAVAO</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.dots}>
          {WELCOME_SLIDES.map((s, i) => (
            <View key={s.photo.sourceUrl} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" style={{ opacity: last ? 0 : 1 }} disabled={last}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
          <Pressable
            style={styles.primary}
            accessibilityRole="button"
            onPress={() => {
              if (last) return finish();
              list.current?.scrollToIndex({ index: index + 1 });
              setIndex(index + 1);
            }}>
            <Text style={styles.primaryText}>{last ? 'See today’s prices' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  copy: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  heading: { color: Colors.text, fontSize: 30, fontWeight: '800', lineHeight: 36 },
  body: { color: Colors.text, fontSize: 16, lineHeight: 23, opacity: 0.85 },
  credit: { color: Colors.textSecondary, fontSize: 11, marginTop: Spacing.sm, textDecorationLine: 'underline' },
  brand: { position: 'absolute', left: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { width: 34, height: 34 },
  brandText: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  brandTag: {
    color: Colors.background,
    backgroundColor: Colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textMuted },
  dotActive: { width: 22, backgroundColor: Colors.accent },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },
  primary: { backgroundColor: Colors.accent, paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: 8 },
  primaryText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
});
