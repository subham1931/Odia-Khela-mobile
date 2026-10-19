import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';

/** Compact top-right profile control after Google → Firebase sign-in. */
export function ProfileAvatarButton() {
  const insets = useSafeAreaInsets();
  const { user, busy, error, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const initial = (user.displayName || user.email || '?').slice(0, 1).toUpperCase();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.avatarBtn,
          { top: insets.top + 6, right: 16 },
          pressed && styles.pressed,
        ]}
      >
        {user.photoURL ? (
          <Image source={{ uri: user.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { marginTop: insets.top + 56 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              {user.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.sheetAvatar} />
              ) : (
                <View style={[styles.sheetAvatar, styles.avatarFallback]}>
                  <Text style={styles.sheetAvatarLetter}>{initial}</Text>
                </View>
              )}
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {user.displayName || 'Signed in'}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {user.email || '—'}
                </Text>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.logout,
                (pressed || busy) && styles.pressed,
              ]}
              disabled={busy}
              onPress={() => {
                void (async () => {
                  await signOut();
                  setOpen(false);
                })();
              }}
            >
              {busy ? (
                <ActivityIndicator color={colors.amber100} />
              ) : (
                <Text style={styles.logoutText}>Sign out</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatarBtn: {
    position: 'absolute',
    zIndex: 20,
    elevation: 20,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.brass,
  },
  avatarFallback: {
    backgroundColor: colors.wood700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 14,
    color: colors.amber100,
  },
  pressed: { opacity: 0.85 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: colors.wood900,
    padding: 16,
    gap: 14,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brassDim,
  },
  sheetAvatarLetter: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 18,
    color: colors.amber100,
  },
  meta: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 16,
    color: colors.amber50,
  },
  email: {
    marginTop: 2,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 13,
    color: colors.textMuted,
  },
  error: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 13,
    color: colors.rose,
  },
  logout: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brassDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 14,
    color: colors.amber100,
  },
});
