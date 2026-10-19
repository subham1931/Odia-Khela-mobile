import { GoogleSignin } from '@react-native-google-signin/google-signin';

/** Web OAuth client ID from Firebase / Google Cloud (client_type: 3). */
export const GOOGLE_WEB_CLIENT_ID =
  '621817041502-c42cnq2l158vbn3jv4a14nfssnotpt2o.apps.googleusercontent.com';

let configured = false;

export function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}
