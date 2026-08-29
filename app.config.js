function getMapsKey(name) {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  if (process.env.EAS_BUILD === "true") {
    throw new Error(`${name} is required for EAS native builds.`);
  }

  return undefined;
}

module.exports = ({ config }) => {
  const androidApiKey = getMapsKey("GOOGLE_MAPS_ANDROID_API_KEY");
  const iosApiKey = getMapsKey("GOOGLE_MAPS_IOS_API_KEY");

  return {
    ...config,
    android: {
      ...config.android,
      ...(androidApiKey
        ? {
            config: {
              ...config.android?.config,
              googleMaps: {
                ...config.android?.config?.googleMaps,
                apiKey: androidApiKey,
              },
            },
          }
        : {}),
    },
    ios: {
      ...config.ios,
      ...(iosApiKey
        ? {
            config: {
              ...config.ios?.config,
              googleMapsApiKey: iosApiKey,
            },
          }
        : {}),
    },
  };
};
