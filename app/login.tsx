import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { JuteBackground } from '@/components/JuteBackground';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';

function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/** Temporary screen to exercise Google → Firebase Auth. */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, user, busy, error, clearError, signInWithGoogle, signOut } = useAuth();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const onGoogle = useCallback(async () => {
    clearError();
    try {
      await signInWithGoogle();
    } catch {
      // Error message is surfaced via context; cancel is silent.
    }
  }, [clearError, signInWithGoogle]);

  if (status === 'loading') {
    return (
      <View style={[styles.root, styles.center]}>
        <JuteBackground />
        <ActivityIndicator color={colors.brass} size="large" />
      </View>
    );
  }

  if (status === 'authenticated' && user) {
    return <Redirect href="/" />;
  }

  return (
    <View
      style={[
        styles.root,
        styles.center,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
        },
      ]}
    >
      <JuteBackground />
      <View style={styles.content}>
        <Text style={styles.brand}>Odia Khela</Text>
        <Text style={styles.title}>Sign in to continue</Text>
        <Text style={styles.sub}>Temporary Google Sign-In test screen</Text>

        <Pressable
          style={({ pressed }) => [
            styles.googleBtn,
            (pressed || busy) && styles.googleBtnPressed,
          ]}
          onPress={onGoogle}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.wood950} />
          ) : (
            <View style={styles.googleBtnInner}>
              <GoogleMark size={20} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </View>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={() => void signOut()} disabled={busy} style={styles.linkWrap}>
          <Text style={styles.link}>Reset Google / Firebase session</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  brand: {
    fontFamily: 'CormorantGaramond_700Bold',
    fontSize: 44,
    color: colors.amber50,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  title: {
    marginTop: 20,
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 20,
    color: colors.amber100,
    textAlign: 'center',
  },
  sub: {
    marginTop: 8,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  googleBtn: {
    marginTop: 36,
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleBtnPressed: { opacity: 0.85 },
  googleBtnText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 16,
    color: colors.wood950,
  },

  error: {
    marginTop: 16,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 14,
    color: colors.rose,
    textAlign: 'center',
  },
  linkWrap: { marginTop: 28 },
  link: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 13,
    color: colors.textFaint,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
