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
  const cleaned = phone.replace(/\D/g, '');
  return /^(08|628)\d{8,12}$/.test(cleaned);
}

/**
 * Format phone number for display
 */
export function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    return '0' + cleaned.slice(2);
  }
  return cleaned;
}
