import { supabase } from './supabase.js';

const BUCKET = 'gallery';
const TABLE = 'gallery_photos';

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

export const DEFAULT_GALLERY_FALLBACK = [
  { id: 'seed-1', url: '/images/hero-sunset-pool.jpeg', title: 'Sunset & Pool', sort_order: 1, created_at: null },
  { id: 'seed-2', url: '/images/living-room-day.jpeg', title: 'Living Room', sort_order: 2, created_at: null },
  { id: 'seed-3', url: '/images/lawn-pool-mountain.jpeg', title: 'Pool & Mountains', sort_order: 3, created_at: null },
];

export class GalleryNotConfiguredError extends Error {
  constructor() {
    super(
      'Gallery not set up. Run the gallery setup SQL in Supabase (see README), or upload a photo first.'
    );
    this.name = 'GalleryNotConfiguredError';
  }
}

function isMissingTableError(error) {
  return Boolean(
    error &&
    (error.code === 'PGRST204' || error.code === '42P01' || /relation "gallery_photos" does not exist/.test(error.message || ''))
  );
}

export async function ensureGalleryBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message || '')) {
      throw error;
    }
  }
}

const selectColumns = 'id, url, title, sort_order, created_at';

export async function listGalleryPhotos() {
  let data;
  try {
    const res = await supabase
      .from(TABLE)
      .select(selectColumns)
      .order('sort_order', { ascending: true });
    if (res.error) throw res.error;
    data = res.data;
  } catch (err) {
    if (isMissingTableError(err)) {
      throw new GalleryNotConfiguredError();
    }
    throw err;
  }

  if (data.length === 0) {
    return seedGallery();
  }
  return data;
}

async function seedGallery() {
  const rows = DEFAULT_GALLERY_FALLBACK.map((p, i) => ({
    url: p.url,
    title: p.title,
    sort_order: i + 1,
  }));
  const { data, error } = await supabase
    .from(TABLE)
    .insert(rows)
    .select(selectColumns);
  if (error) throw error;
  return (data || []).sort((a, b) => a.sort_order - b.sort_order);
}

export async function uploadGalleryPhoto(fileBuffer, mimetype, title) {
  const extension = MIME_EXT[mimetype];
  if (!extension) {
    throw new Error('Only image files (JPEG, PNG, WebP, GIF, AVIF) are allowed');
  }

  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, fileBuffer, { contentType: mimetype, upsert: false });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

  const { data: existing } = await supabase
    .from(TABLE)
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSortOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ url: publicUrlData.publicUrl, title: title || 'Untitled', sort_order: nextSortOrder })
    .select(selectColumns)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGalleryPhoto(id) {
  if (typeof id === 'string' && id.startsWith('seed-')) {
    return null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('url')
    .single();
  if (error) throw error;

  const url = data?.url;
  if (url && url.includes(`/storage/v1/object/public/${BUCKET}/`)) {
    const fileName = url.split('/').pop();
    await supabase.storage.from(BUCKET).remove([fileName]);
  }
  return data;
}
