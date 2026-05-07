// ============================================
// ResikIn — Utility Functions
// ============================================

/**
 * Merge class names, filtering out falsy values
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Generate a tracking code: RSK-YYYYMMDD-NNN
 */
export function generateTrackingCode(sequenceNumber = 1) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(sequenceNumber).padStart(3, '0');
  return `RSK-${dateStr}-${seq}`;
}

/**
 * Format a date string to Indonesian locale
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format a date string with time
 */
export function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time (e.g., "2 jam lalu")
 */
export function getRelativeTime(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return formatDate(dateString);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str, maxLength = 100) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Validate Indonesian phone number
 */
export function isValidPhone(phone) {
  return normalizeIndonesianPhone(phone) !== null;
}

/**
 * Normalize Indonesian mobile phone number to E.164-like +62 format.
 */
export function normalizeIndonesianPhone(phone) {
  if (typeof phone !== 'string') return null;

  const trimmed = phone.trim();
  if (!trimmed || /[A-Za-z]/.test(trimmed)) return null;
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = `62${digits.slice(1)}`;
  }

  if (!/^628\d{8,11}$/.test(digits)) return null;

  return `+${digits}`;
}

/**
 * A report has an actionable location when it has GPS coordinates or a manual address.
 */
export function hasActionableReportLocation({ latitude, longitude, address } = {}) {
  const hasLatitude = latitude !== null && latitude !== undefined && latitude !== '';
  const hasLongitude = longitude !== null && longitude !== undefined && longitude !== '';
  const hasCoordinates = hasLatitude && hasLongitude && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const normalizedAddress = normalizeManualAddress(address);
  const hasManualAddress = normalizedAddress !== null;
  return hasCoordinates || hasManualAddress;
}

/**
 * Normalize manual report addresses while rejecting vague values.
 */
export function normalizeManualAddress(address) {
  if (typeof address !== 'string') return null;

  const normalized = address.trim().replace(/\s+/g, ' ');
  if (normalized.length < 10 || normalized.length > 250) return null;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(normalized)) return null;

  return normalized;
}

/**
 * Normalize reporter names while rejecting values that are not plausibly names.
 */
export function normalizeReporterName(name) {
  if (typeof name !== 'string') return null;

  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 80) return null;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(normalized)) return null;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s.'-]+$/.test(normalized)) return null;

  return normalized;
}

/**
 * Normalize report descriptions while rejecting unhelpful values.
 */
export function normalizeReportDescription(description) {
  if (typeof description !== 'string') return null;

  const normalized = description.trim().replace(/\s+/g, ' ');
  if (normalized.length < 20 || normalized.length > 1000) return null;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(normalized)) return null;

  return normalized;
}

/**
 * Format phone number for display
 */
export function formatPhone(phone) {
  const normalized = normalizeIndonesianPhone(phone);
  if (normalized) {
    return `0${normalized.slice(3)}`;
  }

  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    return '0' + cleaned.slice(2);
  }
  return cleaned;
}
