import { Directory, File, Paths } from 'expo-file-system';

/** Open Food Facts and its sister projects share the same API; each covers a different kind of product. */
export const PRODUCT_SOURCES = [
  { id: 'openfoodfacts', name: 'Open Food Facts', description: 'Alimentos y bebidas', host: 'world.openfoodfacts.org' },
  { id: 'openbeautyfacts', name: 'Open Beauty Facts', description: 'Cuidado personal: shampoo, jabón, pasta dental', host: 'world.openbeautyfacts.org' },
  { id: 'openproductsfacts', name: 'Open Products Facts', description: 'Limpieza y otros: detergente, lejía, pilas', host: 'world.openproductsfacts.org' },
] as const;

export type ProductSourceId = (typeof PRODUCT_SOURCES)[number]['id'];

export type RemoteProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  quantityLabel: string | null;
  imageUrl: string | null;
  source: ProductSourceId;
  sourceName: string;
};

const FIELDS = 'product_name,product_name_es,generic_name_es,brands,quantity,image_front_url,image_url';

/**
 * Looks the barcode up in the enabled sources at once (so it takes no longer than the slowest one)
 * and returns the first match in priority order: food, personal care, then household products.
 */
export async function lookupBarcode(barcode: string, enabled: readonly ProductSourceId[]): Promise<RemoteProduct | null> {
  const sources = PRODUCT_SOURCES.filter((s) => enabled.includes(s.id));
  const results = await Promise.all(sources.map((source) => lookupIn(source, barcode)));
  return results.find((r) => r !== null) ?? null;
}

async function lookupIn(source: (typeof PRODUCT_SOURCES)[number], barcode: string): Promise<RemoteProduct | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://${source.host}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': 'BodegaScan/1.0 (Android; contacto@bodegascan.pe)' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name: string = (p.product_name_es || p.product_name || p.generic_name_es || '').trim();
    if (!name) return null;
    return {
      barcode,
      name,
      brand: firstBrand(p.brands),
      quantityLabel: p.quantity?.trim() || null,
      imageUrl: p.image_front_url || p.image_url || null,
      source: source.id,
      sourceName: source.name,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function firstBrand(brands: unknown) {
  if (typeof brands !== 'string') return null;
  return brands.split(',')[0]?.trim() || null;
}

function imagesDir() {
  const dir = new Directory(Paths.document, 'product-images');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/** Keeps a local copy so the inventory works without internet. */
export async function downloadProductImage(url: string, barcode: string) {
  try {
    const dest = new File(imagesDir(), `${barcode}-${Date.now()}.jpg`);
    const file = await File.downloadFileAsync(url, dest);
    return file.uri;
  } catch {
    return url;
  }
}

/** Moves a photo taken with the camera/picker out of the cache into permanent storage. */
export async function persistLocalImage(uri: string, barcode: string) {
  if (uri.startsWith('http') || uri.includes('/product-images/')) return uri;
  const source = new File(uri);
  const dest = new File(imagesDir(), `${barcode}-${Date.now()}.jpg`);
  await source.copy(dest);
  return dest.uri;
}
