import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field } from '@/components/ui';
import { getSettings, saveSettings } from '@/db/settings';
import { compareVersions, fetchLatestRelease, type LatestRelease } from '@/features/updates/lib/github';
import { downloadApk, downloadedApk, installApk, openUnknownSources } from '@/features/updates/lib/installApk';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

/** Checks GitHub releases for a newer APK and installs it. Updating keeps every local record. */
export function UpdatesSection({ onChanged }: { onChanged: () => void }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const installed = Constants.expoConfig?.version ?? '?';
  const { data: saved, reload: reloadRepo } = useFocusQuery((db) => getSettings(db));
  const owner = saved?.updateOwner ?? '';
  const repo = saved?.updateRepo ?? '';
  const [editing, setEditing] = useState(false);
  const [draftOwner, setDraftOwner] = useState('');
  const [draftRepo, setDraftRepo] = useState('');
  const [savingRepo, setSavingRepo] = useState(false);
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [found, setFound] = useState(false);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  const openEditor = () => {
    setDraftOwner(owner);
    setDraftRepo(repo);
    setEditing(true);
  };

  const saveRepo = async () => {
    const cleanOwner = draftOwner.trim();
    const cleanRepo = draftRepo.trim().replace(/\.git$/, '');
    if (!cleanOwner || !cleanRepo) return Alert.alert('Falta el repositorio', 'Escribe el dueño y el repositorio.');
    setSavingRepo(true);
    try {
      await saveSettings(db, { updateOwner: cleanOwner, updateRepo: cleanRepo });
      await reloadRepo();
      setEditing(false);
      onChanged();
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e));
    } finally {
      setSavingRepo(false);
    }
  };

  const check = async () => {
    const cleanOwner = owner.trim();
    const cleanRepo = repo.trim().replace(/\.git$/, '');
    if (!cleanOwner || !cleanRepo) {
      setMessage('Primero configura el repositorio con Editar.');
      return;
    }
    setChecking(true);
    setMessage('');
    setRelease(null);
    setFound(false);
    setReady(false);
    setProgress(0);
    try {
      const latest = await fetchLatestRelease(cleanOwner, cleanRepo);
      setRelease(latest);
      setFound(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  const download = async () => {
    if (!release) return;
    setDownloading(true);
    setMessage('');
    try {
      await downloadApk(release.apkUrl, (written, total) => setProgress(total > 0 ? written / total : 0));
      setProgress(1);
      setReady(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  const install = async () => {
    const file = downloadedApk();
    if (!file) return setMessage('El APK ya no está. Descárgalo de nuevo.');
    try {
      await installApk(file.uri);
    } catch (e) {
      setMessage(`No se pudo abrir el instalador. Permite instalar apps desconocidas y vuelve a intentar (${e instanceof Error ? e.message : String(e)}).`);
    }
  };

  const allow = () => {
    const pkg = Constants.expoConfig?.android?.package;
    if (!pkg) return setMessage('No se encontró el paquete de la app.');
    openUnknownSources(pkg).catch((e) => setMessage(String(e)));
  };

  const isNewer = !!release && compareVersions(installed, release.tag) < 0;

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={font.small}>Versión instalada: {installed}. Al actualizar se conservan todos los datos de la tablet.</Text>
      {!!owner && !!repo && (
        <Text style={font.small}>
          Repositorio: {owner}/{repo}
        </Text>
      )}
      <View style={styles.buttons}>
        <Button title="Editar" icon="pencil" variant="secondary" onPress={openEditor} style={styles.button} />
        <Button title="Buscar actualización" icon="refresh" loading={checking} onPress={check} style={styles.button} />
      </View>
      {!!message && <Text style={[font.small, { color: colors.danger }]}>{message}</Text>}
      {!message && found && !release && <Text style={font.small}>El repositorio aún no tiene releases.</Text>}
      {release && !isNewer && <Text style={font.small}>Ya tienes la última versión ({release.tag}).</Text>}
      {release && isNewer && (
        <View style={{ gap: spacing.md }}>
          <View>
            <Text style={font.h3}>
              {release.title} ({(release.apkSize / 1048576).toFixed(1)} MB)
            </Text>
            {!!release.notes && (
              <Text style={font.small} numberOfLines={6}>
                {release.notes}
              </Text>
            )}
          </View>
          {(downloading || ready) && (
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}
          {!ready ? (
            <Button title="Descargar" icon="download-outline" loading={downloading} onPress={download} />
          ) : (
            <>
              <Button title="Instalar actualización" icon="checkmark" onPress={install} />
              <Text style={font.small}>Android pide una sola vez permitir instalar apps desconocidas para EGO Gym.</Text>
              <Button title="Abrir ese permiso" variant="ghost" onPress={allow} />
            </>
          )}
        </View>
      )}

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.overlay}>
          <Card style={styles.dialog}>
            <Text style={font.h3}>Repositorio de actualizaciones</Text>
            <Text style={font.small}>De sus releases con APK se descarga la actualización.</Text>
            <Field label="Dueño de GitHub" value={draftOwner} onChangeText={setDraftOwner} autoCapitalize="none" autoCorrect={false} placeholder="Ej.: ezerutp" />
            <Field label="Repositorio" value={draftRepo} onChangeText={setDraftRepo} autoCapitalize="none" autoCorrect={false} placeholder="Ej.: ego-gym" />
            <View style={styles.buttons}>
              <Button title="Cancelar" variant="secondary" onPress={() => setEditing(false)} style={styles.button} />
              <Button title="Guardar" icon="checkmark" loading={savingRepo} onPress={saveRepo} style={styles.button} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    buttons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    button: { flexGrow: 1, flexBasis: 180 },
    bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: colors.primary },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    dialog: { width: '100%', maxWidth: 440, gap: spacing.md },
  }),
);
