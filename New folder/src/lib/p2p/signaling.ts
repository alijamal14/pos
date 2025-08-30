import LZString from 'lz-string';

export function encodePayload(obj: any): string {
  const s = JSON.stringify(obj);
  try {
    const c = LZString.compressToBase64(s);
    return 'lz:' + c;
  } catch (e) {
    return btoa(unescape(encodeURIComponent(s)));
  }
}

export function decodePayload(text: string): any {
  if (!text) throw new Error('Empty payload');
  try {
    if (text.startsWith('lz:')) {
      const dec = LZString.decompressFromBase64(text.slice(3));
      if (!dec) throw new Error('Decompression failed');
      return JSON.parse(dec);
    }
    // assume base64
    const json = decodeURIComponent(escape(atob(text)));
    return JSON.parse(json);
  } catch (e) {
    throw new Error('Failed to decode payload: ' + (e as Error).message);
  }
}
