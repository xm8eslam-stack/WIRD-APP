import { expect, test } from '@playwright/test';

test('connected reading displays official Tanzil Simple text by coordinate and fits the viewport', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /تلاوة ودراسة: سورة/ }).click();

  await expect(page.getByRole('link', { name: 'Tanzil Project' })).toHaveAttribute('href', 'https://tanzil.net');
  await expect(page.getByRole('button', { name: 'قراءة متصلة' })).toBeVisible();
  await page.getByRole('button', { name: 'قراءة متصلة' }).click();
  await expect(page.getByLabel('قراءة متصلة لسورة الفاتحة')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تفسير سورة الفاتحة، الآية 1' })).toBeVisible();

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);

  await page.getByRole('button', { name: /السور \(/ }).click();
  await page.getByRole('button', { name: 'فتح سورة فصلت للدراسة' }).click();
  await page.getByRole('button', { name: /تلاوة ودراسة: سورة فصلت/ }).click();
  await page.getByRole('button', { name: 'قراءة متصلة' }).click();

  const problematicAyah = page.getByRole('button', { name: 'تفسير سورة فصلت، الآية 7' });
  await expect(problematicAyah).toBeVisible();
  await expect(problematicAyah.locator('.quran-text')).toHaveText('الَّذِينَ لَا يُؤْتُونَ الزَّكَاةَ وَهُم بِالْآخِرَةِ هُمْ كَافِرُونَ');
  await expect(problematicAyah.locator('.quran-text')).toHaveAttribute('dir', 'rtl');
  await problematicAyah.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('wird.quran.lastReadingPosition.v1') || 'null'))).toEqual({ surahNumber: 41, ayahNumber: 7 });
});

test('reading position can be restored directly to its Surah and ayah', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wird.quran.lastReadingPosition.v1', JSON.stringify({ surahNumber: 41, ayahNumber: 7 }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /متابعة آخر موضع قراءة.*سورة فصلت.*الآية 7/ }).click();
  await expect(page.getByRole('button', { name: 'تفسير سورة فصلت، الآية 7' })).toBeInViewport();
});


test('Surah directory cards expose a keyboard-operable study action', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await expect(page.getByRole('button', { name: 'فتح سورة الفاتحة للدراسة' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'فتح سورة البقرة للدراسة' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /تلاوة ودراسة: سورة البقرة/ })).toBeVisible();
});
