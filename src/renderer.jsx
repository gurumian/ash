import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n'; // Initialize i18n
import App from './App';

// Global handler for unhandled promise rejections from abort operations
// This specifically handles AbortError from fetch/stream operations when user cancels
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const errorName = error?.name || '';
  const errorMessage = String(error?.message || '');
  
  // Silently ignore abort errors - they're expected when user cancels operations
  if (
    errorName === 'AbortError' ||
    errorName === 'AbortedError' ||
    errorMessage.includes('aborted') ||
    errorMessage.includes('BodyStreamBuffer was aborted') ||
    errorMessage.includes('cancelled') ||
    errorMessage.includes('Cancelled') ||
    errorMessage.includes('Request cancelled by user') ||
    errorMessage.includes('abort')
  ) {
    // Prevent the error from showing in console
    event.preventDefault();
    return;
  }
  
  // Other unhandled rejections will still be logged
});

const container = document.getElementById('root');
const root = createRoot(container);

root.render(<App />);
