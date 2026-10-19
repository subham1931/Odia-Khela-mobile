import {
  GoogleAuthProvider,
  getAuth,
  signInWithCredential,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { configureGoogleSignIn } from '@/lib/auth/config';
import { AuthFlowError } from '@/lib/auth/errors';

/**
 * Google Sign-In → ID token → Firebase credential → Firebase session.
 */
export async function signInWithGoogleFirebase(): Promise<void> {
  configureGoogleSignIn();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    throw new AuthFlowError('cancelled', 'Google Sign-In was cancelled.');
  }

  let idToken = response.data.idToken;
  if (!idToken) {
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens.idToken;
  }
  if (!idToken) {
    throw new AuthFlowError(
      'missing_id_token',
      'Google Sign-In did not return an ID token. Check webClientId configuration.',
    );
  }

  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(getAuth(), credential);
}

export async function signOutGoogleAndFirebase(): Promise<void> {
  configureGoogleSignIn();
  try {
    await firebaseSignOut(getAuth());
  } finally {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore Google sign-out failures after Firebase session is cleared.
    }
  }
}
