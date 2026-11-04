import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { UserProfile, ReciterId } from '../../types/quran';
import { RECITERS } from '../../services/audioService';
import { StorageService } from '../../services/storageService';

interface SettingsViewProps {
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onResetAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
  onResetAllData
}) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(formData);
    StorageService.saveProfile(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    if (confirm("هل أنت متأكد من رغبتك في إعادة ضبط المنصة للحالة الافتراضية؟ سيتم مسح بياناتك المسجلة محلياً.")) {
      onResetAllData();
      alert("تمت إعادة ضبط البيانات بنجاح.");
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
          تخصيص تفضيلات التلاوة، وحجم الخط القرآني، والقارئ المفضل، وإدارة البيانات
        </p>
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
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2.5 text-stone-500 hover:text-red-600 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط المصنع للبيانات</span>
          </button>
        </div>
      </form>
    </div>
  );
};
