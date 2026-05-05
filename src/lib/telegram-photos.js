function getTelegramFileUrl(fileId) {
  const baseUrl = (process.env.BOT_NOTIFY_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl || !fileId) return null;
  return `${baseUrl}/telegram/file/${encodeURIComponent(fileId)}`;
}

export function withTelegramReportPhotos(report) {
  if (!report) return report;

  const existingPhotos = Array.isArray(report.report_photos) ? report.report_photos : [];
  const telegramPhotos = (Array.isArray(report.file_ids) ? report.file_ids : [])
    .filter((fileId) => typeof fileId === 'string' && fileId.trim())
    .map((fileId) => {
      const photoUrl = getTelegramFileUrl(fileId);
      if (!photoUrl) return null;

      return {
        id: `telegram-${fileId}`,
        photo_url: photoUrl,
        type: 'report',
        uploaded_at: report.created_at || null,
        source: 'telegram',
        file_id: fileId,
      };
    })
    .filter(Boolean);

  return {
    ...report,
    report_photos: [...existingPhotos, ...telegramPhotos],
  };
}

export function withTelegramReportPhotosList(reports) {
  return (Array.isArray(reports) ? reports : []).map(withTelegramReportPhotos);
}
