import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdaptivityProvider, AppRoot, ConfigProvider } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import App from './App';
import { initVK } from './lib/vk';
import { isVKContext } from './lib/environment';
import { publicAssetUrl } from './lib/assets';
import './styles/global.css';

document.documentElement.style.setProperty(
  '--academy-bg-image',
  `url("${publicAssetUrl('/assets/academy.webp')}")`,
);

if (isVKContext()) void initVK();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <App />
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
