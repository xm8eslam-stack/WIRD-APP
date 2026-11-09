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

  await page.getByRole('tab', { name: /السور \(/ }).click();
  await page.getByRole('heading', { name: 'سورة فصلت' }).click();
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


test('Quran library search, tabs, and Surah selection are keyboard accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');

  const search = page.getByRole('searchbox', { name: 'البحث عن سورة أو جزء' });
  await search.fill('الملك');
  const openSurah = page.getByRole('button', { name: 'فتح دراسة سورة الملك' });
  await expect(openSurah).toBeVisible();
  await openSurah.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'سُورَةُ الملك' })).toBeVisible();

  const surahsTab = page.getByRole('tab', { name: /السور/ });
  await surahsTab.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: /الأجزاء/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: /تلاوة ودراسة/ })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: /فتح المصحف بالصفحات/ }).click();
  await expect(page.getByRole('heading', { name: 'مصحف المدينة المنورة' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'موقع القراءة الحالي' })).toContainText(/الصفحة \\d+ من 604/);
});

test('Quran library remains within narrow mobile viewports', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await expect(page.getByRole('searchbox', { name: 'البحث عن سورة أو جزء' })).toBeVisible();

  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 860 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth
    }));
    expect(dimensions.document, `Quran library overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});
