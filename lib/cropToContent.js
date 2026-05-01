import { encode as encodeBase64 } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { AlphaType, ColorType, ImageFormat, Skia } from '@shopify/react-native-skia';

const CROP_SCAN = 64;

export async function cropToContent(uri) {
  const data = await Skia.Data.fromURI(uri);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) return uri;

  const W = img.width();
  const H = img.height();

  const scanSurf = Skia.Surface.Make(CROP_SCAN, CROP_SCAN);
  if (!scanSurf) return uri;
  const scanCanvas = scanSurf.getCanvas();
  scanCanvas.drawImageRect(img, Skia.XYWHRect(0, 0, W, H), Skia.XYWHRect(0, 0, CROP_SCAN, CROP_SCAN), Skia.Paint());
  scanSurf.flush();
  const pixels = scanSurf.makeImageSnapshot().readPixels(0, 0, {
    width: CROP_SCAN, height: CROP_SCAN,
    colorType: ColorType.Alpha_8,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) return uri;

  let minX = CROP_SCAN, minY = CROP_SCAN, maxX = -1, maxY = -1;
  for (let y = 0; y < CROP_SCAN; y++) {
    for (let x = 0; x < CROP_SCAN; x++) {
      if (pixels[y * CROP_SCAN + x] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX === -1) return uri;

  const ox = Math.floor(minX / CROP_SCAN * W);
  const oy = Math.floor(minY / CROP_SCAN * H);
  const ex = Math.ceil((maxX + 1) / CROP_SCAN * W);
  const ey = Math.ceil((maxY + 1) / CROP_SCAN * H);

  const cX = (ox + ex) / 2;
  const cY = (oy + ey) / 2;
  const cropSize = Math.min(
    Math.ceil(Math.max(ex - ox, ey - oy) * 1.1),
    W, H
  );
  const cropX = Math.max(0, Math.min(W - cropSize, Math.round(cX - cropSize / 2)));
  const cropY = Math.max(0, Math.min(H - cropSize, Math.round(cY - cropSize / 2)));

  const outSurf = Skia.Surface.Make(cropSize, cropSize);
  if (!outSurf) return uri;
  outSurf.getCanvas().drawImageRect(
    img,
    Skia.XYWHRect(cropX, cropY, cropSize, cropSize),
    Skia.XYWHRect(0, 0, cropSize, cropSize),
    Skia.Paint()
  );
  outSurf.flush();

  const bytes = outSurf.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);
  if (!bytes) return uri;

  const b64 = encodeBase64(bytes.buffer);
  const outPath = `${FileSystem.cacheDirectory}cropped_${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(outPath, b64, { encoding: FileSystem.EncodingType.Base64 });
  return outPath;
}
