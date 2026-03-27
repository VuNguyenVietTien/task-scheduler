export interface PaginationArgs {
  offset?: number;
  limit?: number;
}

export function getPaginationParams(args: PaginationArgs) {
  const offset = args.offset ?? 0;
  const limit = Math.min(args.limit ?? 50, 100); // Max 100 items
  return { offset, limit };
}
