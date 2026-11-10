import React from 'react';
import { PLAYBACK_RATES, type PlaybackRate } from '../../services/audioPreferences';

interface AudioPlaybackRateControlProps {
  value: PlaybackRate;
  onChange: (rate: PlaybackRate) => void;
}

export const AudioPlaybackRateControl: React.FC<AudioPlaybackRateControlProps> = ({ value, onChange }) => (
  <div className="inline-flex flex-col items-start gap-1">
    <label className="inline-flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
      <span className="whitespace-nowrap">سرعة الصوت</span>
      <select
        aria-label="سرعة تشغيل الصوت"
        value={value}
        onChange={event => onChange(Number(event.target.value) as PlaybackRate)}
        className="min-h-11 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1.5 text-xs font-semibold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-emerald-600"
      >
        {PLAYBACK_RATES.map(rate => <option key={rate} value={rate}>{rate}×</option>)}
      </select>
    </label>
    <a href="https://everyayah.com/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-stone-400 underline underline-offset-2 hover:text-emerald-700">مصدر التلاوات: EveryAyah.com</a>
  </div>
);
