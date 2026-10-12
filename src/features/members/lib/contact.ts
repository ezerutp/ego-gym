import { Directory, File, Paths } from 'expo-file-system';
import { Linking } from 'react-native';

import { parseIsoDay } from '@/lib/format';

const COUNTRY_CODE = '51';

/** Accepts local Peruvian mobiles (9 digits) or numbers that already include the country code. */
export function whatsappNumber(phone: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 9) return COUNTRY_CODE + digits;
  return digits.length >= 10 ? digits : null;
}

export async function openWhatsApp(phone: string | null, text = '') {
  const number = whatsappNumber(phone);
  if (!number) return false;
  await Linking.openURL(`https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
  return true;
}

export function callPhone(phone: string) {
  return Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

export function ageFrom(birthDate: string) {
  const birth = parseIsoDay(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

export function describeAge(birthDate: string) {
  const age = ageFrom(birthDate);
  return `${age} ${age === 1 ? 'año' : 'años'}`;
}

function photosDir() {
  const dir = new Directory(Paths.document, 'member-photos');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/** Picker results live in the cache and can be cleared by Android, so photos are copied to app storage. */
export async function persistMemberPhoto(uri: string) {
  if (uri.includes('/member-photos/')) return uri;
  const dest = new File(photosDir(), `member-${Date.now()}.jpg`);
  await new File(uri).copy(dest);
  return dest.uri;
}
