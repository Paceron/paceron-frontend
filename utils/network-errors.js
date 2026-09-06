export function mapNetworkError(err) {
  if (err?.name === 'AbortError') {
    return new Error('La conexión tardó demasiado. Probá de nuevo.');
  }
  return new Error('No pudimos conectarnos. Revisá tu conexión a internet.');
}

export function mapHttpErrorMessage(status, backendMessage) {
  if (backendMessage) return backendMessage;
  if (status >= 500) return 'Hubo un problema en el servidor. Probá de nuevo en unos minutos.';
  return `Request failed with status ${status}`;
}
