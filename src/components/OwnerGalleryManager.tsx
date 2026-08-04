import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchGallery,
  uploadGalleryPhoto,
  deleteGalleryPhoto,
  type GalleryPhoto,
} from '../lib/galleryApi';

interface OwnerGalleryManagerProps {
  onLogout: () => void;
}

export default function OwnerGalleryManager({ onLogout }: OwnerGalleryManagerProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAuthError = (message: string) => {
    if (message.includes('Session expired')) {
      setTimeout(onLogout, 1500);
    }
  };

  const load = useCallback(async () => {
    try {
      setPhotos(await fetchGallery());
    } catch {
      showToast('Failed to load photos', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const photo = await uploadGalleryPhoto(file, title.trim());
      setPhotos((prev) => [...prev, photo]);
      setFile(null);
      setTitle('');
      const input = document.getElementById('owner-photo-input') as HTMLInputElement | null;
      if (input) input.value = '';
      showToast('Photo uploaded', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      showToast(message, 'error');
      handleAuthError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteGalleryPhoto(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setConfirmDelete(null);
      showToast('Photo removed', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      showToast(message, 'error');
      handleAuthError(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="owner-panel-loading">
        <div className="owner-login-spinner" />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--color-ash)', marginTop: '1.5rem' }}>
          Loading photos...
        </p>
      </div>
    );
  }

  return (
    <div className="owner-gallery">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`owner-toast ${toast.type === 'success' ? 'owner-toast-success' : 'owner-toast-error'}`}
          >
            {toast.type === 'success' ? '✓' : '✕'} {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="owner-instructions">
        <p>Upload a photo to add it to the site gallery. Click <strong>Remove</strong> to delete a photo. Photos are stored in Supabase.</p>
      </div>

      {/* Upload form */}
      <div className="owner-gallery-upload glass-dark">
        <div className="owner-gallery-upload-fields">
          <div>
            <label htmlFor="owner-photo-title" className="owner-gallery-label">Title</label>
            <input
              id="owner-photo-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pool at Sunrise"
              maxLength={80}
              className="owner-login-input"
            />
          </div>
          <div>
            <label htmlFor="owner-photo-input" className="owner-gallery-label">Photo (JPEG, PNG, WebP, GIF — max 4 MB)</label>
            <input
              id="owner-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              onChange={handleFileChange}
              className="owner-gallery-file"
            />
          </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={!file || busy}
          className="owner-save-btn"
        >
          {busy ? <span className="owner-login-spinner" /> : file ? `Upload "${title.trim() || 'Untitled'}"` : 'Upload Photo'}
        </button>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <p className="owner-gallery-empty">No photos yet. Upload your first photo above.</p>
      ) : (
        <div className="owner-gallery-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="owner-gallery-item">
              <img src={photo.url} alt={photo.title} className="owner-gallery-thumb" />
              <div className="owner-gallery-item-meta">
                <span className="owner-gallery-item-title">{photo.title || 'Untitled'}</span>
                {confirmDelete === photo.id ? (
                  <div className="owner-gallery-confirm">
                    <button
                      onClick={() => handleDelete(photo.id)}
                      disabled={busy}
                      className="owner-gallery-confirm-yes"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      disabled={busy}
                      className="owner-gallery-confirm-no"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(photo.id)}
                    disabled={busy}
                    className="owner-gallery-delete"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
