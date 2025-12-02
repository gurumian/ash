import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n'; // Initialize i18n
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(<App />);
