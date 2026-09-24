const { test, expect } = require('../../.ci-tools/node_modules/@playwright/test');
const navV2 = process.env.BAKER_NAV_V2 === '1';

async function capture(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function verifyHeader(page, testInfo, state) {
  const header = page.locator('header.bh-header');
  await expect(header).toBeVisible();
  await expect(header).toHaveCSS('height', '56px');
  await expect(header.locator('.bh-wordmark')).toHaveCSS('font-size', '24px');
  for (const className of ['.bh-header-menu', '.bh-header-save']) {
    await expect(header.locator(className)).toHaveCSS('font-size', '16px');
    await expect(header.locator(className)).toHaveCSS('font-weight', '500');
  }
  await expect(header.locator('.bh-header-save')).toHaveCSS('border-top-width', '1px');
  const geometry = await header.evaluate(el => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const mark = el.querySelector('.bh-wordmark');
    const range = document.createRange();
    range.selectNodeContents(mark);
    const r = range.getBoundingClientRect();
    return {
      viewport: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      header: rect(el),
      items: [
        ...Array.from(el.querySelectorAll('button')).map(node => ({ text: node.textContent.trim(), ...rect(node), button: true })),
        { text: mark.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, button: false },
      ].sort((a, b) => a.left - b.left),
    };
  });
  expect(geometry.pageWidth, 'no horizontal overflow').toBeLessThanOrEqual(geometry.viewport);
  for (let i = 0; i < geometry.items.length; i++) {
    const item = geometry.items[i];
    expect(item.left, item.text).toBeGreaterThanOrEqual(0);
    expect(item.right, item.text).toBeLessThanOrEqual(geometry.viewport);
    expect(item.top, item.text).toBeGreaterThanOrEqual(geometry.header.top);
    expect(item.bottom, item.text).toBeLessThanOrEqual(geometry.header.bottom);
    if (item.button) {
      expect(item.width, item.text).toBeGreaterThanOrEqual(44);
      expect(item.height, item.text).toBeGreaterThanOrEqual(44);
    }
    if (i) expect(item.left, `${geometry.items[i - 1].text} overlaps ${item.text}`).toBeGreaterThanOrEqual(geometry.items[i - 1].right);
  }
  await testInfo.attach(`${state}-geometry`, { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  await capture(page, testInfo, state);
}

for (const locale of ['fr', 'en']) {
  test(`${locale}: iPhone header, touch menu, local save and language`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Block real external service writes; anonymous auth is stubbed explicitly.
    await page.route('http://127.0.0.1:54321/**', route => route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ code: 'session_not_found', message: 'Anonymous UI test' }),
    }));
    const fr = locale === 'fr';
    await page.goto(fr ? '/fr' : '/');
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Pizza', exact: true }).tap();
    await expect(page.getByRole('heading', { name: navV2 ? (fr ? 'Quel style de pizza ?' : 'Which pizza style?') : (fr ? 'À votre façon' : 'Your way'), exact: true })).toBeVisible();
    await verifyHeader(page, testInfo, `${locale}-unsaved`);

    const menu = page.locator('.bh-header-menu');
    const dialog = page.getByRole('dialog', { name: 'Menu', exact: true });
    await menu.tap();
    await expect(dialog).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
    await capture(page, testInfo, `${locale}-menu`);
    await dialog.getByRole('button', { name: fr ? 'Fermer' : 'Close', exact: true }).tap();
    await expect(dialog).toBeHidden();
    // Safari does not focus buttons on a touch tap. Exercise restoration
    // from a genuine keyboard-focused trigger, separately from touch closing.
    await menu.focus();
    await menu.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(menu).toBeFocused();

    await page.locator('.bh-header-save').tap();
    await expect(page.locator('.bh-header-save')).toHaveText(fr ? 'Enregistré' : 'Saved');
    await expect(page.locator('.bh-header-save')).toHaveAttribute('aria-disabled', 'true');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(fr ? 'Compte' : 'Account', { exact: true })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bh_session_v1')));
    expect(saved.version).toBe(1);
    expect(saved.bakeType).toBe('pizza');
    await dialog.getByRole('button', { name: fr ? 'Fermer' : 'Close', exact: true }).tap();
    await verifyHeader(page, testInfo, `${locale}-saved`);

    await menu.tap();
    await dialog.getByRole('button', { name: fr ? 'Langue et unités' : 'Language & units', exact: true }).tap();
    await dialog.getByRole('combobox', { name: fr ? 'Langue' : 'Language', exact: true }).selectOption({ label: fr ? 'English' : 'Français' });
    await expect(page.getByRole('heading', { name: navV2 ? (fr ? 'Which pizza style?' : 'Quel style de pizza ?') : (fr ? 'Your way' : 'À votre façon'), exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    await verifyHeader(page, testInfo, `${locale}-switched-language`);
    expect(errors, 'uncaught application errors').toEqual([]);
  });
}
