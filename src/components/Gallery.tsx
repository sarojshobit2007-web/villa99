import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchGallery, type GalleryPhoto } from '../lib/galleryApi';

export default function Gallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [slideStart, setSlideStart] = useState(0);

  useEffect(() => {
    fetchGallery()
      .then((p) => {
        setPhotos(p);
        setSlideStart(0);
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, []);

  const count = photos.length;

  const openLightbox = (idx: number) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const showPrev = () => setLightboxIdx((prev) => (prev === 0 ? count - 1 : prev! - 1));
  const showNext = () => setLightboxIdx((prev) => (prev === count - 1 ? 0 : prev! + 1));
  const previousSlide = () => setSlideStart((prev) => (prev === 0 ? count - 1 : prev - 1));
  const nextSlide = () => setSlideStart((prev) => (prev === count - 1 ? 0 : prev + 1));
  const visibleItems = [0, 1, 2].map((offset) => {
    const index = (slideStart + offset) % count;
    return { ...photos[index], index };
  });

  return (
    <section id="gallery" className="section-luxury bg-parchment-gold">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 gap-6">
          <div>
            <p className="eyebrow-dark mb-5">Visual Journey</p>
            <h2
              className="heading-luxury"
              style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}
            >
              The Gallery
            </h2>
          </div>
        </div>

        {loading ? (
          <p
            className="text-center text-[0.6rem] tracking-[0.42em] text-[var(--color-ash)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Loading gallery...
          </p>
        ) : count === 0 ? (
          <p
            className="text-center text-[0.6rem] tracking-[0.42em] text-[var(--color-ash)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Gallery coming soon
          </p>
        ) : (
          <>
            {/* Aligned gallery carousel */}
            <div className="relative">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-8">
                {visibleItems.map((item, position) => (
                  <motion.button
                    key={`${slideStart}-${item.index}`}
                    type="button"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.38, delay: position * 0.06 }}
                    onClick={() => openLightbox(item.index)}
                    className={`group text-left ${position > 0 ? 'hidden sm:block' : ''}`}
                    aria-label={`Open ${item.title} in full screen`}
                  >
                    <div className="aspect-[4/5] rounded-[1.35rem] border-2 border-[var(--color-champagne)] bg-[var(--color-champagne)] p-[3px] shadow-[0_4px_18px_rgba(139,105,20,0.16)] transition-shadow duration-300 group-hover:shadow-[0_6px_24px_rgba(139,105,20,0.28)]">
                      <div className="h-full w-full overflow-hidden rounded-[1.05rem] bg-[var(--color-charcoal)]">
                        <img
                          src={item.url}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                        />
                      </div>
                    </div>
                    <p
                      className="mt-3 text-center text-sm tracking-[0.14em] text-[var(--color-charcoal)] sm:text-base"
                      style={{ fontFamily: 'var(--font-heading)', fontWeight: 400 }}
                    >
                      {item.title}
                    </p>
                  </motion.button>
                ))}
              </div>

              {count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={previousSlide}
                    className="absolute left-0 top-[40%] -translate-x-1/2 rounded-full border border-[var(--color-charcoal)] bg-[var(--color-parchment)] p-4 text-[var(--color-charcoal)] shadow-sm transition-colors hover:bg-[var(--color-charcoal)] hover:text-white sm:p-5"
                    aria-label="Previous gallery images"
                  >
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    className="absolute right-0 top-[40%] translate-x-1/2 rounded-full bg-[var(--color-charcoal)] p-4 text-white shadow-sm transition-colors hover:bg-[var(--color-ash)] sm:p-5"
                    aria-label="Next gallery images"
                  >
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </>
              )}

              <p
                className="mt-3 text-center text-[0.6rem] tracking-[0.42em] text-[var(--color-ash)] sm:mt-4"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {String(slideStart + 1).padStart(2, '0')} — {String(count).padStart(2, '0')}
              </p>
            </div>

            {/* Lightbox */}
            <AnimatePresence>
              {lightboxIdx !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{ background: 'rgba(22,22,22,0.97)' }}
                  onClick={closeLightbox}
                >
                  {/* Close */}
                  <button
                    onClick={closeLightbox}
                    className="absolute top-8 right-8 text-white/50 hover:text-[var(--color-champagne)] transition-colors text-2xl z-50"
                  >
                    ✕
                  </button>

                  {/* Prev */}
                  {count > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); showPrev(); }}
                      className="absolute left-6 md:left-12 text-white/40 hover:text-[var(--color-champagne)] transition-colors"
                    >
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                  )}

                  {/* Image */}
                  <motion.div
                    key={lightboxIdx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="max-w-5xl max-h-[80vh] flex flex-col items-center gap-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={photos[lightboxIdx].url}
                      alt={photos[lightboxIdx].title}
                      className="max-w-full max-h-[72vh] object-contain"
                    />
                    <div className="text-center">
                      <p
                        className="text-lg text-white/80"
                        style={{ fontFamily: 'var(--font-heading)', fontWeight: 400 }}
                      >
                        {photos[lightboxIdx].title}
                      </p>
                      <p className="text-[0.55rem] tracking-[0.35em] uppercase text-[var(--color-ash)] mt-2" style={{ fontFamily: 'var(--font-body)' }}>
                        {lightboxIdx + 1} / {count}
                      </p>
                    </div>
                  </motion.div>

                  {/* Next */}
                  {count > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); showNext(); }}
                      className="absolute right-6 md:right-12 text-white/40 hover:text-[var(--color-champagne)] transition-colors"
                    >
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </section>
  );
}
