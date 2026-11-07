import { expect, test, type Page } from '@playwright/test';

async function openRuqyah(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await expect(page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' })).toHaveCount(0);
  await page.goto('/#/ruqyah');
  await expect(page.getByRole('heading', { name: 'الرقية الشرعية الكاملة من القرآن والسنة' })).toBeVisible();
}

test.describe('Ruqyah verified Quran audio playback', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value: function () {
          this.dispatchEvent(new Event('play'));
          return Promise.resolve();
        }
      });
      Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
        configurable: true,
        value: function () {
          this.dispatchEvent(new Event('pause'));
        }
      });
      Object.defineProperty(HTMLMediaElement.prototype, 'load', {
        configurable: true,
        value: function () {}
      });
    });
  });

  test('plays the current Quran section, supports pause/resume/stop, and never alters reading counts', async ({ page }) => {
    await openRuqyah(page);
    const player = page.getByRole('region', { name: 'مشغل تلاوة آيات الرقية' });
    await expect(player).toBeVisible();
    await player.getByLabel('اختيار قارئ الرقية').selectOption('ar.alafasy');
    await player.getByRole('button', { name: 'تشغيل آيات القسم' }).click();

    await expect(player.getByRole('status')).toContainText('يتم التشغيل:');
    const fatihahCard = page.locator('article').filter({ hasText: 'سورة الفاتحة' }).first();
    await expect(fatihahCard.getByRole('button', { name: 'إيقاف تلاوة سورة الفاتحة' })).toBeVisible();
    await expect(fatihahCard.getByText('0 قراءة')).toBeVisible();

    await player.getByRole('button', { name: 'إيقاف مؤقت' }).click();
    await expect(player.getByRole('status')).toContainText('متوقف مؤقتًا:');
    await player.getByRole('button', { name: 'استكمال' }).click();
    await expect(player.getByRole('status')).toContainText('يتم التشغيل:');
    await player.getByRole('button', { name: 'إيقاف', exact: true }).click();

    await expect(player.getByRole('button', { name: 'استكمال' })).toHaveCount(0);
    await expect(fatihahCard.getByText('0 قراءة')).toBeVisible();
    await expect(player.getByRole('alert')).toHaveCount(0);
  });

  test('individual Quran verse controls play only their validated local ayah range', async ({ page }) => {
    await openRuqyah(page);
    const fatihahCard = page.locator('article').filter({ hasText: 'سورة الفاتحة' }).first();
    await fatihahCard.getByRole('button', { name: 'تشغيل تلاوة سورة الفاتحة' }).click();

    const player = page.getByRole('region', { name: 'مشغل تلاوة آيات الرقية' });
    await expect(player.getByRole('status')).toContainText('يتم التشغيل: سورة الفاتحة');
    await expect(player.getByText(/سورة الفاتحة/)).toBeVisible();
    await expect(fatihahCard.getByText('0 قراءة')).toBeVisible();
  });

  test('changing Ruqyah category stops active audio before the new section is shown', async ({ page }) => {
    await openRuqyah(page);
    const player = page.getByRole('region', { name: 'مشغل تلاوة آيات الرقية' });
    await player.getByRole('button', { name: 'تشغيل آيات القسم' }).click();
    await expect(player.getByRole('status')).toContainText('يتم التشغيل:');

    await page.getByRole('button', { name: 'الرقية المتوسطة' }).click();
    await expect(player.getByRole('button', { name: 'استكمال' })).toHaveCount(0);
  });
});
