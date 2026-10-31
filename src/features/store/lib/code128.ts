const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const CODE_C = 99;
const START_B = 104;
const START_C = 105;
const STOP = 106;
const QUIET_ZONE = 10;

/** Symbol values: text in set B, and a trailing even run of 4+ digits in set C so labels stay short. */
function encode(text: string) {
  if (!/^[\x20-\x7E]+$/.test(text)) throw new Error(`Código no válido para Code128: ${text}`);
  const digits = text.match(/\d*$/)![0];
  const runLength = digits.length - (digits.length % 2);
  const head = runLength >= 4 ? text.slice(0, text.length - runLength) : text;
  const tail = runLength >= 4 ? text.slice(head.length) : '';

  const values: number[] = [head ? START_B : START_C];
  for (const ch of head) values.push(ch.charCodeAt(0) - 32);
  if (head && tail) values.push(CODE_C);
  for (let i = 0; i < tail.length; i += 2) values.push(Number(tail.slice(i, i + 2)));

  const checksum = values.reduce((sum, v, i) => sum + v * (i || 1), 0) % 103;
  return [...values, checksum, STOP];
}

/** Bar widths in modules, alternating bar/space and starting with a bar; `left` includes the quiet zone. */
export function code128Bars(text: string) {
  const widths = encode(text).flatMap((v) => PATTERNS[v].split('').map(Number));
  const bars: { left: number; width: number }[] = [];
  let x = QUIET_ZONE;
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ left: x, width: w });
    x += w;
  });
  return { bars, modules: x + QUIET_ZONE };
}
