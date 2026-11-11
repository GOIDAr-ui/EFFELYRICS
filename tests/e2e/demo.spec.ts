import { test, expect } from '@playwright/test';
test('demo playback, pause, seek, settings, TTML import and diagnostics', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'В ожидании музыки' })).toBeVisible();
  await page.getByRole('button', { name: 'Деморежим', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'К свету нового дня' })).toBeVisible();
  await page.getByRole('button', { name: 'Воспроизвести', exact: true }).click();
  await expect(page.locator('.word.current')).toHaveText('Там, ');
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  const word = await page.locator('.word.current').textContent();
  await page.waitForTimeout(1300);
  await expect(page.locator('.word.current')).toHaveText(word!);
  await page.getByRole('slider', { name: 'Позиция воспроизведения' }).fill('25.2');
  await expect(page.locator('.word.current')).toHaveText('Небо ');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Уменьшить движение' }).check();
  await page.getByRole('combobox', { name: 'Качество визуализации' }).selectOption('low');
  await expect(page.locator('.app')).toHaveClass(/reduce-motion/);
  await page.getByRole('button', { name: 'Закрыть панель' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'original.ttml', mimeType: 'application/xml', buffer: Buffer.from('<tt xmlns="http://www.w3.org/ns/ttml"><body><p begin="0s" end="40s"><span begin="0s" end="40s">Собственный текст</span></p></body></tt>') });
  await expect(page.locator('.word.current')).toHaveText('Собственный текст');
  await page.getByRole('button', { name: 'Диагностика подключения' }).click();
  await expect(page.getByText('РЕАЛЬНЫЕ ДАННЫЕ WINDOWS · НЕ ДЕМО')).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть панель' }).click();
  await page.getByRole('button', { name: 'Apple Music', exact: true }).click();
  await expect(page.locator('.word.current')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('responsive demo stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Деморежим', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Воспроизвести', exact: true })).toBeVisible();
});
test('preload contract mock: optional metadata, imported lyrics, track switch and session loss', async ({ page }) => {
  await page.addInitScript(() => {
    window.aurora = {
      getSnapshot: async () => ({ connection: 'connected', sourceId: 'AppleInc.AppleMusicWin_mock!App', trackId: 'a', playback: 'paused', position: 1, duration: 10, rate: 1, timelineAge: 0, capabilities: { toggle: true, next: true, previous: false }, sessions: ['AppleInc.AppleMusicWin_mock!App'] }),
      onSnapshot: listener => { const handler = (event: Event) => listener((event as CustomEvent).detail); window.addEventListener('test:media', handler); return () => window.removeEventListener('test:media', handler); },
      command: async () => ({ ok: false, error: 'Тестовый отказ команды' }),
      importTTML: async () => ({ name: 'test.ttml', content: '<tt><body><p begin="0s" end="10s">Тестовый текст</p></body></tt>' }),
      fullscreen: async () => {},
    };
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Без названия', exact: true })).toBeVisible();
  await expect(page.getByText('Неизвестный исполнитель', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Импорт TTML', exact: true }).click();
  await expect(page.locator('.word.current')).toHaveText('Тестовый текст');
  await page.getByRole('button', { name: 'Воспроизвести', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Тестовый отказ команды');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('test:media', { detail: { connection: 'connected', trackId: 'b', title: 'Другой трек', playback: 'paused', position: 0, duration: 15, capabilities: { toggle: true } } })));
  await expect(page.getByRole('heading', { name: 'Другой трек' })).toBeVisible();
  await expect(page.locator('.word.current')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('test:media', { detail: { connection: 'unavailable' } })));
  await expect(page.getByRole('button', { name: 'Воспроизвести', exact: true })).toBeDisabled();
});
