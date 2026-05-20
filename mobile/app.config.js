module.exports = ({ config }) => {
  const envMapsKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
  const fallbackMapsKey =
    config?.android?.config?.googleMaps?.apiKey ||
    config?.ios?.config?.googleMapsApiKey ||
    '';
  const googleMapsApiKey = envMapsKey || fallbackMapsKey;

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config || {}),
        googleMaps: {
          ...((config.android?.config || {}).googleMaps || {}),
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey: googleMapsApiKey,
      },
    },
  };
};
