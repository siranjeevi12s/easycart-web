/** Device GPS → human-readable address for the restaurant profile form. */
import * as Location from 'expo-location';

export interface LocatedAddress {
  address: string;
  coords: { latitude: number; longitude: number };
}

export async function getCurrentAddress(): Promise<LocatedAddress> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied — enable it in system settings and retry.');
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (g) {
      const parts = [g.name, g.street, g.district || g.subregion, g.city || g.region, g.postalCode, g.country].filter(
        Boolean
      ) as string[];
      const uniq = [...new Set(parts)];
      if (uniq.length > 0) return { address: uniq.join(', '), coords: { latitude, longitude } };
    }
  } catch {}
  // Geocoder unavailable (offline etc.) — fall back to raw coordinates
  return { address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, coords: { latitude, longitude } };
}
