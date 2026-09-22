const { defineConfig, devices } = require('./.ci-tools/node_modules/@playwright/test');

module.exports = defineConfig({
  testDir: './tests/mobile',
  testMatch: '**/*.spec.cjs',
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['iPhone 13'],
    browserName: 'webkit',
    baseURL: 'http://localhost:3015',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [320, 375, 390, 430].map(width => ({
    name: `iphone-webkit-${width}`,
    use: { viewport: { width, height: width === 320 ? 568 : 664 } },
  })),
  webServer: {
    command: 'npm run start -- --hostname localhost --port 3015',
    url: 'http://localhost:3015/fr',
    timeout: 120000,
    reuseExistingServer: false,
  },
});
