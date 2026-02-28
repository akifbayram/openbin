import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'OpenBin',
  description: 'Self-hosted bin inventory with QR codes and AI',
  base: '/openbin/',
  themeConfig: {
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
          text: 'Overview',
          link: '/guide/'
        },
        {
          text: 'Core Features',
          collapsed: false,
          items: [
            { text: 'Bins', link: '/guide/bins' },
            { text: 'QR Scanning', link: '/guide/qr-scanning' },
            { text: 'Search & Filter', link: '/guide/search-filter' },
            { text: 'Dashboard', link: '/guide/dashboard' }
          ]
        },
        {
          text: 'Organize & Customize',
          collapsed: false,
          items: [
            { text: 'Locations & Areas', link: '/guide/locations' },
            { text: 'Photos', link: '/guide/photos' },
            { text: 'Print Labels', link: '/guide/print-labels' },
            { text: 'Bulk Operations', link: '/guide/bulk-operations' }
          ]
        },
        {
          text: 'AI & Automation',
          collapsed: false,
          items: [
            { text: 'AI Features', link: '/guide/ai' },
            { text: 'Bulk Add', link: '/guide/bulk-add' },
            { text: 'API Keys', link: '/guide/api-keys' },
            { text: 'MCP Server', link: '/guide/mcp-server' }
          ]
        },
        {
          text: 'Data Management',
          collapsed: false,
          items: [
            { text: 'Import & Export', link: '/guide/import-export' },
            { text: 'Items & Tags', link: '/guide/items-tags' },
            { text: 'Account & Profile', link: '/guide/profile' },
            { text: 'Keyboard Shortcuts', link: '/guide/shortcuts' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Auth', link: '/api/auth' },
            { text: 'Locations', link: '/api/locations' },
            { text: 'Areas', link: '/api/areas' },
            { text: 'Bins', link: '/api/bins' },
            { text: 'Photos', link: '/api/photos' },
            { text: 'Tag Colors', link: '/api/tag-colors' },
            { text: 'Print Settings', link: '/api/print-settings' },
            { text: 'Export', link: '/api/export' },
            { text: 'AI', link: '/api/ai' },
            { text: 'Activity', link: '/api/activity' },
            { text: 'API Keys', link: '/api/api-keys' },
            { text: 'User Preferences', link: '/api/preferences' },
            { text: 'Saved Views', link: '/api/saved-views' },
            { text: 'Scan History', link: '/api/scan-history' },
            { text: 'Batch Operations', link: '/api/batch' }
          ]
        },
        {
          text: 'Reference',
          items: [
            { text: 'Configuration', link: '/getting-started/configuration' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'discord', link: 'https://discord.gg/hFjrCCut' },
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
