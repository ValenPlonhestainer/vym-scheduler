/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.vymscheduler.app',
  productName: 'VyM Scheduler',

  directories: {
    output: 'dist',
    buildResources: 'build-resources',
  },

  files: [
    '.next/**/*',
    'public/**/*',
    'electron-dist/**/*',
    'package.json',
    'node_modules/**/*',
    '!node_modules/.cache',
    '!**/*.map',
    '!**/*.ts',
  ],

  extraResources: [
    { from: 'electron/activation.html', to: 'electron/activation.html' },
  ],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    // Colocar build-resources/icon.ico para el ícono del instalador
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'VyM Scheduler',
  },

  npmRebuild: true,

  // Punto de entrada del proceso principal Electron
  main: 'electron-dist/electron/main.js',
}
