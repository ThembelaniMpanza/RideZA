const { buildTelemetryConfig } = require("./config/telemetry-config");

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
  const { publicConfig, sentryPlugin } = buildTelemetryConfig(
    process.env,
    config.version,
  );
  const plugins = [...(config.plugins ?? [])];
  if (sentryPlugin) plugins.push(sentryPlugin);

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      telemetry: publicConfig,
    },
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
