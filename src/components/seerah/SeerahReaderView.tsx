import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpenText,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  PanelRightClose,
  Settings2,
  Type
} from 'lucide-react';
import {
  readSeerahReadingPosition,
  saveSeerahReadingPosition,
  readSeerahBookmarks,
  saveSeerahBookmark,
  removeSeerahBookmark
} from '../../services/seerahReadingProgress';
import type { SeerahBookmark } from '../../services/seerahReadingProgress';
import type { SeerahSourceReference } from '../../services/seerahContentContract';
import { createSeerahSceneAnchorId, SeerahBookManifest } from '../../services/seerahBookManifest';
import { SeerahSourcePanel } from './SeerahSourcePanel';

type ReaderPanel = 'contents' | 'context' | null;
type Scene = { id: string; title: string; anchorId: string };

const PROTOTYPE_BOOK_ID = 'seerah-reader-prototype';
const PROTOTYPE_PART_ID = 'prototype-part';
const PROTOTYPE_CHAPTER_ID = 'prototype-chapter';
const PROTOTYPE_VERSION = 'reader-shell-prototype-1';

// Temporary navigation fixture only. It contains no historical narrative and is
// deliberately marked draft so it cannot pass the publication manifest gate.
const PROTOTYPE_MANIFEST: SeerahBookManifest = {
  schemaVersion: 1,
  bookId: PROTOTYPE_BOOK_ID,
  contentVersion: PROTOTYPE_VERSION,
  status: 'draft',
  parts: [{
    id: PROTOTYPE_PART_ID,
    title: 'جزء نموذجي',
    order: 1,
    chapters: [{
      id: PROTOTYPE_CHAPTER_ID,
      title: 'فصل نموذجي',
      order: 1,
      scenes: [
        { id: 'scene-1', title: 'المشهد الأول — بداية الفصل', order: 1, anchorId: createSeerahSceneAnchorId(PROTOTYPE_BOOK_ID, PROTOTYPE_PART_ID, PROTOTYPE_CHAPTER_ID, 'scene-1') },
        { id: 'scene-2', title: 'المشهد الثاني — امتداد الحكاية', order: 2, anchorId: createSeerahSceneAnchorId(PROTOTYPE_BOOK_ID, PROTOTYPE_PART_ID, PROTOTYPE_CHAPTER_ID, 'scene-2') },
        { id: 'scene-3', title: 'المشهد الثالث — جسر إلى الفصل التالي', order: 3, anchorId: createSeerahSceneAnchorId(PROTOTYPE_BOOK_ID, PROTOTYPE_PART_ID, PROTOTYPE_CHAPTER_ID, 'scene-3') }
      ]
    }]
  }]
};

const PROTOTYPE_SCENES: Scene[] = PROTOTYPE_MANIFEST.parts
  .flatMap(part => part.chapters)
  .flatMap(chapter => chapter.scenes)
  .sort((a, b) => a.order - b.order)
  .map(({ id, title, anchorId }) => ({ id, title, anchorId }));

interface SeerahReaderViewProps {
  sources?: readonly SeerahSourceReference[];
}

