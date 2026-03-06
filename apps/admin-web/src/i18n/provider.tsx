import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, I18N_STORAGE_KEY, messagesByLocale, type AppLocale } from './messages';

type TranslateParams = Record<string, string | number>;

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (nextLocale: AppLocale) => void;
  t: (key: string, params?: TranslateParams) => string;
  formatDateTime: (value: Date) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

function resolveStoredLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const storedLocale = window.localStorage.getItem(I18N_STORAGE_KEY);
  if (storedLocale && storedLocale in messagesByLocale) {
    return storedLocale as AppLocale;
  }

  return DEFAULT_LOCALE;
}

type Props = {
  children: ReactNode;
};

export function I18nProvider({ children }: Props) {
  const [locale, setLocaleState] = useState<AppLocale>(resolveStoredLocale);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(I18N_STORAGE_KEY, nextLocale);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: TranslateParams) => {
      const fallback = messagesByLocale[DEFAULT_LOCALE][key] ?? key;
      const localized = messagesByLocale[locale][key] ?? fallback;
      return interpolate(localized, params);
    },
    [locale]
  );

  const formatDateTime = useCallback(
    (value: Date) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(value),
    [locale]
  );

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      formatDateTime
    }),
    [formatDateTime, locale, setLocale, t]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }

  return context;
}
