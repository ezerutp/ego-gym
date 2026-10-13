import Constants from 'expo-constants';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { compareVersions, fetchLatestRelease, type LatestRelease } from '@/features/updates/lib/github';
import { downloadApk, downloadedApk, installApk, openUnknownSources } from '@/features/updates/lib/installApk';
import { makeStyles, spacing, useTheme } from '@/theme';

type Props = { owner: string; repo: string; onOwner: (v: string) => void; onRepo: (v: string) => void };

/** Checks GitHub releases for a newer APK and installs it. Updating keeps every local record. */
export function UpdatesSection({ owner, repo, onOwner, onRepo }: Props) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const installed = Constants.expoConfig?.version ?? '?';
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [found, setFound] = useState(false);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  const check = async () => {
    const cleanOwner = owner.trim();
    const cleanRepo = repo.trim().replace(/\.git$/, '');
    if (!cleanOwner || !cleanRepo) return setMessage('Escribe el dueño y el repositorio primero.');
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
      <Field label="Dueño de GitHub" value={owner} onChangeText={onOwner} autoCapitalize="none" autoCorrect={false} placeholder="Ej.: ezerutp" />
      <Field label="Repositorio" value={repo} onChangeText={onRepo} autoCapitalize="none" autoCorrect={false} placeholder="Ej.: ego-gym" />
      <Button title="Buscar actualización" icon="refresh" variant="secondary" loading={checking} onPress={check} />
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
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: colors.primary },
  }),
);
