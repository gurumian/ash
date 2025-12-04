import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Only import English translations synchronously (fallback language)
import enCommon from '../locales/en/common.json';
import enConnection from '../locales/en/connection.json';
import enMenu from '../locales/en/menu.json';
import enSettings from '../locales/en/settings.json';
import enDialog from '../locales/en/dialog.json';
import enStatus from '../locales/en/status.json';
import enServer from '../locales/en/server.json';
import enUpload from '../locales/en/upload.json';
import enLibrary from '../locales/en/library.json';

// Initial resources with only English (other languages will be loaded on demand)
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

// Function to load language resources dynamically
const loadLanguageResources = async (lng) => {
  if (lng === 'en' || i18n.hasResourceBundle(lng, 'common')) {
    // English is already loaded, or language is already loaded
    return;
  }

  try {
    // Dynamically import the language resources
    const [common, connection, menu, settings, dialog, status, server, upload, library] = await Promise.all([
      import(`../locales/${lng}/common.json`),
      import(`../locales/${lng}/connection.json`),
      import(`../locales/${lng}/menu.json`),
      import(`../locales/${lng}/settings.json`),
      import(`../locales/${lng}/dialog.json`),
      import(`../locales/${lng}/status.json`),
      import(`../locales/${lng}/server.json`),
      import(`../locales/${lng}/upload.json`),
      import(`../locales/${lng}/library.json`),
    ]);

    // Add resources to i18n
    i18n.addResourceBundle(lng, 'common', common.default, true, true);
    i18n.addResourceBundle(lng, 'connection', connection.default, true, true);
    i18n.addResourceBundle(lng, 'menu', menu.default, true, true);
    i18n.addResourceBundle(lng, 'settings', settings.default, true, true);
    i18n.addResourceBundle(lng, 'dialog', dialog.default, true, true);
    i18n.addResourceBundle(lng, 'status', status.default, true, true);
    i18n.addResourceBundle(lng, 'server', server.default, true, true);
    i18n.addResourceBundle(lng, 'upload', upload.default, true, true);
    i18n.addResourceBundle(lng, 'library', library.default, true, true);
  } catch (error) {
    console.warn(`Failed to load language resources for ${lng}:`, error);
    // Fallback to English if language loading fails
    if (lng !== 'en') {
      i18n.changeLanguage('en');
    }
  }
};

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

// Load initial language resources asynchronously (non-blocking)
// Only load the language that will be used initially
if (initialLanguage !== 'en') {
  loadLanguageResources(initialLanguage).catch((error) => {
    console.warn('Failed to load initial language resources:', error);
  });
}

// Update language with system locale if no saved preference exists
// Wait for window and electronAPI to be ready
const updateWithSystemLanguage = () => {
  // Only check system locale if we don't have a saved preference
  // and the initial language was from browser (not saved)
  if (!savedLanguage && window.electronAPI && window.electronAPI.getSystemLocale) {
    window.electronAPI.getSystemLocale().then(async (result) => {
      if (result.success && result.language) {
        const systemLanguage = result.language;
        // Only update if system language is different from current and supported
        // and if it's different from the browser language we already used
        if (systemLanguage !== i18n.language && 
            systemLanguage !== browserLanguage &&
            (systemLanguage === 'en' || systemLanguage === 'ko' || systemLanguage === 'ja' || systemLanguage === 'vi' || systemLanguage === 'zh')) {
          // Load language resources before changing language
          await loadLanguageResources(systemLanguage);
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
export const changeLanguage = async (lng) => {
  // Load language resources before changing language
  await loadLanguageResources(lng);
  i18n.changeLanguage(lng);
  localStorage.setItem('ash-language', lng);
};

export default i18n;

