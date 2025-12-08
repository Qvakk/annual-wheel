/**
 * Internationalization (i18n) Service
 * Supports: Norwegian Bokmål (nb), Nynorsk (nn), Northern Sami (se), English (en)
 */

export type SupportedLocale = 'nb' | 'nn' | 'se' | 'en';

export interface LocaleInfo {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag?: string;
}

/**
 * Supported locales with metadata
 */
export const supportedLocales: LocaleInfo[] = [
  { code: 'nb', name: 'Norwegian Bokmål', nativeName: 'Norsk bokmål', flag: '🇳🇴' },
  { code: 'nn', name: 'Norwegian Nynorsk', nativeName: 'Norsk nynorsk', flag: '🇳🇴' },
  { code: 'se', name: 'Northern Sami', nativeName: 'Davvisámegiella', flag: '🏳️' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
];

// Translation type - nested object with string values
export type Translations = {
  [key: string]: string | Translations;
};

// Current locale state
let currentLocale: SupportedLocale = 'nb';
let translations: Translations = {};
let listeners: Set<() => void> = new Set();

/**
 * Get flattened key from nested object
 */
function getNestedValue(obj: Translations, path: string): string | undefined {
  const keys = path.split('.');
  let current: Translations | string = obj;
  
  for (const key of keys) {
    if (typeof current === 'string') return undefined;
    current = current[key];
    if (current === undefined) return undefined;
  }
  
  return typeof current === 'string' ? current : undefined;
}

/**
 * Load translations for a locale
 */
export async function loadLocale(locale: SupportedLocale): Promise<void> {
  try {
    const module = await import(`../locales/${locale}.json`);
    translations = module.default;
    currentLocale = locale;
    
    // Save preference
    localStorage.setItem('preferred-locale', locale);
    
    // Notify listeners
    listeners.forEach(listener => listener());
  } catch (error) {
    console.error(`Failed to load locale ${locale}:`, error);
    // Fall back to English if available
    if (locale !== 'en') {
      await loadLocale('en');
    }
  }
}

/**
 * Get current locale
 * If translations haven't loaded yet, check localStorage for saved preference
 */
export function getLocale(): SupportedLocale {
  // If translations are loaded, return the current locale
  if (Object.keys(translations).length > 0) {
    return currentLocale;
  }
  // Otherwise check localStorage for saved preference
  const stored = localStorage.getItem('preferred-locale') as SupportedLocale | null;
  if (stored && supportedLocales.some(l => l.code === stored)) {
    return stored;
  }
  return currentLocale;
}

/**
 * Get locale info for current or specified locale
 */
export function getLocaleInfo(locale?: SupportedLocale): LocaleInfo | undefined {
  return supportedLocales.find(l => l.code === (locale || currentLocale));
}

/**
 * Translate a key with optional interpolation
 * Usage: t('app.title') or t('greeting', { name: 'John' })
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let value = getNestedValue(translations, key);
  
  if (value === undefined) {
    console.warn(`Missing translation for key: ${key}`);
    return key;
  }
  
  // Handle interpolation: {paramName}
  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      value = value!.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    });
  }
  
  return value;
}

/**
 * Subscribe to locale changes
 */
export function onLocaleChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Initialize i18n - detect preferred locale and load translations
 * @param teamsLocale - Optional locale from Teams SDK (e.g., 'nb-no', 'en-us')
 */
export async function initI18n(teamsLocale?: string): Promise<void> {
  // Priority: localStorage > Teams SDK > browser language > default (nb)
  const stored = localStorage.getItem('preferred-locale') as SupportedLocale | null;
  const browserLang = navigator.language.split('-')[0];
  
  let locale: SupportedLocale = 'nb';
  
  if (stored && supportedLocales.some(l => l.code === stored)) {
    locale = stored;
  } else if (teamsLocale) {
    // Teams locale format: "en-us", "nb-no", "nn-no", etc.
    const teamsLang = teamsLocale.split('-')[0].toLowerCase();
    if (supportedLocales.some(l => l.code === teamsLang)) {
      locale = teamsLang as SupportedLocale;
    }
  } else if (supportedLocales.some(l => l.code === browserLang)) {
    locale = browserLang as SupportedLocale;
  }
  
  await loadLocale(locale);
}

/**
 * Format a date according to current locale
 */
export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const localeMap: Record<SupportedLocale, string> = {
    nb: 'nb-NO',
    nn: 'nn-NO',
    se: 'se-NO',
    en: 'en-GB',
  };
  
  return date.toLocaleDateString(localeMap[currentLocale], options);
}

/**
 * Format a number according to current locale
 */
export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  const localeMap: Record<SupportedLocale, string> = {
    nb: 'nb-NO',
    nn: 'nn-NO',
    se: 'se-NO',
    en: 'en-GB',
  };
  
  return num.toLocaleString(localeMap[currentLocale], options);
}

/**
 * Get month names in current locale
 */
export function getMonthNames(format: 'long' | 'short' = 'long'): string[] {
  const localeMap: Record<SupportedLocale, string> = {
    nb: 'nb-NO',
    nn: 'nn-NO',
    se: 'se-NO',
    en: 'en-GB',
  };
  
  const formatter = new Intl.DateTimeFormat(localeMap[currentLocale], { month: format });
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2025, i, 1);
    return formatter.format(date);
  });
}

/**
 * Get short month names from translation files
 * Falls back to Intl.DateTimeFormat if not available
 */
export function getShortMonthNames(): string[] {
  const shortMonths = getNestedValue(translations, 'months.short');
  if (shortMonths) {
    // Parse the array from translations (stored as array in JSON)
    const monthsObj = translations.months as Translations;
    if (monthsObj && Array.isArray(monthsObj.short)) {
      return monthsObj.short as string[];
    }
  }
  // Fallback to Intl
  return getMonthNames('short');
}

/**
 * Get weekday names in current locale
 */
export function getWeekdayNames(format: 'long' | 'short' | 'narrow' = 'short'): string[] {
  const localeMap: Record<SupportedLocale, string> = {
    nb: 'nb-NO',
    nn: 'nn-NO',
    se: 'se-NO',
    en: 'en-GB',
  };
  
  const formatter = new Intl.DateTimeFormat(localeMap[currentLocale], { weekday: format });
  // Start from Monday (index 1 in 2025 Jan starts on Wednesday, so use a known Monday)
  const monday = new Date(2025, 0, 6); // Jan 6, 2025 is Monday
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return formatter.format(date);
  });
}
