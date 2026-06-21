/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.vymscheduler.app',
  productName: 'VyM Scheduler',
  directories: {
    output: 'dist',
  },

  files: [
    '.next/**/*',
    'public/**/*',
    'electron-dist/**/*',
    'package.json',
    '.env.local',
    'node_modules/**/*',
    '!node_modules/.cache',
    '!**/*.map',
    '!**/*.ts',
  ],

  extraResources: [
    { from: 'electron/activation.html', to: 'electron/activation.html' },
  ],

  win: {
    icon: 'build/icon.ico',
    target: [{ target: 'nsis', arch: ['x64'] }],
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: false,
    createStartMenuShortcut: true,
    shortcutName: 'VyM Scheduler',
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    include: 'build/installer.nsh',
  },

  asarUnpack: [
    'node_modules/better-sqlite3/**/*',
  ],

  npmRebuild: true,
}
