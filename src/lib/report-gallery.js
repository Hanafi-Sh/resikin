function getTelegramFileUrl(fileId) {
  const baseUrl = (process.env.BOT_NOTIFY_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl || !fileId) return null;
  return `${baseUrl}/telegram/file/${encodeURIComponent(fileId)}`;
}

function normalizeStoragePhoto(photo) {
  if (!photo?.photo_url) return null;
  return {
    id: photo.id,
    url: photo.photo_url,
    photo_url: photo.photo_url,
    type: photo.type || 'report',
    source: photo.source || 'storage',
    uploaded_at: photo.uploaded_at || null,
  };
}

function normalizeTelegramPhoto(fileId, report) {
  if (typeof fileId !== 'string' || !fileId.trim()) return null;

  const url = getTelegramFileUrl(fileId);
  if (!url) return null;

  return {
    id: `telegram-${fileId}`,
    url,
    photo_url: url,
    type: 'report',
    source: 'telegram',
    uploaded_at: report.created_at || null,
    file_id: fileId,
  };
}

export function withReportGallery(report) {
  if (!report) return report;

  const storagePhotos = (Array.isArray(report.report_photos) ? report.report_photos : [])
    .map(normalizeStoragePhoto)
    .filter(Boolean);
  const telegramPhotos = (Array.isArray(report.file_ids) ? report.file_ids : [])
    .map((fileId) => normalizeTelegramPhoto(fileId, report))
    .filter(Boolean);
  const galleryPhotos = [...storagePhotos, ...telegramPhotos];

  return {
    ...report,
    gallery_photos: galleryPhotos,
    // Transitional compatibility for existing UI that still reads report_photos.
    report_photos: galleryPhotos,
  };
}

export function withReportGalleryList(reports) {
  return (Array.isArray(reports) ? reports : []).map(withReportGallery);
}
