import { useQuery } from '@tanstack/react-query';
import { reverseGeocode } from '../services/geocoding.js';

// Resuelve lat/lng a una dirección legible (Nominatim) -- vía TanStack Query
// en vez de un useEffect+useState local a propósito: cachea por coordenada
// (['reverse-geocode', lat, lng]), así que reabrir/re-expandir la misma fila
// no vuelve a pegarle a Nominatim (que pide explícitamente no pasar de
// ~1 request/segundo, ver services/geocoding.js).
export function useReverseGeocode(lat, lng) {
  const query = useQuery({
    queryKey: ['reverse-geocode', lat, lng],
    queryFn: () => reverseGeocode(lat, lng),
    enabled: typeof lat === 'number' && typeof lng === 'number',
    staleTime: Infinity,
  });

  return { address: query.data ?? null, loading: query.isLoading, error: query.error ?? null };
}
