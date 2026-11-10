import { expect, test } from '@playwright/test';

const pageOneSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-53.3109 -198.4777 345 550" xml:space="preserve">
  <g id="content">
    <path d="M 20 10 L 220 10 L 220 220 L 20 220 Z" fill="#102d29"/>
  </g>
  <g id="ayah_markers">
    <path class="ayahPolygon" fill-opacity="0" id="verse-1" ayah="1" surah="1" d="M 181 18 L 57 18 L 57 48 L 181 48 Z"/>
    <path class="ayahPolygon" fill-opacity="0" id="verse-2" ayah="2" surah="1" d="M 203 49 L 36 49 L 36 76 L 203 76 Z"/>
    <path class="ayahPolygon" fill-opacity="0" id="verse-3" ayah="3" surah="1" d="M 229 76 L 128 76 L 128 103 L 229 103 Z"/>
    <path class="ayahPolygon" fill-opacity="0" id="verse-4" ayah="4" surah="1" d="M 128 76 L 12 76 L 12 103 L 128 103 Z"/>
    <path class="ayahPolygon" fill-opacity="0" id="verse-5" ayah="5" surah="1" d="M 229 103 L 56 103 L 56 130 L 229 130 Z"/>
    <path class="ayahPolygon" fill-opacity="0" id="verse-6" ayah="6" surah="1" d="M 56 103 L 8 103 L 8 130 L 229 130 L 229 160 L 114 160 Z"/>
    <path class="ayahPolygon" fill-opacity="0" id="verse-7" ayah="7" surah="1" d="M 113 130 L 13 130 L 13 162 L 37 162 L 37 189 L 73 189 L 73 214 L 171 214 L 171 191 L 204 191 L 204 160 L 113 160 Z"/>
  </g>
</svg>`;

test('printed Mushaf mode renders a verified page and maps keyboard-selected hit regions to local ayahs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((svg) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
      if (url === 'https://raw.githubusercontent.com/quran-ws/quran-svg/3ff27b46cecb0c0519d77531d9c868a579d1f623/mushafs/hafs/kfqc/svg/001.svg') {
        return new Response(svg, { status: 200, headers: { 'content-type': 'image/svg+xml' } });
      }
      return originalFetch(input, init);
    };
  }, pageOneSvg);

  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
  await page.getByRole('button', { name: 'الصفحة المطبوعة' }).click();

  const printedPage = page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 1' });
  await expect(printedPage).toBeVisible();
  const ayahTwo = page.getByRole('button', { name: 'تفسير الآية 2 من سورة الفاتحة' });
  await expect(ayahTwo).toBeVisible();
  await ayahTwo.focus();
  await page.keyboard.press('Enter');
  await expect(ayahTwo).toHaveAttribute('aria-pressed', 'true');

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);
});

test('printed Mushaf mode fails closed and offers the local flexible-text reader', async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
      if (url.startsWith('https://raw.githubusercontent.com/quran-ws/quran-svg/3ff27b46cecb0c0519d77531d9c868a579d1f623/mushafs/hafs/kfqc/svg/')) {
        throw new TypeError('offline');
      }
      return originalFetch(input, init);
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
  await page.getByRole('button', { name: 'الصفحة المطبوعة' }).click();

  await expect(page.getByRole('alert')).toContainText('لم نستخدم أي نص قرآني من ملف الرسم');
  await page.getByRole('button', { name: 'متابعة القراءة بالعرض المرن' }).click();
  await expect(page.getByText('عرض الآيات موزّع داخل صفحة مرنة، وليس محاكاة مطابقة لأسطر المصحف المطبوع. ستظل مطابقة الأسطر غير متاحة حتى تتوفر بيانات تخطيط موثّقة.')).toBeVisible();
});


test('printed page coordinates resolve local Quran text even when flexible page metadata differs', async ({ page }) => {
  const page120Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 341.75 547.98">
    <path class="ayahPolygon" fill-opacity="0" id="verse-746" number="005077" ayah="77" surah="5" d="M 0 0 L 341 0 L 341 547 L 0 547 Z"/>
  </svg>`;
  await page.addInitScript((svg) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
      if (url === 'https://raw.githubusercontent.com/quran-ws/quran-svg/3ff27b46cecb0c0519d77531d9c868a579d1f623/mushafs/hafs/kfqc/svg/120.svg') {
        return new Response(svg, { status: 200, headers: { 'content-type': 'image/svg+xml' } });
      }
      return originalFetch(input, init);
    };
  }, page120Svg);

  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
  await page.getByRole('spinbutton', { name: 'رقم صفحة المصحف' }).fill('120');
  await page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' }).click();
  await page.getByRole('button', { name: 'الصفحة المطبوعة' }).click();

  const printedPage = page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 120' });
  await expect(printedPage).toBeVisible();
  await expect(printedPage).toHaveAttribute('viewBox', '0 0 341.75 547.98');
  const ayah77 = page.getByRole('button', { name: 'تفسير الآية 77 من سورة المائدة' });
  await expect(ayah77).toBeVisible();
  await expect(page.getByRole('button', { name: 'استماع للمقطع' })).toBeEnabled();
  await ayah77.focus();
  await page.keyboard.press('Enter');
  await expect(ayah77).toHaveAttribute('aria-pressed', 'true');
});
