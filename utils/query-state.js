export function visibleQueryError(data, error) {
  return data == null ? (error ?? null) : null;
}
