import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationEN from './locales/en/translation.json';
import translationVI from './locales/vi/translation.json';
import adsEN from './locales/en/ads.json';
import adsVI from './locales/vi/ads.json';
import commonEN from './locales/en/common.json';
import commonVI from './locales/vi/common.json';

const resources = {
  en: {
    translation: translationEN,
    ads: adsEN,
    common: commonEN
  },
  vi: {
    translation: translationVI,
    ads: adsVI,
    common: commonVI
  }
};

i18n
  // Tự động phát hiện ngôn ngữ từ browser/localStorage
  .use(LanguageDetector)
  // Pass i18n instance to react-i18next
  .use(initReactI18next)
  // Init i18next
  .init({
    resources,
    fallbackLng: 'vi', // Ngôn ngữ mặc định
    defaultNS: 'translation', // Namespace mặc định
    
    // Cấu hình language detector
    detection: {
      // Thứ tự ưu tiên: localStorage > cookie > navigator
      order: ['localStorage', 'cookie', 'navigator'],
      caches: ['localStorage', 'cookie'],
      lookupLocalStorage: 'i18nextLng',
      lookupCookie: 'i18next'
    },

    interpolation: {
      escapeValue: false // React đã tự động escape
    },

    // Debug mode (tắt ở production)
    debug: false,

    // React specific options
    react: {
      useSuspense: true
    }
  });

export default i18n;