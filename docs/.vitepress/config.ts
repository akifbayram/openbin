import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'OpenBin',
  description: 'Self-hosted bin inventory with QR codes and AI',
  base: '/openbin/',
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Get Started', link: '/getting-started/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/akifbayram/openbin' }
    ],
    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/getting-started/' },
            { text: 'Docker', link: '/getting-started/docker' },
            { text: 'Local Development', link: '/getting-started/local-dev' },
            { text: 'Configuration', link: '/getting-started/configuration' }
          ]
        }
      ],
      '/guide/': [
        {
          text: 'User Guide',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Locations & Areas', link: '/guide/locations' },
            { text: 'Bins', link: '/guide/bins' },
            { text: 'QR Scanning', link: '/guide/qr-scanning' },
            { text: 'Print Labels', link: '/guide/print-labels' },
            { text: 'AI Features', link: '/guide/ai' },
            { text: 'Search & Filter', link: '/guide/search-filter' },
            { text: 'Bulk Operations', link: '/guide/bulk-operations' },
            { text: 'Photos', link: '/guide/photos' },
            { text: 'Import & Export', link: '/guide/import-export' },
            { text: 'Dashboard', link: '/guide/dashboard' },
            { text: 'API Keys', link: '/guide/api-keys' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Endpoints', link: '/api/reference' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/akifbayram/openbin' }
    ],
    search: {
      provider: 'local'
    },
    editLink: {
      pattern: 'https://github.com/akifbayram/openbin/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },
    footer: {
      message: 'Released under the GPL-3.0 License.',
      copyright: 'OpenBin'
    }
  }
})
