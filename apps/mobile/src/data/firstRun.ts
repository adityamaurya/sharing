import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Has this person seen the walkthrough?
 *
 * Kept behind two functions so the storage mechanism is a detail. When accounts
 * arrive this moves to a column on the profile — a walkthrough that reappears
 * because somebody reinstalled after a phone reset is a small insult, and the
 * fix belongs on the server, not the device.
 *
 * Failures are swallowed on purpose. If storage is unavailable the worst outcome
 * is the walkthrough showing again; refusing to open the app over it would be
 * absurd.
 */

const KEY = 'sharing.walkthroughSeen.v1';

export async function hasSeenWalkthrough(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'yes';
  } catch {
    return false;
  }
}

export async function markWalkthroughSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'yes');
  } catch {
    // See above: not worth surfacing.
  }
}
