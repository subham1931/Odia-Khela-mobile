import * as ScreenOrientation from 'expo-screen-orientation';

/** Unlock first, then lock — iOS 16+ often ignores a bare lockAsync after a landscape screen. */
export async function forceOrientation(
  lock: ScreenOrientation.OrientationLock,
): Promise<void> {
  try {
    await ScreenOrientation.unlockAsync();
  } catch {
    /* ignore */
  }
  try {
    await ScreenOrientation.lockAsync(lock);
  } catch {
    /* Expo Go / web may ignore */
  }
}

/** Let the device rotate freely (portrait or landscape). */
export async function unlockOrientation(): Promise<void> {
  try {
    await ScreenOrientation.unlockAsync();
  } catch {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
    } catch {
      /* Expo Go / web may ignore */
    }
  }
}

export const portraitUp = () => forceOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
export const landscape = () => forceOrientation(ScreenOrientation.OrientationLock.LANDSCAPE);
