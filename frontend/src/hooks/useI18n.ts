import cs from '../i18n/cs';

export function useI18n() {
  const t = (key: string, fallback?: string): string => {
    return cs[key] ?? fallback ?? key;
  };
  return { t };
}
