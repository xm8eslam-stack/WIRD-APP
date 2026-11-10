import React from 'react';

export type WirdSymbolVariant = 'primary' | 'light' | 'dark' | 'gold' | 'monochrome' | 'simplified';

export interface WirdSymbolProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number | string;
  variant?: WirdSymbolVariant;
  className?: string;
  withGlow?: boolean;
}

export const OFFICIAL_BRAND_EMBLEM_URL = '/assets/aistudio/IMG_0140_900ee5d2.jpeg';

/**
 * Official WIRD Brand Symbol (رمز وِرد الإسلامي الرسمي)
 * Features the official circular emblem containing the golden dome, minaret,
 * glowing open Quran on rihal stand, and calligraphic «وِرْد».
 * Old placeholder SVG geometry is permanently deleted.
 */
export const WirdSymbol: React.FC<WirdSymbolProps> = ({
  size = 40,
  variant = 'primary',
  className = '',
  withGlow = false,
  ...props
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  const glowStyle = withGlow
    ? 'shadow-[0_0_20px_rgba(224,169,109,0.35)] ring-2 ring-[#C59B27]/50'
    : 'ring-1 ring-[#C59B27]/40 dark:ring-[#E0A96D]/40';

  const filterStyle = variant === 'monochrome'
    ? 'grayscale opacity-80'
    : '';

  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-[#0B132B] select-none transition-transform duration-200 ${glowStyle} ${className}`}
      role="img"
      aria-label="شعار وِرد الرسمي"
      {...props}
    >
      <img
        src={OFFICIAL_BRAND_EMBLEM_URL}
        alt="شعار وِرد الرسمي"
        className={`w-full h-full object-cover select-none ${filterStyle}`}
        loading="eager"
        decoding="async"
      />
    </div>
  );
};

export interface WirdWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  textColor?: string;
}

/**
 * Official WIRD Typographic Wordmark (الشعار اللفظي «وِرد»)
 * Features the authentic Arabic calligraphic title paired with uppercase Latin WIRD
 */
export const WirdWordmark: React.FC<WirdWordmarkProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
  textColor,
}) => {
  const sizeConfig = {
    sm: {
      title: 'text-base',
      latin: 'text-[9px] tracking-wider',
      subtitle: 'text-[10px]',
      gap: 'gap-1',
    },
    md: {
      title: 'text-lg md:text-xl',
      latin: 'text-[10px] md:text-[11px] tracking-widest',
      subtitle: 'text-[11px]',
      gap: 'gap-1.5',
    },
    lg: {
      title: 'text-2xl md:text-3xl',
      latin: 'text-xs md:text-sm tracking-widest',
      subtitle: 'text-xs md:text-sm',
      gap: 'gap-2',
    },
    xl: {
      title: 'text-3xl md:text-4xl',
      latin: 'text-sm md:text-base tracking-[0.2em]',
      subtitle: 'text-sm md:text-base',
      gap: 'gap-2.5',
    },
  }[size];

  return (
    <div className={`flex flex-col text-right ${className}`}>
      <div className={`flex items-baseline ${sizeConfig.gap}`}>
        <span
          className={`font-black tracking-tight font-quran select-none ${sizeConfig.title} ${
            textColor || 'text-[#1C4E46] dark:text-[#F5F1E8]'
          }`}
        >
          وِرد
        </span>
        <span
          className={`font-extrabold uppercase font-sans-ui select-none ${sizeConfig.latin} text-[#C59B27] dark:text-[#E0A96D]`}
        >
          WIRD
        </span>
      </div>
      {showSubtitle && (
        <span
          className={`font-medium select-none ${sizeConfig.subtitle} text-[#5B6F6B] dark:text-[#A8B8B5]`}
        >
          رفيق القرآن والورد اليومي
        </span>
      )}
    </div>
  );
};

export interface WirdBrandLockupProps {
  symbolSize?: number | string;
  textSize?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: WirdSymbolVariant;
  layout?: 'horizontal' | 'vertical';
  showSubtitle?: boolean;
  className?: string;
  withGlow?: boolean;
}

/**
 * Complete Official WIRD Brand Lockup (الهوية الكاملة: الشعار والاسم)
 */
export const WirdBrandLockup: React.FC<WirdBrandLockupProps> = ({
  symbolSize = 42,
  textSize = 'md',
  variant = 'primary',
  layout = 'horizontal',
  showSubtitle = true,
  className = '',
  withGlow = false,
}) => {
  if (layout === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center space-y-3 ${className}`}>
        <WirdSymbol size={symbolSize} variant={variant} withGlow={withGlow} />
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black font-quran text-[#1C4E46] dark:text-[#F5F1E8]">
              وِرد
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C59B27] dark:text-[#E0A96D]">
              WIRD
            </span>
          </div>
          {showSubtitle && (
            <p className="text-xs text-[#5B6F6B] dark:text-[#A8B8B5] mt-1 font-medium">
              حفظ وتثبيت القرآن الكريم وفق منهجيات المراجعة المتباعدة
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <WirdSymbol size={symbolSize} variant={variant} withGlow={withGlow} />
      <WirdWordmark size={textSize} showSubtitle={showSubtitle} />
    </div>
  );
};
