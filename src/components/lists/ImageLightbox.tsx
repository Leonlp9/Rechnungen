import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  src: string | null;
  layoutId: string | null;
  onClose: () => void;
}

export function ImageLightbox({ src, layoutId, onClose }: Props) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  return (
    <AnimatePresence>
      {src && layoutId && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm cursor-zoom-out"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Morphing image */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
            <motion.img
              key="lightbox-img"
              layoutId={layoutId}
              src={src}
              alt="Vollbild"
              className="rounded-xl shadow-2xl object-contain pointer-events-auto cursor-zoom-out"
              style={{ maxWidth: '90vw', maxHeight: '88vh' }}
              onClick={onClose}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            />
          </div>

          {/* Close button */}
          <motion.button
            key="close-btn"
            className="fixed top-4 right-4 z-[102] flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors pointer-events-auto"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15, delay: 0.1 }}
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </motion.button>
        </>
      )}
    </AnimatePresence>
  );
}

