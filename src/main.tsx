import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

console.log('main.tsx: Starting application');

// Clear localStorage if there are issues
try {
  const hasErrorFlag = localStorage.getItem('app_error');
  if (hasErrorFlag) {
    console.log('Clearing localStorage due to previous error');
    localStorage.clear();
  }
} catch (e) {
  console.warn('Failed to check localStorage:', e);
}

const rootElement = document.getElementById('root');
console.log('main.tsx: Root element found:', !!rootElement);

if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: monospace;">Error: Root element not found</div>';
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    );
    console.log('main.tsx: App rendered successfully');
  } catch (error) {
    console.error('main.tsx: Failed to render app:', error);
    localStorage.setItem('app_error', 'true');
    rootElement.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace; background: #000;">
      <h1>Application Error</h1>
      <p>Failed to initialize the application.</p>
      <pre>${String(error)}</pre>
      <button onclick="localStorage.clear(); window.location.reload();" style="padding: 10px; margin-top: 10px;">Clear Data and Reload</button>
    </div>`;
  }
}
