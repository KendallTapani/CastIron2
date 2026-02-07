const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
export const isMapsConfigured = Boolean(apiKey);
export const googleMapsApiKey = apiKey;
