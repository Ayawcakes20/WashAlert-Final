const appJson = require('./app.json');

module.exports = ({ config }) => {
  const baseExpoConfig = appJson.expo || config || {};
  const envMapsKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
  const fallbackMapsKey =
    baseExpoConfig?.android?.config?.googleMaps?.apiKey ||
    baseExpoConfig?.ios?.config?.googleMapsApiKey ||
    '';
  const googleMapsApiKey = envMapsKey || fallbackMapsKey;

  return {
    ...baseExpoConfig,
    android: {
      ...baseExpoConfig.android,
      config: {
        ...(baseExpoConfig.android?.config || {}),
        googleMaps: {
          ...((baseExpoConfig.android?.config || {}).googleMaps || {}),
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...baseExpoConfig.ios,
      config: {
        ...(baseExpoConfig.ios?.config || {}),
        googleMapsApiKey: googleMapsApiKey,
      },
    },
  };
};
