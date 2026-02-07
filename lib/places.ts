import type { Restaurant } from '../types';
import { googleMapsApiKey } from '../constants/config';

const VANCOUVER_WA = { latitude: 45.6387, longitude: -122.6615 };
const RADIUS_M = 5000;
const MAX_RESULTS = 20;
const SEARCH_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

function placeResourceName(placeId: string): string {
  return placeId.startsWith('places/') ? placeId : `places/${placeId}`;
}

/** Rate limit: min ms between searchNearby requests (avoid duplicate/costly calls) */
const MIN_REQUEST_INTERVAL_MS = 2000;
let lastRequestTime = 0;
let rateLimitPromise: Promise<void> | null = null;

function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed >= MIN_REQUEST_INTERVAL_MS) {
    lastRequestTime = now;
    return Promise.resolve();
  }
  const waitMs = MIN_REQUEST_INTERVAL_MS - elapsed;
  if (!rateLimitPromise) {
    rateLimitPromise = new Promise((resolve) => setTimeout(resolve, waitMs)).then(() => {
      rateLimitPromise = null;
      lastRequestTime = Date.now();
    });
  }
  return rateLimitPromise;
}

/** New Places API (v1) response types */
interface PlacePhotoNew {
  name: string;
  widthPx?: number;
  heightPx?: number;
}

interface PlaceNew {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  types?: string[];
  primaryTypeDisplayName?: string;
  photos?: PlacePhotoNew[];
  rating?: number;
}

interface SearchNearbyResponse {
  places?: PlaceNew[];
}

interface SearchTextResponse {
  places?: PlaceNew[];
  nextPageToken?: string | null;
}

function primaryTypeToString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'text' in v) return String((v as { text?: string }).text ?? '');
  return '';
}

function getCuisineFromTypes(types: string[] | undefined, primaryTypeDisplayName?: unknown): string {
  const primary = primaryTypeToString(primaryTypeDisplayName);
  if (primary) return primary;
  if (!types?.length) return 'Restaurant';
  const skip = new Set(['restaurant', 'food', 'point_of_interest', 'establishment']);
  const type = types.find((t) => !skip.has(t));
  return type ? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Restaurant';
}

/** Build photo URL for New Places API (GET .../media?maxWidthPx=400&key=...) */
export function getPlacePhotoUrl(photoName: string | undefined): string | null {
  if (!photoName || !googleMapsApiKey) return null;
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${encodeURIComponent(googleMapsApiKey)}`;
}

function displayNameToString(displayName: PlaceNew['displayName']): string {
  if (displayName == null) return 'Unknown';
  if (typeof displayName === 'string') return displayName;
  const text = (displayName as { text?: string })?.text;
  return typeof text === 'string' ? text : 'Unknown';
}

function placeToRestaurant(place: PlaceNew): Restaurant {
  const id = place.id?.replace(/^places\//, '') ?? '';
  const photos = place.photos ?? [];
  const photoUrls = photos.map((p) => getPlacePhotoUrl(p.name)).filter((u): u is string => u != null);
  const photoUrl = photoUrls[0];
  return {
    id,
    name: displayNameToString(place.displayName),
    cuisine: getCuisineFromTypes(place.types, place.primaryTypeDisplayName),
    rating: place.rating ?? 0,
    address: typeof place.formattedAddress === 'string' ? place.formattedAddress : '',
    photoUrl,
    photoUrls,
  };
}

export function getNearbyRestaurants(limit: number = MAX_RESULTS): Promise<Restaurant[]> {
  const key = googleMapsApiKey;
  if (!key) return Promise.reject(new Error('Google Maps API key not set'));

  return waitForRateLimit().then(() => {
    const body = {
    includedPrimaryTypes: ['restaurant'],
    maxResultCount: Math.min(limit, 20),
    locationRestriction: {
      circle: {
        center: VANCOUVER_WA,
        radius: RADIUS_M,
      },
    },
  };

  const fieldMask =
    'places.id,places.displayName,places.formattedAddress,places.types,places.primaryTypeDisplayName,places.photos,places.rating';

    return fetch(SEARCH_NEARBY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) {
          return res.text().then((t) => {
            throw new Error(t || `Places API ${res.status}`);
          });
        }
        return res.json() as Promise<SearchNearbyResponse>;
      })
      .then((data) => {
        const places = data.places ?? [];
        return places.map(placeToRestaurant).slice(0, limit);
      });
  });
}

export type NearbyPageResult = { restaurants: Restaurant[]; nextPageToken: string | null };

/**
 * Fetch one page of nearby restaurants using Text Search (supports pageToken).
 * Use for infinite scroll: call with no token for first page, then with nextPageToken for more.
 */
export function getNearbyRestaurantsPage(pageToken?: string | null): Promise<NearbyPageResult> {
  const key = googleMapsApiKey;
  if (!key) return Promise.reject(new Error('Google Maps API key not set'));

  return waitForRateLimit().then(() => {
    const body: Record<string, unknown> = {
      textQuery: 'restaurants',
      includedType: 'restaurant',
      pageSize: 20,
      locationBias: {
        circle: {
          center: VANCOUVER_WA,
          radius: RADIUS_M,
        },
      },
    };
    if (pageToken) body.pageToken = pageToken;

    const fieldMask =
      'places.id,places.displayName,places.formattedAddress,places.types,places.primaryTypeDisplayName,places.photos,places.rating,nextPageToken';

    return fetch(SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) {
          return res.text().then((t) => {
            throw new Error(t || `Places API ${res.status}`);
          });
        }
        return res.json() as Promise<SearchTextResponse>;
      })
      .then((data) => {
        const places = data.places ?? [];
        const nextPageToken = data.nextPageToken ?? null;
        return {
          restaurants: places.map(placeToRestaurant),
          nextPageToken: nextPageToken && String(nextPageToken).trim() ? nextPageToken : null,
        };
      });
  });
}

/** Place details response (id, displayName, photos per doc) */
interface PlaceDetailsResponse {
  photos?: Array<{ name?: string }>;
}

/**
 * True if this looks like a real Places API place ID (not static data like "1", "2").
 * Place IDs from the API are typically long and often start with ChIJ.
 */
export function isPlacesApiId(placeId: string): boolean {
  return placeId.length > 15 && (placeId.startsWith('ChIJ') || !/^\d+$/.test(placeId));
}

/**
 * Fetch place photos from the Place Details API. Call only when the user opens a restaurant.
 * Returns up to 10 photo URLs (same set as on the place page; the API does not expose
 * a separate "Food and drink" category). Uses same rate limit as search.
 */
export function getPlaceDetailsPhotos(placeId: string): Promise<string[]> {
  const key = googleMapsApiKey;
  if (!key || !placeId || !isPlacesApiId(placeId)) return Promise.resolve([]);

  const name = placeResourceName(placeId);
  const url = `https://places.googleapis.com/v1/${name}`;

  return waitForRateLimit().then(() =>
    fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'id,displayName,photos',
      },
    })
      .then((res) => (res.ok ? (res.json() as Promise<PlaceDetailsResponse>) : Promise.resolve({ photos: [] })))
      .then((data: PlaceDetailsResponse) => {
        const photos = data.photos ?? [];
        return photos
          .map((p: { name?: string }) => getPlacePhotoUrl(p.name))
          .filter((u: string | null): u is string => u != null);
      })
      .catch(() => [] as string[])
  );
}
