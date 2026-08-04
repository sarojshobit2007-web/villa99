import express from 'express';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './env.js';
import { applySecurityMiddleware, loginLimiter } from './middleware/security.js';
import {
  authenticateToken,
  clearAuthCookie,
  doubleCsrfProtection,
  generateCsrfToken,
  setAuthCookie,
  signOwnerToken,
} from './middleware/auth.js';
import { logSecurityEvent } from './securityLogger.js';
import { readAvailability, writeAvailability } from './storage.js';
import {
  DEFAULT_GALLERY_FALLBACK,
  GalleryNotConfiguredError,
  deleteGalleryPhoto,
  ensureGalleryBucket,
  listGalleryPhotos,
  uploadGalleryPhoto,
} from './gallery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_BOOKED_DATES = 2000;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
});

function isValidCalendarDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function validateBookedDates(bookedDates) {
  if (!Array.isArray(bookedDates)) {
    return { ok: false, error: 'bookedDates must be an array' };
  }
  if (bookedDates.length > MAX_BOOKED_DATES) {
    return { ok: false, error: `Too many dates (max ${MAX_BOOKED_DATES})` };
  }
  for (const entry of bookedDates) {
    if (typeof entry !== 'string' || !isValidCalendarDate(entry)) {
      return { ok: false, error: 'One or more dates have an invalid format' };
    }
  }
  return { ok: true };
}

let appPromise = null;

export function createApp() {
  if (!appPromise) {
    appPromise = buildApp();
  }
  return appPromise;
}

async function buildApp() {
  if (!process.env.OWNER_PASSWORD_HASH) {
    throw new Error(
      'OWNER_PASSWORD_HASH must be set in environment. Generate with: node -e "require(\'bcryptjs\').hashSync(\'your-password\', 12)" | xargs -I {} echo OWNER_PASSWORD_HASH={}'
    );
  }

  const app = express();

  applySecurityMiddleware(app);
  app.use(cookieParser());
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/availability', async (_req, res) => {
    try {
      res.json(await readAvailability());
    } catch (err) {
      console.error('Error reading availability:', err.message);
      res.status(500).json({ error: 'Failed to read availability data' });
    }
  });

  app.get('/api/csrf-token', authenticateToken, (req, res) => {
    const csrfToken = generateCsrfToken(req, res);
    res.json({ csrfToken });
  });

  app.post('/api/login', loginLimiter, async (req, res) => {
    const password = req.body?.password;
    if (typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'Password is required' });
    }
    if (password.length > 256) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    try {
      const match = await bcrypt.compare(password, process.env.OWNER_PASSWORD_HASH);
      if (!match) {
        logSecurityEvent('login_failed', { ip: req.ip });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signOwnerToken();
      setAuthCookie(res, token);
      logSecurityEvent('login_success', { ip: req.ip });
      res.json({ authenticated: true });
    } catch (err) {
      console.error('Login error:', err.message);
      logSecurityEvent('login_error', { ip: req.ip, error: 'internal_error' });
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  app.post('/api/logout', (_req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  app.get('/api/verify', authenticateToken, (_req, res) => {
    res.json({ valid: true });
  });

  app.put(
    '/api/availability',
    authenticateToken,
    doubleCsrfProtection,
    async (req, res) => {
      const validation = validateBookedDates(req.body?.bookedDates);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      try {
        const uniqueDates = [...new Set(req.body.bookedDates)].sort();
        await writeAvailability({ bookedDates: uniqueDates });
        logSecurityEvent('availability_updated', { ip: req.ip, count: uniqueDates.length });
        res.json({ success: true, bookedDates: uniqueDates });
      } catch (err) {
        console.error('Error writing availability:', err.message);
        logSecurityEvent('availability_update_failed', { ip: req.ip, error: 'internal_error' });
        res.status(500).json({ error: 'Failed to update availability' });
      }
    }
  );

  app.get('/api/gallery', async (_req, res) => {
    try {
      const photos = await listGalleryPhotos();
      res.json({ photos });
    } catch (err) {
      if (err instanceof GalleryNotConfiguredError) {
        return res.json({ photos: DEFAULT_GALLERY_FALLBACK });
      }
      console.error('Error reading gallery:', err.message);
      res.status(500).json({ error: 'Failed to read gallery' });
    }
  });

  app.post(
    '/api/gallery',
    authenticateToken,
    doubleCsrfProtection,
    upload.single('photo'),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: 'No photo uploaded' });
      }
      const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 80) : '';
      try {
        await ensureGalleryBucket();
        const photo = await uploadGalleryPhoto(req.file.buffer, req.file.mimetype, title);
        logSecurityEvent('gallery_photo_uploaded', { ip: req.ip, title: photo.title });
        res.status(201).json({ photo });
      } catch (err) {
        console.error('Error uploading gallery photo:', err.message);
        res.status(400).json({ error: err.message || 'Failed to upload photo' });
      }
    }
  );

  app.delete(
    '/api/gallery/:id',
    authenticateToken,
    doubleCsrfProtection,
    async (req, res) => {
      if (!req.params?.id) {
        return res.status(400).json({ error: 'Invalid photo id' });
      }
      try {
        await deleteGalleryPhoto(req.params.id);
        logSecurityEvent('gallery_photo_deleted', { ip: req.ip, id: req.params.id });
        res.json({ success: true });
      } catch (err) {
        console.error('Error deleting gallery photo:', err.message);
        res.status(500).json({ error: 'Failed to delete photo' });
      }
    }
  );

  if (config.isProduction && !process.env.VERCEL) {
    const distPath = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, { index: false }));
      app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.use((err, _req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next(err);
  });

  return app;
}
