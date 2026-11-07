import React, { useEffect, useState, useRef } from 'react';
import { 
  Settings, 
  User, 
  Volume2, 
  Type, 
  Moon, 
  Sun, 
  RotateCcw, 
  Save, 
  Check, 
  ShieldAlert,
  Sparkles,
  Download,
  Upload,
  FileText,
  Database,
  AlertTriangle,
  LogOut,
  CheckCircle2,
  KeyRound,
  Shield,
  Cloud,
  CloudCheck,
  CloudOff,
  CloudAlert,
  RefreshCw
} from 'lucide-react';
import { UserProfile, ReciterId } from '../../types/quran';
import { RECITERS } from '../../services/audioService';
import { StorageService } from '../../services/storageService';
import { RetentionService } from '../../services/retentionService';
import { useAuth } from '../../context/AuthContext';
import { useCloudSync } from '../../hooks/useCloudSync';
import { LocalSyncOutbox } from '../../services/localSyncOutbox';
import type { RemoteProjectionConflict } from '../../services/indexedDbSyncJournal';
import { getLocalDateString } from '../../services/unifiedPortionService';
import { importBackupFile } from '../../services/backupPersistence';
import { loadDemoDataJournaled } from '../../services/demoDataPersistence';

function formatConflictSnapshotValue(value: string | null): string {
  if (value === null) return 'null';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

interface SettingsViewProps {
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onSaveProfile: (profile: UserProfile) => Promise<boolean>;
  onResetAllData: () => Promise<boolean>;
  onBackupImported?: () => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
  onSaveProfile,
  onResetAllData,
  onBackupImported,
  onToast
}) => {
  const [formData, setFormData] = useState<UserProfile>(profile);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);
  const [isSaved, setIsSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!await onSaveProfile(formData)) return;
    setIsSaved(true);
    if (onToast) {
      onToast("تم حفظ التعديلات وإعدادات الملف الشخصي بنجاح", "success");
    }
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleConfirmReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      const resetSucceeded = await onResetAllData();
      setFormData(StorageService.getProfile());
      if (!resetSucceeded) {
        onToast?.('تعذر تأكيد إعادة الضبط؛ لم نغلق نافذة التأكيد ولم نعلن نجاح العملية.', 'error');
        return;
      }
      setShowResetConfirm(false);
      onToast?.("تمت إعادة ضبط البيانات وحفظها في سجل الاستعادة بنجاح", "info");
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportBackup = () => {
    const backupJson = StorageService.exportFullBackup();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wird-quran-backup-${getLocalDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (onToast) {
      onToast("تم تصدير ملف النسخة الاحتياطية بنجاح (ملف نصي JSON غير مشفر)", "success");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || isImporting) return;

    setIsImporting(true);
    try {
      const result = await importBackupFile(file);
      if (result.success) {
        const updated = StorageService.getProfile();
        setFormData(updated);
        onUpdateProfile(updated);
        onBackupImported?.();
        onToast?.(result.message, 'success');
      } else {
        if (result.recoveredPriorEvents) onBackupImported?.();
        onToast?.(`فشل استيراد النسخة: ${result.message}`, 'error');
      }
    } catch (error) {
      onToast?.(
        `فشل استيراد النسخة: ${error instanceof Error ? error.message : 'خطأ غير متوقع'}`,
        'error'
      );
    } finally {
      setIsImporting(false);
      input.value = '';
    }
  };

  const { user, isGuest, isEmailVerified, logout } = useAuth();
  const {
    status: syncStatus, pendingCount, remoteInboxPendingCount,
    remoteProjectionBlockReason, remoteProjectionBlockedAtSequence,
    projectionConflictCount, latestProjectionConflict,
    lastSyncAtMs, isOnline, errorMessage: syncErrorMessage, triggerSync
  } = useCloudSync();
  const [conflictDetails, setConflictDetails] = useState<RemoteProjectionConflict[]>([]);
  useEffect(() => {
    let active = true;
    if (!user?.uid || isGuest || StorageService.getStorageScope() !== 'user:' + user.uid) {
      setConflictDetails([]);
      return () => { active = false; };
    }
    void LocalSyncOutbox.listProjectionConflicts(20)
      .then(records => { if (active) setConflictDetails(records); })
      .catch(() => { if (active) setConflictDetails([]); });
    return () => { active = false; };
  }, [user?.uid, isGuest, projectionConflictCount, latestProjectionConflict?.eventId]);

  const projectionBlockMessages: Record<string, string> = {
    projection_disabled: 'استقبال الأحداث غير مفعّل بعد؛ نحتفظ بها دون تطبيقها.',
    legacy_remote_state: 'توجد بيانات سحابية قديمة تحتاج إلى مصالحة آمنة.',
    events_pending: 'توجد أحداث سحابية أخرى بانتظار التطبيق.',
    import_failed: 'تعذر استيراد الأحداث أو التحقق منها؛ لم نحرك المؤشرات.',
    blocked_pending_local: 'هناك تغييرات محلية معلقة في مجموعة البيانات نفسها.',
    blocked_base_revision: 'الإصدار المحلي لا يطابق الإصدار السابق للحدث السحابي.',
    blocked_tombstone: 'حدث حذف ينتظر سياسة حذف آمنة.',
    projection_failed: 'تعذر تطبيق الحدث محليًا؛ احتفظنا به لإعادة المحاولة.'
  };
  const projectionBlockMessage = remoteProjectionBlockReason
    ? projectionBlockMessages[remoteProjectionBlockReason] || 'تطبيق الأحداث السحابية متوقف بأمان.'
    : null;
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const ok = await triggerSync();
      if (ok) {
        onToast?.("تمت المزامنة السحابية مع Cloud Firestore بنجاح", "success");
      } else {
        if (!isOnline) {
          onToast?.("الجهاز غير متصل بالإنترنت حالياً؛ التغييرات محفوظة محلياً.", "info");
        } else if (!isEmailVerified && !isGuest && user) {
          onToast?.("يتطلب حفظ البيانات سحابياً تفعيل البريد الإلكتروني أولاً.", "warn");
        }
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleLoadDemoData = async () => {
    if (!import.meta.env.DEV) return;
    if (!isGuest && user) {
      setShowDemoConfirm(false);
      onToast?.("تحميل البيانات التجريبية مقتصر على وضع الزائر لحماية حسابك السحابي من التداخل.", "warn");
      return;
    }
    await loadDemoDataJournaled();
    const updated = StorageService.getProfile();
    setFormData(updated);
    onUpdateProfile(updated);
    setShowDemoConfirm(false);
    if (onToast) {
      onToast("تم تحميل البيانات التجريبية بنجاح (سجلات استعراضية للملك والنبأ)", "info");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 1. Header */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs">
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
          <Settings className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          الإعدادات والملف الشخصي
        </h2>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          تخصيص تفضيلات التلاوة، وحجم الخط القرآني، والقارئ المفضل، وإدارة الحساب والبيانات
        </p>
      </div>

      {/* 1.5 Firebase Authentication Status Card */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-700 pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-stone-100">
            <Shield className="w-4 h-4 text-emerald-700" />
            <span>حالة الهوية والحساب (Firebase Auth)</span>
          </div>
          {isGuest || !user ? (
            <span className="text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-300/80">
              نمط الزائر (بدون تسجيل)
            </span>
          ) : isEmailVerified ? (
            <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300/80">
              حساب موثق (مفعل)
            </span>
          ) : (
            <span className="text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-300/80">
              حساب غير مؤكد (بانتظار التفعيل)
            </span>
          )}
        </div>

        {user && !isGuest ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#faf8f5] dark:bg-stone-900/60 p-4 rounded-xl border border-stone-200/80 dark:border-stone-700">
            <div className="space-y-1">
              <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-mono">
                <span>{user.email || user.displayName || 'مستخدم مسجل'}</span>
                {isEmailVerified ? (
                  <span title="البريد الإلكتروني مفعل">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </span>
                ) : (
                  <span title="البريد الإلكتروني غير مؤكد بعد" className="text-amber-600 font-sans text-[11px] font-bold bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md border border-amber-200">
                    غير مؤكد
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                طريقة التسجيل: {user.providerData.some(p => p.providerId === 'google.com') ? 'Google OAuth' : 'البريد الإلكتروني وكلمة المرور'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold rounded-xl border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#faf8f5] dark:bg-stone-900/60 p-4 rounded-xl border border-stone-200/80 dark:border-stone-700">
            <div className="space-y-1">
              <div className="font-bold text-stone-900 dark:text-stone-100">
                أنت تستخدم المنصة حالياً بنمط الزائر
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                جميع بيانات الحفظ والمراجعة المحفوظة محلية وتعمل بكفاءة تامة. يمكنك إنشاء حساب مستقبلاً لتفعيل المزامنة في المكونات القادمة.
              </p>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>تسجيل الدخول / حساب جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* 1.6 Cloud Sync & Data Protection Card */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-700 pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-stone-100">
            <Cloud className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>المزامنة السحابية وحماية البيانات (Cloud Firestore Sync)</span>
          </div>
          <div className="flex items-center gap-2">
            {syncStatus === 'synced' ? (
              <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300/80 flex items-center gap-1">
                <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>مُزامن بالكامل</span>
              </span>
            ) : syncStatus === 'partial' ? (
              <span className="text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-300/80 flex items-center gap-1">
                <CloudAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>مزامنة جزئية</span>
              </span>
            ) : syncStatus === 'syncing' || isManualSyncing ? (
              <span className="text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-300/80 flex items-center gap-1 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                <span>جاري المزامنة...</span>
              </span>
            ) : syncStatus === 'offline' ? (
              <span className="text-[11px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-bold px-2.5 py-0.5 rounded-full border border-stone-300 dark:border-stone-700 flex items-center gap-1">
                <CloudOff className="w-3.5 h-3.5 text-stone-500" />
                <span>أوفلاين (محلي)</span>
              </span>
            ) : syncStatus === 'unverified' ? (
              <span className="text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-300/80 flex items-center gap-1">
                <CloudAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>بانتظار تفعيل البريد</span>
              </span>
            ) : (
              <span className="text-[11px] bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-bold px-2.5 py-0.5 rounded-full border border-stone-200 dark:border-stone-700 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-stone-500" />
                <span>محلي فقط</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div className="bg-[#faf8f5] dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-200/80 dark:border-stone-700/80 space-y-1">
            <span className="text-stone-500 dark:text-stone-400 block text-[11px]">حالة الاتصال والشبكة:</span>
            <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <span>{isOnline ? 'متصل بالإنترنت' : 'غير متصل (يعمل محلياً)'}</span>
            </div>
          </div>

          <div className="bg-[#faf8f5] dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-200/80 dark:border-stone-700/80 space-y-1">
            <span className="text-stone-500 dark:text-stone-400 block text-[11px]">التغييرات في انتظار الرفع:</span>
            <div className="font-bold text-stone-800 dark:text-stone-200 font-mono">
              {pendingCount === 0 ? 'لا توجد تغييرات معلقة' : `${pendingCount} تغيير معلق`}
            </div>
          </div>

          <div className="bg-[#faf8f5] dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-200/80 dark:border-stone-700/80 space-y-1">
            <span className="text-stone-500 dark:text-stone-400 block text-[11px]">آخر مزامنة ناجحة:</span>
            <div className="font-bold text-stone-800 dark:text-stone-200">
              {lastSyncAtMs ? new Date(lastSyncAtMs).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'لم تتم بعد'}
            </div>
          </div>

          <div className="bg-[#faf8f5] dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-200/80 dark:border-stone-700/80 space-y-1">
            <span className="text-stone-500 dark:text-stone-400 block text-[11px]">أحداث سحابية بانتظار التطبيق:</span>
            <div className="font-bold text-stone-800 dark:text-stone-200 font-mono">
              {remoteInboxPendingCount === 0 ? 'لا توجد أحداث معلقة' : `${remoteInboxPendingCount} حدث غير مطبق`}
            </div>
          </div>

          <div className="bg-[#faf8f5] dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-200/80 dark:border-stone-700/80 space-y-1">
            <span className="text-stone-500 dark:text-stone-400 block text-[11px]">تعارضات محفوظة للمراجعة:</span>
            <div className="font-bold text-stone-800 dark:text-stone-200 font-mono">
              {projectionConflictCount === 0 ? 'لا توجد تعارضات' : `${projectionConflictCount} تعارض محفوظ`}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="space-y-1 max-w-xl">
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-5">
              المزامنة الثنائية ما زالت تمر باختبارات الحماية والتعارض. بياناتك المحلية لا تُحذف عند تعذر الرفع أو تطبيق الأحداث المستقبلة.
            </p>
            {syncErrorMessage && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-5" role="status">
                {syncErrorMessage}
              </p>
            )}
            {projectionBlockMessage && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-5" role="status">
                {projectionBlockMessage}
                {remoteProjectionBlockedAtSequence !== null && ` (الحدث رقم ${remoteProjectionBlockedAtSequence})`}
              </p>
            )}
            {latestProjectionConflict && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-5" role="status">
                آخر تعارض محفوظ: {latestProjectionConflict.collection}/{latestProjectionConflict.documentId}
                {' · '}الحدث #{latestProjectionConflict.serverSequence}
              </p>
            )}
            {projectionConflictCount > 0 && (
              <section className="w-full space-y-3 pt-3 border-t border-amber-200/70 dark:border-amber-900/60" aria-labelledby="sync-conflict-review-title">
                <div className="space-y-1">
                  <h3 id="sync-conflict-review-title" className="text-xs font-bold text-stone-800 dark:text-stone-100">
                    تفاصيل النسخ المحفوظة للتعارضات
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-5">
                    هذه معاينة للنسختين المحفوظتين فقط. لم يُتخذ قرار بالاستبدال أو الدمج، ولن تُحذف أي نسخة من هذه الشاشة.
                  </p>
                </div>
                {conflictDetails.length === 0 ? (
                  <p className="text-[11px] text-stone-500 dark:text-stone-400" role="status">
                    تعذر تحميل تفاصيل التعارضات الآن؛ الأدلة الأصلية ما زالت محفوظة محليًا.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {conflictDetails.map(conflict => (
                      <details key={conflict.event.eventId} className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/50 dark:bg-stone-900/50 p-3">
                        <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-stone-800 dark:text-stone-100">
                          <span>{conflict.event.collection} / {conflict.event.documentId}</span>
                          <span className="text-[10px] font-normal text-stone-500 dark:text-stone-400">
                            الحدث #{conflict.event.serverSequence} · {new Date(conflict.createdAtMs).toLocaleString('ar-EG')}
                          </span>
                        </summary>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-[11px]">
                          <div className="space-y-1">
                            <p className="font-bold text-stone-700 dark:text-stone-200">بيانات الحدث البعيد</p>
                            <p className="text-stone-500 dark:text-stone-400">العملية: {conflict.event.operation} · الإصدار: {conflict.event.baseRevision} ← {conflict.event.revision}</p>
                            <pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white dark:bg-black/30 border border-stone-200 dark:border-stone-700 p-2 text-[10px] text-stone-700 dark:text-stone-200">{JSON.stringify(conflict.event.payload, null, 2)}</pre>
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-stone-700 dark:text-stone-200">لقطة البيانات المحلية وقت اكتشاف التعارض</p>
                            {Object.entries(conflict.localSnapshot).map(([key, value]) => (
                              <div key={key} className="space-y-1">
                                <p className="text-stone-500 dark:text-stone-400 break-all">{key}</p>
                                <pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white dark:bg-black/30 border border-stone-200 dark:border-stone-700 p-2 text-[10px] text-stone-700 dark:text-stone-200">{formatConflictSnapshotValue(value)}</pre>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <p className="font-bold text-[11px] text-stone-700 dark:text-stone-200">
                            العمليات المحلية المعلقة المحفوظة ({conflict.localMutations?.length || 0})
                          </p>
                          {(conflict.localMutations || []).slice(0, 10).map(mutation => (
                            <div key={mutation.mutationId} className="rounded-lg border border-stone-200 dark:border-stone-700 p-2 space-y-1">
                              <p className="text-[10px] text-stone-500 dark:text-stone-400 break-all">
                                {mutation.collection}/{mutation.documentId} · revision base {mutation.baseRevision} · sequence {mutation.sequence}
                              </p>
                              <pre dir="ltr" className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white dark:bg-black/30 border border-stone-200 dark:border-stone-700 p-2 text-[10px] text-stone-700 dark:text-stone-200">{JSON.stringify(mutation.payload, null, 2)}</pre>
                            </div>
                          ))}
                          {(conflict.localMutations || []).length === 0 && (
                            <p className="text-[10px] text-stone-500 dark:text-stone-400">
                              لم تكن هناك عملية محلية معلقة مرتبطة بهذا المستند عند حفظ التعارض؛ لقطة التخزين المحلية محفوظة أعلاه.
                            </p>
                          )}
                          {(conflict.localMutations || []).length > 10 && (
                            <p className="text-[10px] text-stone-500 dark:text-stone-400">
                              عُرضت أول 10 عمليات فقط؛ بقية العمليات محفوظة في سجل التعافي المحلي.
                            </p>
                          )}
                        </div>
                        <p className="mt-2 text-[10px] text-stone-500 dark:text-stone-400">
                          سبب الإيقاف: {conflict.reason} · معرّف الحدث: <span dir="ltr">{conflict.event.eventId}</span>
                        </p>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isManualSyncing || syncStatus === 'syncing' || !user || isGuest || !isEmailVerified}
            className={`px-4 py-2 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 shrink-0 ${
              !user || isGuest || !isEmailVerified
                ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 border border-stone-200 dark:border-stone-700 cursor-not-allowed'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>مزامنة الآن</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 2. User Profile Card */}
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-700 pb-3">
            <User className="w-4 h-4 text-emerald-700" />
            <span>بيانات الحافظ والهدف</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                اسم الحافظ / الطالب:
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                البريد الإلكتروني (محلي):
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
              هدفك القرآني:
            </label>
            <input
              type="text"
              value={formData.memorizationGoal}
              onChange={(e) => setFormData({ ...formData, memorizationGoal: e.target.value })}
              placeholder="مثال: حفظ القرآن كاملاً بتدبر..."
              className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* 3. Audio & Reciter Settings */}
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-700 pb-3">
            <Volume2 className="w-4 h-4 text-emerald-700" />
            <span>تفضيلات التلاوة والاستماع</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                القارئ المعتمد للتسميع:
              </label>
              <select
                value={formData.preferredReciter}
                onChange={(e) => setFormData({ ...formData, preferredReciter: e.target.value as ReciterId })}
                className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
              >
                {RECITERS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                عدد مرات التكرار المستهدف للآية:
              </label>
              <select
                value={formData.repetitionTarget}
                onChange={(e) => setFormData({ ...formData, repetitionTarget: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 font-mono"
              >
                <option value="5">5 مرات (سريع)</option>
                <option value="10">10 مرات (موصى به للرسوخ)</option>
                <option value="15">15 مرة (متقن جداً)</option>
                <option value="20">20 مرة (طريقة الشناقطة)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. Quran Typography Settings & Live Preview */}
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-700 pb-3">
            <Type className="w-4 h-4 text-emerald-700" />
            <span>الخط القرآني والمظهر</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                حجم الخط القرآني:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFormData({ ...formData, quranFontSize: size })}
                    className={`py-2 rounded-xl border font-bold ${
                      formData.quranFontSize === size
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {size === 'sm' ? 'صغير' : size === 'md' ? 'متوسط' : size === 'lg' ? 'كبير' : 'أكبر'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                المظهر:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: 'light' })}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-semibold ${
                    formData.theme === 'light'
                      ? 'bg-amber-100 dark:bg-amber-950 border-amber-400 text-amber-900 dark:text-amber-200'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>فاتح (عاجي)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: 'dark' })}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-semibold ${
                    formData.theme === 'dark'
                      ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>داكن ليلي</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-4 bg-[#fdfbf7] dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-700 text-center">
            <div className="text-[10px] text-stone-400 mb-2">معاينة الخط القرآني:</div>
            <p className={`font-quran leading-loose text-stone-900 dark:text-stone-100 ${
              formData.quranFontSize === 'sm' ? 'text-lg' :
              formData.quranFontSize === 'md' ? 'text-xl' :
              formData.quranFontSize === 'lg' ? 'text-2xl' : 'text-3xl'
            }`}>
              «إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ»
            </p>
          </div>
        </div>

        {/* 5. Backup & Data Management Card */}
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-700 pb-3">
            <Database className="w-4 h-4 text-emerald-700" />
            <span>النسخ الاحتياطي واستعادة البيانات</span>
          </div>

          <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
            بياناتك محفوظة محلياً على هذا المتصفح. يمكنك تصدير نسخة احتياطية كاملة ونقلها إلى أي جهاز آخر أو استعادتها بأمان.
          </p>

          {/* Security Transparency Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              <strong>إشعار الشفافية والخصوصية:</strong> ملفات النسخ الاحتياطي نصية غير مشفرة بصيغة JSON صريحة. احتفظ بملفاتك المصدرة في مكان آمن لضمان خصوصيتك التامة.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#faf8f5] dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold border border-stone-300 dark:border-stone-700 transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>تصدير نسخة احتياطية (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#faf8f5] dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold border border-stone-300 dark:border-stone-700 transition-colors shadow-2xs"
            >
              <Upload className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>استيراد نسخة احتياطية</span>
            </button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".json,application/json" 
              onChange={handleFileChange} 
              className="hidden" 
            />
          </div>
        </div>

        {import.meta.env.DEV && (
          <>
        {/* 6. Isolated Demo Mode Card */}
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-700 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-stone-100">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>البيانات التجريبية الاستعراضية (Demo Mode)</span>
            </div>
            <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-md">
              للمعاينة فقط
            </span>
          </div>

          <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
            يبدأ المستخدمون الجدد افتراضياً بملف نظيف وسجلات فارغة بنسبة صفر%. إذا رغبت في معاينة التطبيق واختبار جميع الشاشات بمحتوى تجريبي لسورة الملك والنبأ، يمكنك تحميل الحزمة التجريبية هنا.
          </p>

          <button
            type="button"
            onClick={() => setShowDemoConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 rounded-xl font-semibold border border-amber-300 dark:border-amber-800 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>تحميل بيانات تجريبية (Demo Data)</span>
          </button>
        </div>
          </>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'تم حفظ التغييرات بنجاح!' : 'حفظ التعديلات'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-stone-500 hover:text-red-600 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط المصنع للبيانات</span>
          </button>
        </div>
      </form>

      {/* In-app Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                  تأكيد إعادة الضبط الافتراضي
                </h3>
                <p className="text-xs text-stone-500">
                  هل أنت متأكد من رغبتك في مسح كافة السجلات المحلية؟
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed bg-[#faf8f5] dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200/70 dark:border-stone-700/60">
              سيتم إعادة تعيين إحصائيات الحفظ وخططك وسجلات المراجعة إلى بيانات وِرد الأولية. لن تتمكن من التراجع عن هذه الخطوة إلا إذا كان لديك ملف نسخة احتياطية.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition-colors"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors"
              >
                تأكيد إعادة الضبط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Demo Mode Confirmation Dialog */}
      {import.meta.env.DEV && showDemoConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                  تأكيد تفعيل البيانات التجريبية
                </h3>
                <p className="text-xs text-stone-500">
                  تحميل بيانات استعراضية للملك والنبأ
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed bg-[#faf8f5] dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200/70 dark:border-stone-700/60">
              سيتم تحميل خطة وسجلات استعراضية ومقاطع مراجعة تجريبية لمساعدتك على فحص جميع ميزات التطبيق. يمكنك دائماً العودة إلى الحالة الصفرية بالضغط على "إعادة ضبط المصنع".
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDemoConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleLoadDemoData}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors"
              >
                تحميل البيانات الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
