import { supabase } from './supabaseClient';
import { parse } from 'exifr';
import imageCompression from 'browser-image-compression';

const BUCKET = 'city-images';

const COMPRESS_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/jpeg',
};

export async function uploadPhoto(file, onProgress) {
  // 压缩图片
  let compressed = file;
  try {
    if (file.size > 300 * 1024) {
      compressed = await imageCompression(file, {
        ...COMPRESS_OPTIONS,
        onProgress: (pct) => onProgress && onProgress({ phase: 'compress', pct }),
      });
    }
  } catch (e) {
    console.warn('图片压缩失败，使用原图:', e.message);
    compressed = file;
  }

  // 读取 EXIF
  let takenAt = null;
  try {
    const exif = await parse(file, ['DateTimeOriginal', 'CreateDate']);
    if (exif) {
      takenAt = exif.DateTimeOriginal || exif.CreateDate || null;
      if (takenAt) takenAt = new Date(takenAt).toISOString();
    }
  } catch { /* ignore */ }

  // 上传到 Supabase Storage
  const ext = file.name?.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, compressed, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw new Error(`上传失败: ${error.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { url: urlData.publicUrl, takenAt };
}
