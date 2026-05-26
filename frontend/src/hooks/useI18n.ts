import cs from '../i18n/cs';
import sk from '../i18n/sk';
import en from '../i18n/en';

const translations: Record<string, Record<string, string>> = { cs, sk, en };

export function getLanguage(): string {
  return localStorage.getItem('wizz_lang') || 'cs';
}

export function setLanguage(lang: string) {
  localStorage.setItem('wizz_lang', lang);
}

export function useI18n() {
  const lang = getLanguage();
  const dict = translations[lang] || cs;

  const t = (key: string, fallback?: string): string => {
    return dict[key] ?? cs[key] ?? fallback ?? key;
  };

  return { t, lang, setLanguage };
}
