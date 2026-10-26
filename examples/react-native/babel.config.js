module.exports = (api) => {
    api.cache(true)
    // babel-preset-expo adds the worklets plugin when react-native-worklets is installed
    return { presets: ["babel-preset-expo"] }
}
