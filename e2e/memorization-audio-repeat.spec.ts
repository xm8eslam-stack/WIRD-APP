import { expect, test } from '@playwright/test';

test.describe('Memorization session audio repetition', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('wird.audio.repeatCount.v1', '2');
      const audios: Array<{ onended: ((event: Event) => void) | null; onplaying: (() => void) | null }> = [];
      (window as any).__wirdMockAudios = audios;
      (window as any).__wirdAudioPlayCalls = 0;
      (window as any).__wirdRejectAudioPlay = false;
      (window as any).__wirdMarkAudioPlaying = () => audios.at(-1)?.onplaying?.();
      (window as any).Audio = class MockAudio {
        currentTime = 0;
        playbackRate = 1;
        preload = 'auto';
        error = null;
        onended: ((event: Event) => void) | null = null;
        onplaying: (() => void) | null = null;
        onerror: (() => void) | null = null;
        url: string;
        constructor(url: string) { this.url = url; audios.push(this); }
        play() {
          (window as any).__wirdAudioPlayCalls++;
          if ((window as any).__wirdRejectAudioPlay) {
            (window as any).__wirdRejectAudioPlay = false;
            return Promise.reject(new Error('blocked'));
          }
          return Promise.resolve();
        }
        pause() {}
      };
    });
  });

  test('replays the selected ayah count, remembers it, and stops on the final ending', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');

    const repeatPicker = page.getByLabel('عدد مرات تكرار الصوت');
    await expect(repeatPicker).toHaveValue('2');
    await repeatPicker.selectOption('3');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird.audio.repeatCount.v1'))).toBe('3');
    await repeatPicker.selectOption('2');
    await page.getByLabel('سرعة تشغيل الصوت').selectOption('1.5');

    await page.getByRole('button', { name: 'استماع للآية' }).click();
    const audioStatus = page.getByRole('status').filter({ hasText: 'جارٍ تحميل التلاوة' });
    await expect(audioStatus).toContainText('جارٍ تحميل التلاوة');
    await page.evaluate(() => (window as any).__wirdMarkAudioPlaying());
    await expect(audioStatus).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as any).__wirdAudioPlayCalls)).toBe(1);
    await expect.poll(() => page.evaluate(() => (window as any).__wirdMockAudios.at(-1).playbackRate)).toBe(1.5);
    await page.evaluate(() => {
      const audio = (window as any).__wirdMockAudios.at(-1);
      audio.onended?.(new Event('ended'));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__wirdAudioPlayCalls)).toBe(2);

    await page.evaluate(() => {
      const audio = (window as any).__wirdMockAudios.at(-1);
      audio.onended?.(new Event('ended'));
    });
    await expect(page.getByRole('button', { name: 'استماع للآية' })).toBeVisible();
    await expect(page.getByText(/عدّاد التكرار والتثبيت \(2 \/ 5\)/)).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__wirdAudioPlayCalls)).toBe(2);
  });

  test('continuous playback stops when the session exits', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.evaluate(() => localStorage.setItem('wird.audio.repeatCount.v1', '-1'));
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');
    await page.getByRole('button', { name: 'استماع للآية' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__wirdAudioPlayCalls)).toBe(1);
    await page.evaluate(() => {
      const audio = (window as any).__wirdMockAudios.at(-1);
      audio.onended?.(new Event('ended'));
    });
    await expect.poll(() => page.evaluate(() => (window as any).__wirdAudioPlayCalls)).toBe(2);
    await page.getByRole('button', { name: 'خروج من الجلسة' }).click();
    await page.getByRole('button', { name: 'مغادرة الجلسة' }).click();
    await expect(page.getByRole('heading', { name: 'الرئيسية' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__wirdMockAudios.at(-1).onended)).toBeNull();
  });

  test('a verse change detaches the previous audio loop', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.evaluate(() => localStorage.setItem('wird.audio.repeatCount.v1', '-1'));
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');
    await page.getByRole('button', { name: 'استماع للآية' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__wirdAudioPlayCalls)).toBe(1);
    await page.getByRole('button', { name: 'الآية التالية' }).click();
    await expect(page.getByText(/الآية 2 من 3/)).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__wirdMockAudios.at(-1).onended)).toBeNull();
  });

  test('play rejection and media load errors return the audio control to idle', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');
    await page.evaluate(() => { (window as any).__wirdRejectAudioPlay = true; });
    await page.getByRole('button', { name: 'استماع للآية' }).click();
    await expect(page.getByRole('button', { name: 'استماع للآية' })).toBeVisible();
    const audioStatus = page.getByRole('status').filter({ hasText: 'جارٍ تحميل التلاوة' });
    await expect(audioStatus).toHaveCount(0);

    await page.getByRole('button', { name: 'استماع للآية' }).click();
    await page.evaluate(() => (window as any).__wirdMockAudios.at(-1).onerror?.());
    await expect(page.getByRole('button', { name: 'استماع للآية' })).toBeVisible();
    await expect(audioStatus).toHaveCount(0);
  });

  test('session interface can be resized and ayah navigation remains sticky and reachable', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');

    const scale = page.getByLabel('حجم واجهة جلسة الحفظ');
    await expect(scale).toHaveValue('100');
    await scale.focus();
    await scale.press('Home');
    await expect.poll(() => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('wird:memorization-display:v1') || '{}');
      return saved.uiScale;
    })).toBe(80);
    await scale.press('ArrowLeft'); // RTL range inputs increase toward the left.
    await expect.poll(() => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('wird:memorization-display:v1') || '{}');
      return saved.uiScale;
    })).toBe(85);

    const navigation = page.getByRole('group', { name: 'التنقل بين آيات جلسة الحفظ' });
    await expect(navigation).toBeVisible();
    await expect.poll(() => navigation.evaluate(element => getComputedStyle(element).position)).toBe('sticky');
    await expect(navigation.getByRole('button', { name: 'السابقة' })).toBeDisabled();
    await navigation.getByRole('button', { name: 'الآية التالية' }).click();
    await expect(page.getByText(/الآية 2 من 3/)).toBeVisible();
    await expect(navigation.getByRole('button', { name: 'السابقة' })).toBeEnabled();
  });
});


