/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'better-sqlite3']
    }
    // pdf.js referencia el módulo nativo `canvas` (solo Node); en el navegador no
    // se usa. Sin esto, el build falla con "Can't resolve 'canvas'".
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false }
    return config
  },
}

module.exports = nextConfig
