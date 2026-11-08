import { expect, test } from '@playwright/test';

test.describe('WIRD navigation and memorization tafsir UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  });

  test('mobile navigation keeps core destinations visible and groups secondary pages in More', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const bottomNav = page.getByRole('navigation', { name: 'التنقل السريع' });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'الرئيسية' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'القرآن' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'الحفظ' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'المراجعة' })).toBeVisible();

    await bottomNav.getByRole('button', { name: 'المزيد من الأقسام' }).click();
    const drawerNav = page.getByRole('navigation', { name: 'القائمة الرئيسية' });
    await expect(drawerNav).toBeVisible();
    await expect(drawerNav.getByText('الحفظ والتثبيت')).toBeVisible();
    await expect(drawerNav.getByText('المتابعة والمساندة')).toBeVisible();
    await expect(drawerNav.getByRole('button', { name: 'اختبارات الحفظ' })).toBeVisible();
    await expect(drawerNav.getByRole('button', { name: 'الإعدادات' })).toBeVisible();
  });

  test('memorization tafsir is collapsed by default and can be toggled without leaving the session', async ({ page }) => {
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');

    const tafsirToggle = page.locator('section[aria-labelledby="session-tafsir-title"] > button');
    await expect(tafsirToggle).toBeVisible();
    await expect(tafsirToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('مصدر التفسير في الجلسة')).toHaveCount(0);

    await tafsirToggle.click();
    await expect(tafsirToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('مصدر التفسير في الجلسة')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird_session_tafsir_expanded_v1'))).toBe('1');

    await tafsirToggle.click();
    await expect(tafsirToggle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird_session_tafsir_expanded_v1'))).toBe('0');
    await expect(page.getByText(/الآية 1 من 3/)).toBeVisible();
  });
  test('related hadith card renders the source matn, book metadata, and explicit grading in RTL', async ({ page }) => {
    await page.route('**/api/hadith-references?**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        verseKey: '1:1',
        source: 'Quran Foundation Hadith References',
        hadiths: [
          {
            name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1',
            body: 'مَتْنُ حَدِيثٍ عَرَبِيٍّ بِالتَّشْكِيلِ',
            grades: [{ graded_by: 'ناقد موثق للاختبار', grade: 'صحيح' }], authenticityBasis: 'explicit_grade',
            bookNumber: '1', chapterNumber: '1', chapterTitle: 'بدء الوحي', referenceUrn: 222, urn: 111,
          },
          {
            name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1',
            body: 'نسخة مكررة من الإحالة نفسها',
            grades: [{ graded_by: 'ناقد موثق للاختبار', grade: 'صحيح' }], authenticityBasis: 'explicit_grade',
            bookNumber: '1', chapterNumber: '1', chapterTitle: 'بدء الوحي', referenceUrn: 222, urn: 111,
          },
          {
            name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1',
            body: 'رواية أخرى لها معرّف مصدر مستقل',
            grades: [{ graded_by: 'ناقد موثق للاختبار', grade: 'صحيح' }], authenticityBasis: 'explicit_grade',
            bookNumber: '1', chapterNumber: '1', chapterTitle: 'بدء الوحي', referenceUrn: 223, urn: 112,
          },
        ],
        page: 1,
        hasMore: false,
      }),
    }));

    const libraryNavigationLabel = (page.viewportSize()?.width ?? 1280) < 768 ? 'القرآن' : 'القرآن والمصحف';
    await page.getByRole('button', { name: libraryNavigationLabel, exact: true }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    const firstAyah = page.locator('#wird-ayah-1-1');
    await expect(firstAyah).toBeVisible();
    await firstAyah.click();

    const hadithToggle = page.getByRole('button', { name: 'أحاديث موثقة مرتبطة بالآية' });
    await expect(hadithToggle).toBeVisible();
    await hadithToggle.click();

    const cards = page.locator('article').filter({ hasText: 'صحيح البخاري' });
    await expect(cards).toHaveCount(2);
    const card = cards.first();
    await expect(card).toContainText('رقم الحديث 1');
    await expect(card).toContainText('بدء الوحي');
    await expect(card).toContainText('أحكام المحدثين في المصدر');
    await expect(card).toContainText('ناقد موثق للاختبار');
    await expect(card).toContainText('معرّف إحالة المصدر: 222');
    await expect(card).toContainText('معرّف نص الحديث: 111');
    await expect(card.locator('p[dir="rtl"][lang="ar"]')).toContainText('مَتْنُ حَدِيثٍ عَرَبِيٍّ بِالتَّشْكِيلِ');
    await expect(cards.nth(1).locator('p[dir="rtl"][lang="ar"]')).toContainText('رواية أخرى لها معرّف مصدر مستقل');
  });

});
