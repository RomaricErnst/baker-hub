import { createClient } from '@/app/lib/supabase/client';

export const PHOTO_BUCKET = 'bake-photos';
export const PHOTO_LIMIT = 50;
export const PHOTO_SOFT_WARN = 40;

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export interface UploadResult {
  url: string;
  warned: boolean;
}

export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          resolve(blob);
        },
        'image/jpeg',
        0.80,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

export async function countUserPhotos(userId: string): Promise<number> {
  try {
    const supabase = createClient();
    const { data: events } = await supabase
      .from('bake_events').select('id').eq('user_id', userId);
    if (!events || events.length === 0) return 0;
    const eventIds = events.map(e => e.id);
    const { count } = await supabase
      .from('bake_photos')
      .select('id', { count: 'exact', head: true })
      .in('bake_event_id', eventIds);
    return count ?? 0;
  } catch { return 0; }
}

export async function uploadPhoto(
  file: File,
  userId: string,
  bakeEventId: string | null,
  slotIndex: number | null,
): Promise<UploadResult> {
  const supabase = createClient();

  const blob = await compressImage(file);

  const path = `${userId}/${Date.now()}_slot${slotIndex ?? 'x'}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(path);

  if (bakeEventId) {
    await supabase.from('bake_photos').insert({
      bake_event_id: bakeEventId,
      slot_index: slotIndex,
      photo_url: publicUrl,
    });
  }

  const { data: events } = await supabase
    .from('bake_events').select('id').eq('user_id', userId);
  const eventIds = (events ?? []).map(e => e.id);
  const { data: allPhotos } = eventIds.length > 0
    ? await supabase
        .from('bake_photos')
        .select('id, photo_url, taken_at')
        .in('bake_event_id', eventIds)
        .order('taken_at', { ascending: true })
    : { data: [] };

  const total = allPhotos?.length ?? 0;

  if (total > PHOTO_LIMIT) {
    const excess = allPhotos!.slice(0, total - PHOTO_LIMIT);
    const excessIds = excess.map(p => p.id);
    const bucketPrefix = supabase.storage.from(PHOTO_BUCKET).getPublicUrl('').data.publicUrl;
    const storagePaths = excess
      .map(p => p.photo_url.replace(bucketPrefix, ''))
      .filter(Boolean);
    await supabase.from('bake_photos').delete().in('id', excessIds);
    if (storagePaths.length > 0) {
      await supabase.storage.from(PHOTO_BUCKET).remove(storagePaths);
    }
  }

  const warned = total >= PHOTO_SOFT_WARN;
  return { url: publicUrl, warned };
}
