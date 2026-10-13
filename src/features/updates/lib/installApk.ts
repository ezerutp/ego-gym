import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';
import { Platform } from 'react-native';

const APK_NAME = 'ego-gym-update.apk';
const APK_MIME = 'application/vnd.android.package-archive';

function updatesDir() {
  const dir = new Directory(Paths.cache, 'updates');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

export function downloadedApk() {
  const file = new File(updatesDir(), APK_NAME);
  return file.exists ? file : null;
}

/** Downloads the release APK into the cache, reporting progress. Throws when canceled. */
export async function downloadApk(url: string, onProgress: (written: number, total: number) => void) {
  const dest = new File(updatesDir(), APK_NAME);
  if (dest.exists) dest.delete();
  const task = File.createDownloadTask(url, dest, { onProgress: ({ bytesWritten, totalBytes }) => onProgress(bytesWritten, totalBytes) });
  const file = await task.downloadAsync();
  if (!file) throw new Error('La descarga se canceló.');
  return file;
}

/** Opens the system installer for a downloaded APK. Needs "install unknown apps" allowed once. */
export async function installApk(uri: string) {
  if (Platform.OS !== 'android') throw new Error('La instalación directa solo funciona en Android.');
  const contentUri = await getContentUriAsync(uri);
  await startActivityAsync('android.intent.action.VIEW', { data: contentUri, type: APK_MIME, flags: 1 });
}

/** Opens the per-app "install unknown apps" toggle for this package. */
export function openUnknownSources(packageName: string) {
  return startActivityAsync(ActivityAction.MANAGE_UNKNOWN_APP_SOURCES, { data: `package:${packageName}` });
}
