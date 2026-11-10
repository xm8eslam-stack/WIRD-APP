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


test('Mushaf page jump rejects invalid pages and accepts a valid page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /فتح المصحف بالصفحات/ }).click();

  const pageInput = page.getByRole('spinbutton', { name: 'رقم صفحة المصحف' });
  await pageInput.fill('605');
  await page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' }).click();
  await expect(page.getByRole('alert')).toHaveText('أدخل رقم صفحة صحيحاً من 1 إلى 604.');

  await pageInput.fill('2');
  await page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' }).click();
  await expect(page.getByText('2 / 604')).toBeVisible();
});


test('Mushaf primary touch controls meet the 44px minimum target on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /فتح المصحف بالصفحات/ }).click();

  await expect(page.getByRole('button', { name: 'الصفحة السابقة' })).toHaveCSS('min-height', '44px');
  await expect(page.getByRole('button', { name: 'الصفحة التالية' })).toHaveCSS('min-height', '44px');
  await expect(page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' })).toHaveCSS('min-height', '44px');
  await expect(page.getByRole('button', { name: 'استماع للمقطع' })).toHaveCSS('min-height', '44px');
});


test('Tafsir dialog supports Escape, traps keyboard focus, and restores the ayah action focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: /تلاوة ودراسة: سورة/ }).click();
  await page.getByRole('button', { name: 'قراءة متصلة' }).click();

  const ayahAction = page.getByRole('button', { name: 'تفسير سورة الفاتحة، الآية 1' });
  await ayahAction.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const closeButton = dialog.getByRole('button', { name: 'إغلاق التفسير' });
  const copyButton = dialog.getByRole('button', { name: 'نسخ الآية والتفسير' });
  const developerLink = dialog.getByRole('link', { name: 'منصة مطوري Quran.com' });
  await expect(closeButton).toBeFocused();
  // The copy action is intentionally disabled until the verified tafsir text is ready.
  await expect(copyButton).toBeEnabled({ timeout: 15000 });
  await page.keyboard.press('Shift+Tab');
  await expect(copyButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(developerLink).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(ayahAction).toBeFocused();
});


test('Mushaf reader keeps flexible layout disclosure and remembers reading display preferences', async ({ page }) => {
  await page.goto('/');
  const guestEntry = page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' });
  const appNavigation = page.getByRole('navigation', { name: 'القائمة الرئيسية' })
    .or(page.getByRole('navigation', { name: 'التنقل السريع' }));
  await expect(guestEntry.or(appNavigation)).toBeVisible({ timeout: 15000 });
  if (await guestEntry.isVisible()) await guestEntry.click();
  await page.goto('/#/library');
  await expect(page.getByRole('heading', { name: 'القرآن الكريم' })).toBeVisible();
  await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();

  await expect(page.getByRole('main', { name: /صفحة المصحف/ })).toBeVisible();
  await expect(page.getByText(/عرض الآيات موزّع داخل صفحة مرنة، وليس محاكاة مطابقة لأسطر المصحف المطبوع/)).toBeVisible();

  const displayControls = page.getByRole('group', { name: 'إعدادات عرض المصحف' });
  await expect(displayControls).toBeVisible();
  await displayControls.getByRole('button', { name: 'أكبر' }).click();
  await expect(displayControls.getByRole('button', { name: 'أكبر' })).toHaveAttribute('aria-pressed', 'true');
  await displayControls.getByRole('button', { name: 'توسيع مساحة القراءة' }).click();
  await expect(displayControls.getByRole('button', { name: 'تقليل عرض الصفحة' })).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await page.goto('/#/library');
  await expect(page.getByRole('heading', { name: 'القرآن الكريم' })).toBeVisible();
  await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
  const restoredControls = page.getByRole('group', { name: 'إعدادات عرض المصحف' });
  await expect(restoredControls.getByRole('button', { name: 'أكبر' })).toHaveAttribute('aria-pressed', 'true');
  await expect(restoredControls.getByRole('button', { name: 'تقليل عرض الصفحة' })).toHaveAttribute('aria-pressed', 'true');
});

test('Mushaf plays a selected ayah segment continuously and repeats the bounded range', async ({ page }) => {
  await page.addInitScript(() => {
    const instances: any[] = [];
    class MockAudio {
      url: string;
      preload = 'auto';
      playbackRate = 1;
      playCalls = 0;
      onended: ((event: Event) => void) | null = null;
      onplaying: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor(url: string) { this.url = url; instances.push(this); }
      load() {}
      pause() {}
      play() { this.playCalls += 1; return Promise.resolve(); }
    }
    (window as any).__wirdMushafAudioInstances = instances;
    (window as any).Audio = MockAudio;
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'فتح المصحف' }).click();
  await expect(page.getByRole('main', { name: 'صفحة المصحف 1' })).toBeVisible();

  await page.getByLabel('بداية المقطع الصوتي').selectOption('1');
  await page.getByLabel('نهاية المقطع الصوتي').selectOption('2');
  await page.getByLabel('عدد مرات تكرار المقطع الصوتي').selectOption('2');
  await page.getByRole('button', { name: 'استماع للمقطع' }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__wirdMushafAudioInstances.length)).toBe(2);
  await expect.poll(() => page.evaluate(() => (window as any).__wirdMushafAudioInstances[0].playCalls)).toBe(1);
  await page.evaluate(() => (window as any).__wirdMushafAudioInstances[0].onended?.(new Event('ended')));
  await expect.poll(() => page.evaluate(() => (window as any).__wirdMushafAudioInstances[1].playCalls)).toBe(1);
  await page.evaluate(() => (window as any).__wirdMushafAudioInstances[1].onended?.(new Event('ended')));
  await expect.poll(() => page.evaluate(() => (window as any).__wirdMushafAudioInstances.length)).toBe(3);
  await expect.poll(() => page.evaluate(() => (window as any).__wirdMushafAudioInstances[2].playCalls)).toBe(1);
});

test('Mushaf width and line spacing controls persist and can be reset', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'فتح المصحف' }).click();

  const pageRegion = page.getByRole('main', { name: 'صفحة المصحف 1' });
  const spacing = page.getByLabel('تباعد أسطر المصحف');
  await spacing.selectOption('relaxed');
  await page.getByRole('button', { name: 'ملء الشاشة' }).click();
  await expect(pageRegion).toHaveAttribute('data-mushaf-page-width', 'full');
  await expect(page.locator('[data-mushaf-line-spacing="relaxed"]')).toBeVisible();

  await page.getByRole('button', { name: 'العودة للفهرس' }).click();
  await page.getByRole('button', { name: 'فتح المصحف' }).click();
  await expect(page.getByRole('main', { name: 'صفحة المصحف 1' })).toHaveAttribute('data-mushaf-page-width', 'full');
  await expect(page.getByLabel('تباعد أسطر المصحف')).toHaveValue('relaxed');

  await page.getByRole('button', { name: 'إعادة ضبط العرض' }).click();
  await expect(page.getByRole('main', { name: 'صفحة المصحف 1' })).toHaveAttribute('data-mushaf-page-width', 'comfortable');
  await expect(page.getByLabel('تباعد أسطر المصحف')).toHaveValue('normal');
});
