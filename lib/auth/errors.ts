import { statusCodes } from '@react-native-google-signin/google-signin';

export type AuthFlowErrorCode =
  | 'cancelled'
  | 'play_services'
  | 'missing_id_token'
  | 'firebase'
  | 'unknown';

export class AuthFlowError extends Error {
  readonly code: AuthFlowErrorCode;

  constructor(code: AuthFlowErrorCode, message: string) {
    super(message);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}

export function mapAuthError(error: unknown): AuthFlowError {
  if (error instanceof AuthFlowError) return error;

  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Something went wrong while signing in.';

  if (code === statusCodes.SIGN_IN_CANCELLED || code === 'SIGN_IN_CANCELLED') {
    return new AuthFlowError('cancelled', 'Google Sign-In was cancelled.');
  }
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE || code === 'PLAY_SERVICES_NOT_AVAILABLE') {
    return new AuthFlowError(
      'play_services',
      'Google Play Services is unavailable or outdated on this device.',
    );
  }
  if (code.startsWith('auth/') || message.toLowerCase().includes('firebase')) {
    return new AuthFlowError('firebase', message || 'Firebase authentication failed.');
  }

  return new AuthFlowError('unknown', message);
}

export function authErrorMessage(error: unknown): string {
  return mapAuthError(error).message;
}
