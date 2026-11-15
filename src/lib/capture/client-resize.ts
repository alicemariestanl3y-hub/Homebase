/**
 * Browser-only image resize helpers for iPhone Safari.
 * Keeps uploads small for vision API cost control.
 */

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.72;

export async function filesToResizedDataUrls(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    urls.push(await resizeImageFile(file));
  }
  return urls;
}

async function resizeImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image canvas.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
