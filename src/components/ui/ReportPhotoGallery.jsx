'use client';

import { useState } from 'react';
import { Image as ImageIcon, Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizeClasses = {
  md: 'grid-cols-2 sm:grid-cols-3',
  lg: 'grid-cols-1 sm:grid-cols-2',
};

export default function ReportPhotoGallery({
  photos = [],
  title = 'Foto Laporan',
  size = 'lg',
  className,
}) {
  const visiblePhotos = photos.filter((photo) => photo?.photo_url);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  if (visiblePhotos.length === 0) return null;

  return (
    <>
      <div className={className}>
        {title && (
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            <ImageIcon className="w-4 h-4 inline mr-1.5" />
            {title}
          </h2>
        )}
        <div className={cn('grid gap-3', sizeClasses[size] || sizeClasses.lg)}>
          {visiblePhotos.map((photo, index) => (
            <button
              key={photo.id || photo.file_id || photo.photo_url}
              type="button"
              onClick={() => setSelectedPhoto(photo)}
              className="group relative block overflow-hidden rounded-lg border border-slate-200 bg-slate-100 aspect-[4/3] text-left transition hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              aria-label={`Perbesar foto laporan ${index + 1}`}
            >
              <img
                src={photo.photo_url}
                alt={`Foto laporan ${index + 1}`}
                className="w-full h-full object-cover transition duration-200 group-hover:scale-[1.03]"
              />
              <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/70 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <Maximize2 className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 px-4 py-6 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau foto laporan"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedPhoto(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Tutup pratinjau foto"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex h-full w-full items-center justify-center">
            <img
              src={selectedPhoto.photo_url}
              alt="Foto laporan diperbesar"
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
