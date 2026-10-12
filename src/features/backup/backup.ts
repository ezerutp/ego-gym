import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDb } from '@/db/schema';
import { saveSettings } from '@/db/settings';

const SQLITE_HEADER = 'SQLite format 3\0';
const RESTORE_NAME = 'restaurar.db';

function backupsDir() {
  const dir = new Directory(Paths.document, 'backups');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/** expo-sqlite takes a plain directory path, not a file:// URI. */
function dirPath(dir: Directory) {
  return decodeURIComponent(dir.uri.replace(/^file:\/\//, '')).replace(/\/$/, '');
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Copies the live database with SQLite's backup API (safe while the app is using it) and opens the share sheet. */
export async function exportBackup(db: SQLiteDatabase) {
  const dir = backupsDir();
  const name = `ego-gym-respaldo-${stamp()}.db`;
  const file = new File(dir, name);
  if (file.exists) file.delete();
  const dest = await SQLite.openDatabaseAsync(name, {}, dirPath(dir));
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: db, destDatabase: dest });
  } finally {
    await dest.closeAsync();
  }
  await saveSettings(db, { lastBackupAt: new Date().toISOString() });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Guardar respaldo de EGO Gym' });
  }
  return file.uri;
}

export class BackupError extends Error {}

/**
 * Replaces every table with the picked backup. The backup is migrated first, so an older
 * copy still restores into the current schema. Returns false when the picker was canceled.
 */
export async function restoreBackup(db: SQLiteDatabase) {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return false;

  const bytes = await picked.result.bytes();
  const header = String.fromCharCode(...bytes.slice(0, SQLITE_HEADER.length));
  if (header !== SQLITE_HEADER) throw new BackupError('El archivo elegido no es un respaldo de EGO Gym.');

  const dir = backupsDir();
  const copy = new File(dir, RESTORE_NAME);
  if (copy.exists) copy.delete();
  copy.create();
  copy.write(bytes);

  const source = await SQLite.openDatabaseAsync(RESTORE_NAME, {}, dirPath(dir));
  try {
    const tables = await source.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
    const names = new Set(tables.map((t) => t.name));
    if (!names.has('products') || !names.has('settings')) throw new BackupError('El archivo no tiene los datos de EGO Gym.');
    await migrateDb(source);
    await SQLite.backupDatabaseAsync({ sourceDatabase: source, destDatabase: db });
  } finally {
    await source.closeAsync();
    copy.delete();
  }
  return true;
}