export const SeerahReaderView: React.FC<SeerahReaderViewProps> = ({ sources = [] }) => {
  const [activeSceneId, setActiveSceneId] = useState(PROTOTYPE_SCENES[0].id);
  const [activePanel, setActivePanel] = useState<ReaderPanel>('contents');
  const [fontScale, setFontScale] = useState<'normal' | 'large' | 'larger'>('large');
  const [lineSpacing, setLineSpacing] = useState<'comfortable' | 'relaxed'>('relaxed');
  const [bookmarks, setBookmarks] = useState<SeerahBookmark[]>([]);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [readingStateHydrated, setReadingStateHydrated] = useState(false);

  const activeIndex = useMemo(
    () => PROTOTYPE_SCENES.findIndex(scene => scene.id === activeSceneId),
    [activeSceneId]
  );
  const activeScene = PROTOTYPE_SCENES[activeIndex] ?? PROTOTYPE_SCENES[0];
  const isBookmarked = bookmarks.some(bookmark =>
    bookmark.bookVersion === PROTOTYPE_VERSION && bookmark.partId === PROTOTYPE_PART_ID &&
    bookmark.chapterId === PROTOTYPE_CHAPTER_ID && bookmark.sceneId === activeScene.id &&
    bookmark.anchorId === activeScene.anchorId
  );

  useEffect(() => {
    setBookmarks(readSeerahBookmarks());
    const savedPosition = readSeerahReadingPosition();
    if (savedPosition?.bookVersion === PROTOTYPE_VERSION &&
        savedPosition.partId === PROTOTYPE_PART_ID &&
        savedPosition.chapterId === PROTOTYPE_CHAPTER_ID &&
        PROTOTYPE_SCENES.some(scene => scene.id === savedPosition.sceneId)) {
      setActiveSceneId(savedPosition.sceneId);
    }
    // Do not persist the initial scene until the saved position has been restored.
    // Otherwise the first render can overwrite a reader's last position on reload.
    setReadingStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!readingStateHydrated) return;
    const position = {
      bookVersion: PROTOTYPE_VERSION,
      partId: PROTOTYPE_PART_ID,
      chapterId: PROTOTYPE_CHAPTER_ID,
      sceneId: activeScene.id,
      anchorId: activeScene.anchorId,
      updatedAt: new Date().toISOString()
    };
    setSaved(saveSeerahReadingPosition(position));
  }, [activeScene, readingStateHydrated]);

  const selectScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    const target = PROTOTYPE_SCENES.find(scene => scene.id === sceneId);
    if (target) {
      window.requestAnimationFrame(() => {
        document.getElementById(target.anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const moveScene = (direction: -1 | 1) => {
    const next = Math.min(PROTOTYPE_SCENES.length - 1, Math.max(0, activeIndex + direction));
    selectScene(PROTOTYPE_SCENES[next].id);
  };

  const fontClass = fontScale === 'larger' ? 'text-xl sm:text-2xl' : fontScale === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg';
  const spacingClass = lineSpacing === 'relaxed' ? 'leading-[2.25]' : 'leading-[1.9]';

  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-5 pb-10">
      <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <BookOpenText className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">نموذج واجهة — ليس محتوى تاريخيًا منشورًا</p>
            <p className="mt-1 text-xs leading-6 opacity-90">
              هذه تجربة أولية للقارئ والتنقل وحفظ موضع القراءة. عناوين المشاهد والنصوص أدناه عناصر واجهة تجريبية فقط؛ لن تظهر روايات تاريخية قبل توثيقها ومراجعتها واعتمادها.
            </p>
          </div>
        </div>
      </div>

      <header className="overflow-hidden rounded-3xl border border-[#C59B27]/25 bg-[#F9F6EE] shadow-sm dark:border-[#E0A96D]/20 dark:bg-[#0B132B]">
        <div className="relative px-5 py-7 sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 opacity-20" aria-hidden="true">
            <div className="h-full w-full bg-[radial-gradient(circle_at_30%_50%,#C59B27_1px,transparent_1.5px)] [background-size:18px_18px]" />
          </div>
          <p className="text-xs font-bold tracking-wide text-[#8A6C19] dark:text-[#E0A96D]">وِرد · مكتبة الحكايات</p>
          <h2 className="mt-3 text-2xl font-black text-[#142421] dark:text-[#F5F1E8] sm:text-3xl">حكاية السيرة</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600 dark:text-stone-300">
            كتاب تاريخي تفاعلي يُقرأ كحكاية واحدة متصلة؛ أجزاء كبرى، وفصول مترابطة، ومشاهد تتتابع دون أن تتحول إلى دروس منفصلة.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-stone-700 dark:bg-white/10 dark:text-stone-200">القراءة المتصلة هي الأساس</span>
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-stone-700 dark:bg-white/10 dark:text-stone-200">السياق عند الطلب</span>
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-stone-700 dark:bg-white/10 dark:text-stone-200">المصادر مرتبطة بكل معلومة</span>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-[#111F36]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400">الجزء النموذجي · الفصل النموذجي</p>
                <h3 className="mt-1 text-lg font-extrabold text-stone-900 dark:text-stone-100">عنوان الفصل سيظهر هنا بعد اعتماده</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setActivePanel(activePanel === 'contents' ? null : 'contents')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800 lg:hidden" aria-expanded={activePanel === 'contents'}>
                  {activePanel === 'contents' ? <PanelRightClose className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  الفهرس
                </button>
                <button type="button" onClick={() => setActivePanel(activePanel === 'context' ? null : 'context')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800" aria-expanded={activePanel === 'context'}>
                  <BookOpenText className="h-4 w-4" />
                  قراءة وتعلّم
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 dark:border-stone-700">
              <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                <span>المشهد {activeIndex + 1} من {PROTOTYPE_SCENES.length}</span>
                <span aria-hidden="true">·</span>
                <span>{saved ? 'موضع القراءة محفوظ على هذا الجهاز' : 'تعذر حفظ الموضع على هذا الجهاز'}</span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setFontScale(value => value === 'normal' ? 'large' : value === 'large' ? 'larger' : 'normal')} className="flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] dark:text-stone-300 dark:hover:bg-stone-800" title="تغيير حجم الخط"><Type className="h-4 w-4" /> حجم النص</button>
                <button type="button" onClick={() => setLineSpacing(value => value === 'relaxed' ? 'comfortable' : 'relaxed')} className="flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] dark:text-stone-300 dark:hover:bg-stone-800" title="تغيير تباعد السطور"><Settings2 className="h-4 w-4" /> التباعد</button>
              </div>
            </div>
          </div>

          {activePanel === 'context' && (
            <aside className="rounded-2xl border border-[#C59B27]/30 bg-[#FBF8EF] p-4 text-sm dark:border-[#E0A96D]/25 dark:bg-[#111F36]" aria-label="لوحة السياق">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-extrabold text-stone-900 dark:text-stone-100">سياق الفصل ومصادره</h4>
                <button type="button" onClick={() => setActivePanel(null)} className="min-h-9 rounded-lg px-2 text-xs text-stone-600 hover:bg-white dark:text-stone-300 dark:hover:bg-stone-800">إغلاق</button>
              </div>
              <p className="mt-2 leading-7 text-stone-600 dark:text-stone-300">تظهر إحالات الشخصيات والأماكن والأحداث والمراجع المعتمدة هنا، مرتبطة بمواضعها في النص. لا تُعرض مصادر غير مراجعة على أنها معتمدة.</p>
              <SeerahSourcePanel sources={sources} />
            </aside>
          )}

          <article className="rounded-3xl border border-stone-200 bg-white px-5 py-7 shadow-sm dark:border-stone-700 dark:bg-[#111F36] sm:px-9 sm:py-10">
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-[#8A6C19] dark:text-[#E0A96D]">مشهد تجريبي · لا يحتوي على سرد تاريخي</span>
                <button type="button" onClick={() => {
                  const bookmark: SeerahBookmark = {
                    bookVersion: PROTOTYPE_VERSION,
                    partId: PROTOTYPE_PART_ID,
                    chapterId: PROTOTYPE_CHAPTER_ID,
                    sceneId: activeScene.id,
                    anchorId: activeScene.anchorId,
                    createdAt: new Date().toISOString()
                  };
                  const changed = isBookmarked
                    ? removeSeerahBookmark(bookmark)
                    : saveSeerahBookmark(bookmark);
                  if (changed) {
                    setBookmarks(readSeerahBookmarks());
                    setBookmarkError(null);
                  } else {
                    setBookmarkError('تعذر حفظ التغيير في العلامات على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.');
                  }
                }} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${isBookmarked ? 'bg-[#1C4E46] text-white dark:bg-[#1E4A47]' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-200'}`} aria-pressed={isBookmarked} aria-label={isBookmarked ? 'إزالة علامة هذا المشهد' : 'حفظ علامة لهذا المشهد'}>
                  {isBookmarked ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                  {isBookmarked ? 'إزالة العلامة' : 'حفظ علامة'}
                </button>
              </div>
              {bookmarkError && <p role="alert" className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">{bookmarkError}</p>}
              <h4 id={activeScene.anchorId} className="scroll-mt-28 text-center text-xl font-black leading-relaxed text-stone-900 dark:text-stone-100 sm:text-2xl">{activeScene.title}</h4>
              <div className={`mx-auto mt-8 max-w-2xl space-y-6 text-justify text-stone-700 dark:text-stone-200 ${fontClass} ${spacingClass}`}>
                <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-center text-sm leading-8 text-stone-500 dark:border-stone-600 dark:bg-stone-900/30 dark:text-stone-400">
                  مساحة السرد المتصل. سيُعرض النص هنا في فقرات مترابطة، لا في بطاقات دروس منفصلة. لن نملأ هذه المساحة بمعلومات تاريخية قبل توثيق كل ادعاء وربطه بمصدره ومراجعته.
                </p>
                <p className="text-sm leading-8 text-stone-500 dark:text-stone-400">
                  عند اعتماد المحتوى، ستُحفظ إحالات المصادر والسياق بجوار الفقرة المعنية، ويمكن فتحها دون مغادرة موضع القراءة.
                </p>
              </div>
              <div className="mt-10 flex items-center justify-between gap-3 border-t border-stone-100 pt-5 dark:border-stone-700">
                <button type="button" disabled={activeIndex === 0} onClick={() => moveScene(-1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-4 text-xs font-bold text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"><ChevronRight className="h-4 w-4" /> المشهد السابق</button>
                <button type="button" disabled={activeIndex === PROTOTYPE_SCENES.length - 1} onClick={() => moveScene(1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1C4E46] px-4 text-xs font-bold text-white transition-colors hover:bg-[#163E38] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#1E4A47] dark:hover:bg-[#285B55]">المشهد التالي <ChevronLeft className="h-4 w-4" /></button>
              </div>
            </div>
          </article>
        </section>

        <aside className={`${activePanel === 'contents' ? 'block' : 'hidden'} lg:block rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-[#111F36]`} aria-label="فهرس الكتاب">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400">رحلة القراءة</p>
              <h3 className="mt-1 font-extrabold text-stone-900 dark:text-stone-100">فهرس الفصل</h3>
            </div>
            <List className="h-5 w-5 text-[#8A6C19] dark:text-[#E0A96D]" aria-hidden="true" />
          </div>
          <div className="mt-4 space-y-2">
            {PROTOTYPE_SCENES.map((scene, index) => (
              <button key={scene.id} type="button" onClick={() => selectScene(scene.id)} aria-current={activeSceneId === scene.id ? 'step' : undefined} className={`w-full rounded-xl border px-3 py-3 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${activeSceneId === scene.id ? 'border-[#1C4E46]/40 bg-[#1C4E46]/5 text-[#1C4E46] dark:border-[#E0A96D]/40 dark:bg-[#E0A96D]/10 dark:text-[#F5F1E8]' : 'border-stone-100 text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800'}`}>
                <span className="block text-[10px] font-bold opacity-60">المشهد {index + 1}</span>
                <span className="mt-1 block text-xs font-bold leading-6">{scene.title}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-stone-50 p-3 dark:bg-stone-900/40">
            <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">حالة المحتوى</p>
            <p className="mt-1 text-xs font-bold text-amber-800 dark:text-amber-300">هيكل تجريبي — بانتظار اعتماد المصادر والنص</p>
          </div>
          <div className="mt-5 border-t border-stone-100 pt-4 dark:border-stone-700">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold text-stone-800 dark:text-stone-100">علاماتي المحفوظة</h4>
              <Bookmark className="h-4 w-4 text-[#8A6C19] dark:text-[#E0A96D]" aria-hidden="true" />
            </div>
            <div className="mt-3 space-y-2">
              {bookmarks
                .filter(bookmark => bookmark.bookVersion === PROTOTYPE_VERSION && bookmark.partId === PROTOTYPE_PART_ID && bookmark.chapterId === PROTOTYPE_CHAPTER_ID)
                .map(bookmark => {
                  const scene = PROTOTYPE_SCENES.find(item => item.id === bookmark.sceneId && item.anchorId === bookmark.anchorId);
                  if (!scene) return null;
                  return (
                    <button key={`${bookmark.bookVersion}:${bookmark.sceneId}:${bookmark.anchorId}`} type="button" onClick={() => selectScene(scene.id)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-right text-xs font-semibold text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800">
                      {scene.title}
                    </button>
                  );
                })}
              {bookmarks.filter(bookmark => bookmark.bookVersion === PROTOTYPE_VERSION && bookmark.partId === PROTOTYPE_PART_ID && bookmark.chapterId === PROTOTYPE_CHAPTER_ID).length === 0 && (
                <p className="text-[11px] leading-6 text-stone-500 dark:text-stone-400">لم تحفظ علامات بعد. يمكنك الرجوع إلى أي مشهد تحفظه هنا.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
