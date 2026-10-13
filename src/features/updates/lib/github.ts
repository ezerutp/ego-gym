const API = 'https://api.github.com';
const TIMEOUT_MS = 20_000;

export class UpdatesError extends Error {}

type ReleaseAsset = { name: string; browser_download_url: string; size: number };

type Release = { tag_name: string; name: string | null; body: string | null; assets: ReleaseAsset[] };

export type LatestRelease = { tag: string; title: string; notes: string; apkUrl: string; apkSize: number };

/** Latest GitHub release with an APK asset, or null when the repo has no releases yet. */
export async function fetchLatestRelease(owner: string, repo: string): Promise<LatestRelease | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/repos/${owner}/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (res.status === 403) throw new UpdatesError('GitHub limitó las consultas. Espera unos minutos e inténtalo de nuevo.');
    if (!res.ok) throw new UpdatesError(`GitHub respondió ${res.status}. Revisa el dueño y el repositorio.`);
    const json = (await res.json()) as Release;
    const apk = json.assets.find((a) => a.name.endsWith('.apk'));
    if (!apk) throw new UpdatesError(`El release ${json.tag_name} no trae ningún APK.`);
    return { tag: json.tag_name, title: json.name || json.tag_name, notes: json.body || '', apkUrl: apk.browser_download_url, apkSize: apk.size };
  } catch (e) {
    if (e instanceof UpdatesError) throw e;
    if (controller.signal.aborted) throw new UpdatesError('GitHub no respondió a tiempo. Revisa la conexión a internet.');
    throw new UpdatesError(`No se pudo consultar GitHub (${e instanceof Error ? e.message : String(e)}).`);
  } finally {
    clearTimeout(timer);
  }
}

function parts(version: string) {
  return version.replace(/^v/i, '').split('.').map((p) => parseInt(p, 10) || 0);
}

/** Negative when `tag` is newer than `installed`, zero when equal, positive when older. */
export function compareVersions(installed: string, tag: string) {
  const a = parts(installed);
  const b = parts(tag);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
}
