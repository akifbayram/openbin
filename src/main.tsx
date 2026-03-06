import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Provider } from '@/components/ui/provider';
import './index.css';

// biome-ignore lint/style/noNonNullAssertion: standard React root element
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>
);
