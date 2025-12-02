import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from '../locales/en/common.json';
import enConnection from '../locales/en/connection.json';
import enMenu from '../locales/en/menu.json';
import enSettings from '../locales/en/settings.json';
import enDialog from '../locales/en/dialog.json';
import enStatus from '../locales/en/status.json';
import enServer from '../locales/en/server.json';

import koCommon from '../locales/ko/common.json';
import koConnection from '../locales/ko/connection.json';
import koMenu from '../locales/ko/menu.json';
import koSettings from '../locales/ko/settings.json';
import koDialog from '../locales/ko/dialog.json';
import koStatus from '../locales/ko/status.json';
import koServer from '../locales/ko/server.json';

const resources = {
  en: {
    common: enCommon,
    connection: enConnection,
    menu: enMenu,
    settings: enSettings,
    dialog: enDialog,
    status: enStatus,
    server: enServer,
  },
  ko: {
    common: koCommon,
    connection: koConnection,
    menu: koMenu,
    settings: koSettings,
    dialog: koDialog,
    status: koStatus,
    server: koServer,
  },
};

// Get saved language preference from localStorage
const getSavedLanguage = () => {
  try {
    const saved = localStorage.getItem('ash-language');
    if (saved && (saved === 'en' || saved === 'ko')) {
      return saved;
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
};

// Get browser language as fallback
const getBrowserLanguage = () => {
  try {
    const browserLanguage = navigator.language || navigator.languages?.[0];
    if (browserLanguage) {
      const langCode = browserLanguage.split('-')[0].toLowerCase();
      if (langCode === 'en' || langCode === 'ko') {
        return langCode;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
};

// Initialize i18n synchronously first, then update with system language
const savedLanguage = getSavedLanguage();
const browserLanguage = getBrowserLanguage();

// Start with saved language or browser language, fallback to English
const initialLanguage = savedLanguage || browserLanguage || 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'connection', 'menu', 'settings', 'dialog', 'status', 'server'],
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      // Check localStorage first, then browser language
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ash-language',
      caches: ['localStorage'],
    },
    
    // Set initial language (will be updated with system language if needed)
    lng: initialLanguage,
    
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    },
  });

// Update language with system locale if no saved preference exists
// Wait for window and electronAPI to be ready
const updateWithSystemLanguage = () => {
  if (!savedLanguage && window.electronAPI && window.electronAPI.getSystemLocale) {
    window.electronAPI.getSystemLocale().then((result) => {
      if (result.success && result.language) {
        const systemLanguage = result.language;
        // Only update if system language is different and supported
        if (systemLanguage !== i18n.language && (systemLanguage === 'en' || systemLanguage === 'ko')) {
          i18n.changeLanguage(systemLanguage);
          // Save system language preference
          try {
            localStorage.setItem('ash-language', systemLanguage);
          } catch (e) {
            // Ignore errors
          }
        }
      }
    }).catch((e) => {
      // Ignore errors - browser language or English will be used
      console.warn('Failed to get system locale:', e);
    });
  }
};

// Try to update with system language after a short delay to ensure electronAPI is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(updateWithSystemLanguage, 100);
    });
  } else {
    setTimeout(updateWithSystemLanguage, 100);
  }
}

// Function to change language programmatically
export const changeLanguage = (lng) => {
  i18n.changeLanguage(lng);
  localStorage.setItem('ash-language', lng);
};

export default i18n;