test('session header and progress adapt to mobile, and masked words remain keyboard operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');

  const progress = page.getByRole('progressbar', { name: 'تقدم جلسة الحفظ' });
  await expect(progress).toHaveAttribute('aria-valuemax', '3');
  await expect(progress).toHaveAttribute('aria-valuenow', '1');

  await page.getByRole('button', { name: 'إخفاء تام' }).click();
  const hiddenWords = page.getByRole('button', { name: /إظهار الكلمة رقم/ });
  await expect(hiddenWords.first()).toBeVisible();
  const hiddenCount = await hiddenWords.count();
  await hiddenWords.first().focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => hiddenWords.count()).toBe(hiddenCount - 1);

  await page.getByRole('button', { name: 'الآية التالية' }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
  await expect(progress).toHaveAttribute('aria-valuetext', 'الآية 2 من 3');

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);
});

test('memorization and review share continuous segment playback with bounded repetition', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');

  await page.getByLabel('بداية المقطع الصوتي في الجلسة').selectOption('1');
  await page.getByLabel('نهاية المقطع الصوتي في الجلسة').selectOption('2');
  await page.getByLabel('عدد مرات تكرار الصوت').selectOption('2');
  await page.getByRole('button', { name: 'تشغيل المقطع الصوتي المحدد' }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__wirdMockAudios.length)).toBe(2);
  await page.evaluate(() => (window as any).__wirdMockAudios[0].onended?.(new Event('ended')));
  await expect.poll(() => page.evaluate(() => (window as any).__wirdAudioPlayCalls)).toBe(2);
  await page.evaluate(() => (window as any).__wirdMockAudios[1].onended?.(new Event('ended')));
  await expect.poll(() => page.evaluate(() => (window as any).__wirdMockAudios.length)).toBe(4);
  await page.evaluate(() => (window as any).__wirdMockAudios[2].onended?.(new Event('ended')));
  await page.evaluate(() => (window as any).__wirdMockAudios[3].onended?.(new Event('ended')));

  const urls = await page.evaluate(() => (window as any).__wirdMockAudios.map((audio: { url: string }) => audio.url));
  expect(urls.map((url: string) => url.split('/').pop())).toEqual([
    '067002.mp3',
    '067003.mp3',
    '067002.mp3',
    '067003.mp3'
  ]);
  await expect(page.getByRole('button', { name: 'تشغيل المقطع الصوتي المحدد' })).toBeVisible();
});
