module.exports = {
  upgrade: true,
  reject: [
    'electron',
    'chalk',
    'del',
    'comlink',
    'vue',
    'image-size',
    'message2call',
    '@types/ws',
    '@types/node',
    'electron-debug',
  ],

  // target: 'newest',
  // filter: [
  //   'electron-builder',
  //   'electron-updater',
  // ],

  // target: 'patch',
  // filter: [
  //   'electron',
  //   'vue',
  // ],

  // target: 'minor',
  // filter: [
  //   'electron',
  //   'eslint',
  //   'eslint-webpack-plugin',
  //   'electron-debug',
  //   '@types/node',

  //   'eslint-plugin-vue',
  //   'vue-eslint-parser',
  // ],
}
