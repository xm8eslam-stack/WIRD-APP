import { expect, test, type Page } from '@playwright/test';

const INDEX_ENDPOINT = '**/api/ruqyah**';

async function openExtendedLibrary(page: Page) {
  // Ruqyah is available to guest users, so establish the supported guest session first.
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await expect(page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' })).toHaveCount(0);
  await page.goto('/#/ruqyah');
  await expect(page.getByRole('heading', { name: 'الرقية الشرعية الكاملة من القرآن والسنة' })).toBeVisible();
  await page.getByRole('button', { name: 'المكتبة الموسعة' }).click();
  await expect(page.getByRole('heading', { name: 'فهرس مواضع الآيات' })).toBeVisible();
}

function validIndexResponse(data: unknown[]) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'success', data })
  };
}

test.describe('Ruqyah Quran locator library', () => {
  test('shows loading state while the index is pending, then renders canonical Quran text only', async ({ page }) => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });

    await page.route(INDEX_ENDPOINT, async route => {
      await responseGate;
      await route.fulfill(validIndexResponse([{
        id: 1,
        title: '1:1-7',
        arabic: 'نص خارجي غير موثوق',
        translation: 'ترجمة خارجية غير موثوقة',
        reference: 'مرجع غير معتمد'
      }]));
    });

    await openExtendedLibrary(page);
    await expect(page.getByText('جارٍ تحميل فهرس مواضع الآيات...')).toBeVisible();
    releaseResponse();

    await expect(page.getByRole('heading', { name: 'سورة الفاتحة' })).toBeVisible();
    await expect(page.getByText('نص خارجي غير موثوق')).toHaveCount(0);
    await expect(page.getByText('ترجمة خارجية غير موثوقة')).toHaveCount(0);
    await expect(page.getByText('مرجع غير معتمد')).toHaveCount(0);
    await expect(page.getByText(/بِسْمِ/)).toBeVisible();
  });

  test('shows a distinct empty state when the locator index returns no entries', async ({ page }) => {
    await page.route(INDEX_ENDPOINT, route => route.fulfill(validIndexResponse([])));
    await openExtendedLibrary(page);
    await expect(page.getByText('لا توجد مواضع قرآنية في هذا القسم من الفهرس.')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('shows network errors and successfully retries without stale results', async ({ page }) => {
    let requests = 0;
    await page.route(INDEX_ENDPOINT, async route => {
      requests++;
      if (requests === 1) {
        await route.abort('failed');
        return;
      }
      await route.fulfill(validIndexResponse([{ id: 2, title: '2:1-5' }]));
    });

    await openExtendedLibrary(page);
    await expect(page.getByRole('alert')).toContainText('تعذر الاتصال بمصدر الرقية');
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(page.getByRole('heading', { name: 'سورة البقرة' })).toBeVisible();
    expect(requests).toBe(2);
  });


  test('fails closed when the proxy is bypassed and returns an out-of-range locator', async ({ page }) => {
    await page.route(INDEX_ENDPOINT, route => route.fulfill(validIndexResponse([
      { id: 3, title: '115:1', arabic: 'نص خارجي غير موثوق' }
    ])));
    await openExtendedLibrary(page);
    await expect(page.getByRole('heading', { name: 'موضع قرآني غير صالح' })).toBeVisible();
    await expect(page.getByText('موضع الآيات في الفهرس الخارجي خارج حدود المصحف المعتمد.')).toBeVisible();
    await expect(page.getByText('نص خارجي غير موثوق')).toHaveCount(0);
  });

  test('filters only canonical surah names and normalized Arabic numeral coordinates', async ({ page }) => {
    await page.route(INDEX_ENDPOINT, route => route.fulfill(validIndexResponse([
      { id: 1, title: '1:1-7' },
      { id: 2, title: '2:1-5' }
    ])));
    await openExtendedLibrary(page);
    await expect(page.getByRole('heading', { name: 'سورة الفاتحة' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'سورة البقرة' })).toBeVisible();

    const search = page.getByLabel('البحث في فهرس مواضع الآيات');
    await search.fill('البقرة');
    await expect(page.getByRole('heading', { name: 'سورة البقرة' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'سورة الفاتحة' })).toHaveCount(0);

    await search.fill('١:١-٧');
    await expect(page.getByRole('heading', { name: 'سورة الفاتحة' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'سورة البقرة' })).toHaveCount(0);

    await search.fill('سورة غير موجودة');
    await expect(page.getByText('لا توجد مواضع مطابقة لعبارة البحث.')).toBeVisible();
  });
});
