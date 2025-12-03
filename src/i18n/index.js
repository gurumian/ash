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
import enUpload from '../locales/en/upload.json';
import enLibrary from '../locales/en/library.json';

import koCommon from '../locales/ko/common.json';
import koConnection from '../locales/ko/connection.json';
import koMenu from '../locales/ko/menu.json';
import koSettings from '../locales/ko/settings.json';
import koDialog from '../locales/ko/dialog.json';
import koStatus from '../locales/ko/status.json';
import koServer from '../locales/ko/server.json';
import koUpload from '../locales/ko/upload.json';
import koLibrary from '../locales/ko/library.json';

import jaCommon from '../locales/ja/common.json';
import jaConnection from '../locales/ja/connection.json';
import jaMenu from '../locales/ja/menu.json';
import jaSettings from '../locales/ja/settings.json';
import jaDialog from '../locales/ja/dialog.json';
import jaStatus from '../locales/ja/status.json';
import jaServer from '../locales/ja/server.json';
import jaUpload from '../locales/ja/upload.json';
import jaLibrary from '../locales/ja/library.json';

import viCommon from '../locales/vi/common.json';
import viConnection from '../locales/vi/connection.json';
import viMenu from '../locales/vi/menu.json';
import viSettings from '../locales/vi/settings.json';
import viDialog from '../locales/vi/dialog.json';
import viStatus from '../locales/vi/status.json';
import viServer from '../locales/vi/server.json';
import viUpload from '../locales/vi/upload.json';
import viLibrary from '../locales/vi/library.json';

import zhCommon from '../locales/zh/common.json';
import zhConnection from '../locales/zh/connection.json';
import zhMenu from '../locales/zh/menu.json';
import zhSettings from '../locales/zh/settings.json';
import zhDialog from '../locales/zh/dialog.json';
import zhStatus from '../locales/zh/status.json';
import zhServer from '../locales/zh/server.json';
import zhUpload from '../locales/zh/upload.json';
import zhLibrary from '../locales/zh/library.json';

const resources = {
  en: {
    common: enCommon,
    connection: enConnection,
    menu: enMenu,
    settings: enSettings,
    dialog: enDialog,
    status: enStatus,
    server: enServer,
    upload: enUpload,
    library: enLibrary,
  },
  ko: {
    common: koCommon,
    connection: koConnection,
    menu: koMenu,
    settings: koSettings,
    dialog: koDialog,
    status: koStatus,
    server: koServer,
    upload: koUpload,
    library: koLibrary,
  },
  ja: {
    common: jaCommon,
    connection: jaConnection,
    menu: jaMenu,
    settings: jaSettings,
    dialog: jaDialog,
    status: jaStatus,
    server: jaServer,
    upload: jaUpload,
    library: jaLibrary,
  },
  vi: {
    common: viCommon,
    connection: viConnection,
    menu: viMenu,
    settings: viSettings,
    dialog: viDialog,
    status: viStatus,
    server: viServer,
    upload: viUpload,
    library: viLibrary,
  },
  zh: {
    common: zhCommon,
    connection: zhConnection,
    menu: zhMenu,
    settings: zhSettings,
    dialog: zhDialog,
    status: zhStatus,
    server: zhServer,
    upload: zhUpload,
    library: zhLibrary,
  },
};

// Get saved language preference from localStorage
const getSavedLanguage = () => {
  try {
    const saved = localStorage.getItem('ash-language');
    if (saved && (saved === 'en' || saved === 'ko' || saved === 'ja' || saved === 'vi' || saved === 'zh')) {
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
      if (langCode === 'en' || langCode === 'ko' || langCode === 'ja' || langCode === 'vi' || langCode === 'zh') {
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
    ns: ['common', 'connection', 'menu', 'settings', 'dialog', 'status', 'server', 'upload', 'library'],
    
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
        if (systemLanguage !== i18n.language && (systemLanguage === 'en' || systemLanguage === 'ko' || systemLanguage === 'ja' || systemLanguage === 'vi' || systemLanguage === 'zh')) {
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

