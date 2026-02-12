/**
 * Application Entry Point
 * Mounts the React application to the DOM
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Find root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Could not find root element. Ensure index.html contains <div id="root"></div>'
  );
}

// Create React root and render application
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);