const { getDefaultConfig } = require("expo/metro-config");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  const { transformer, resolver } = config;

  // O react-native-svg-transformer só transforma arquivos .svg automaticamente
  // Não interfere com outras bibliotecas como @expo/vector-icons ou lucide-react-native
  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
    assetPlugins: transformer.assetPlugins || [],
  };

  config.resolver = {
    ...resolver,
    // Remove SVG da lista de assets
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    // Adiciona SVG na lista de código fonte
    sourceExts: [...resolver.sourceExts, "svg"],
  };

  return config;
})();