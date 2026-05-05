import { requireNativeModule } from 'expo-modules-core';

let NativeModule = null;
try {
  NativeModule = requireNativeModule('ExpoTextOcr');
} catch {
  NativeModule = null;
}

export async function ocrImage(uri) {
  if (!NativeModule) return null;
  try {
    const text = (await NativeModule.recognize(uri))?.trim();
    return text || null;
  } catch (e) {
    console.warn('OCR failed:', e);
    return null;
  }
}
