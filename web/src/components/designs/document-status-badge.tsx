const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-700',
};

export default function DocumentStatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-1 rounded ${statusColors[status] || statusColors.draft}`}>
      {status}
    </span>
  );
}
