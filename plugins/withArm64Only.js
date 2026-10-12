// Builds native code only for arm64-v8a (practically every current Android phone).
// Lives in a config plugin so it survives `expo prebuild` regenerating android/.
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withArm64Only(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures'));
    cfg.modResults.push({ type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a' });
    return cfg;
  });
};
