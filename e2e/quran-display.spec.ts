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


const pageOneArtwork = (ayahCount: number) => {
  const polygons = Array.from({ length: ayahCount }, (_, index) =>
    `<path class="ayahPolygon" fill-opacity="0" surah="1" ayah="${index + 1}" d="M ${index} 0 L ${index + 1} 1 Z"/>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 345 550"><g id="content"><path d="M 0 0 L 345 550 Z"/></g><g id="ayah_markers"></g>${polygons}</svg>`;
};

test('printed Mushaf page uses official page artwork and local ayah coordinates', async ({ page }) => {
  await page.route('https://cdn.quran.ws/svg/pages/v1.1.1/hafs-kfqc/001.svg', route =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      headers: { 'access-control-allow-origin': '*' },
      body: pageOneArtwork(7)
    })
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /فتح المصحف بالصفحات/ }).click();

  const printedPage = page.getByRole('group', { name: /صفحة مصحف المدينة المطبوعة، الصفحة 1/ });
  await expect(printedPage).toBeVisible();
  const firstAyah = page.getByRole('button', { name: 'تفسير سورة الفاتحة، الآية 1' });
  await expect(firstAyah).toBeVisible();
  await firstAyah.click();
  await expect(firstAyah).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('عرض نص الآيات المعتمد للنسخ والبحث')).toBeVisible();
  await expect(page.getByRole('link', { name: 'مصدر تخطيط الصفحة' })).toHaveAttribute('href', 'https://github.com/quran-ws/quran-svg');
});

test('printed page refuses an ayah map that differs from WIRD and offers the flexible text view', async ({ page }) => {
  await page.route('https://cdn.quran.ws/svg/pages/v1.1.1/hafs-kfqc/001.svg', route =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      headers: { 'access-control-allow-origin': '*' },
      body: pageOneArtwork(6)
    })
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /فتح المصحف بالصفحات/ }).click();

  await expect(page.getByRole('alert')).toContainText('لا تطابق إحداثيات وِرد المحلية');
  await page.getByRole('button', { name: 'استخدام العرض النصي المرن' }).click();
  await expect(page.getByText('هذا عرض نصي مرن قابل للتحديد والنسخ؛ توزيع الأسطر قد يختلف عن المصحف المطبوع.')).toBeVisible();
  await expect(page.getByRole('button', { name: /تفسير سورة الفاتحة، الآية 1/ })).toBeVisible();
});
