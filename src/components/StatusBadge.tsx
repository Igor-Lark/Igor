import { APPROVAL_LABELS, STATUS_LABELS } from "@/lib/labels";

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || APPROVAL_LABELS[status] || status;
  return <span className={`badge ${status}`}>{label}</span>;
}
