const apiFetch = (input: RequestInfo, init?: RequestInit) =>
  fetch(input, { credentials: 'include', ...init });

export interface GalleryPhoto {
  id: string;
  url: string;
  title: string;
  sort_order: number;
  created_at: string | null;
}

export async function fetchGallery(): Promise<GalleryPhoto[]> {
  const res = await apiFetch('/api/gallery');
  if (!res.ok) {
    throw new Error('Failed to load gallery');
  }
  const data = (await res.json()) as { photos?: GalleryPhoto[] };
  return data.photos ?? [];
}

async function getCsrfToken(): Promise<string> {
  const res = await apiFetch('/api/csrf-token');
  if (!res.ok) {
    throw new Error('Failed to obtain CSRF token');
  }
  const data = (await res.json()) as { csrfToken: string };
  return data.csrfToken;
}

async function isSessionError(status: number): Promise<boolean> {
  return status === 401 || status === 403;
}

export async function uploadGalleryPhoto(file: File, title: string): Promise<GalleryPhoto> {
  const csrfToken = await getCsrfToken();
  const form = new FormData();
  form.append('photo', file);
  form.append('title', title);

  const res = await apiFetch('/api/gallery', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { photo?: GalleryPhoto; error?: string };
  if (!res.ok) {
    if (await isSessionError(res.status)) {
      throw new Error('Session expired. Please login again.');
    }
    throw new Error(data.error || 'Upload failed');
  }
  if (!data.photo) {
    throw new Error('Upload failed');
  }
  return data.photo;
}

export async function deleteGalleryPhoto(id: string): Promise<void> {
  const csrfToken = await getCsrfToken();
  const res = await apiFetch(`/api/gallery/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': csrfToken },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (await isSessionError(res.status)) {
      throw new Error('Session expired. Please login again.');
    }
    throw new Error(data.error || 'Delete failed');
  }
}
