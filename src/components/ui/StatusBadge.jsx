import { cn } from '@/lib/utils';
import { REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '@/lib/constants';

export default function StatusBadge({ status, size = 'md', className }) {
  const colors = REPORT_STATUS_COLORS[status] || REPORT_STATUS_COLORS.dikirim;
  const label = REPORT_STATUS_LABELS[status] || status;

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
        colors.bg,
        colors.text,
        sizes[size],
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
      {label}
    </span>
  );
}
