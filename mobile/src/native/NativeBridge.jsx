import { useEffect, useRef, useState } from 'react';
import { Capacitor, SystemBars } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { supabase } from '../supabase';
import { createAuthCallbackHandler } from './auth';
import { dismissOpenDialog } from './navigation';

const handleAuthCallback = createAuthCallbackHandler(supabase.auth);

export default function NativeBridge({ onBack, authenticatedPage }) {
  const back = useRef(onBack);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [error, setError] = useState('');
  useEffect(() => { back.current = onBack; }, [onBack]);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SystemBars.setStyle({ style: authenticatedPage ? 'DARK' : 'LIGHT', bar: 'NavigationBar' }).catch(() => {});
    }
  }, [authenticatedPage]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const handles = [];
    let keyboardVisible = false;
    document.documentElement.classList.add('af-native');
    const onlineChange = () => setOffline(!navigator.onLine);
    window.addEventListener('online', onlineChange);
    window.addEventListener('offline', onlineChange);
    const listen = async (plugin, event, listener) => {
      const handle = await plugin.addListener(event, listener);
      if (disposed) await handle.remove(); else handles.push(handle);
    };
    const callback = async ({ url }) => {
      try {
        if (await handleAuthCallback(url)) {
          if (!disposed) setError('');
          await Browser.close().catch(() => {});
        }
      } catch (cause) { if (!disposed) setError(cause.message); }
    };
    const lifecycle = ({ isActive }) => {
      if (isActive) {
        supabase.auth.startAutoRefresh();
        window.dispatchEvent(new Event('focus'));
      } else {
        supabase.auth.stopAutoRefresh();
        document.querySelectorAll('autoflow-vehicle-registration').forEach(host => host.stopCamera());
      }
    };
    const setup = async () => {
      await listen(NativeApp, 'appUrlOpen', callback);
      await listen(NativeApp, 'appStateChange', lifecycle);
      await listen(Keyboard, 'keyboardWillShow', () => {
        keyboardVisible = true;
        document.documentElement.classList.add('af-keyboard-open');
      });
      await listen(Keyboard, 'keyboardWillHide', () => {
        keyboardVisible = false;
        document.documentElement.classList.remove('af-keyboard-open');
      });
      await listen(NativeApp, 'backButton', async () => {
        if (keyboardVisible) { await Keyboard.hide(); return; }
        if (dismissOpenDialog(document)) return;
        if (!back.current()) await NativeApp.minimizeApp();
      });
      if (disposed) return;
      const state = await NativeApp.getState();
      if (disposed) return;
      lifecycle(state);
      const launch = await NativeApp.getLaunchUrl();
      if (!disposed && launch?.url) await callback(launch);
      await SystemBars.setStyle({ style: 'LIGHT', bar: 'StatusBar' });
    };
    setup().catch(() => { if (!disposed) setError('Não foi possível inicializar todos os recursos do Android. Feche e abra o aplicativo.'); });
    // A interface local aparece sem aguardar a conexão ao Supabase.
    SplashScreen.hide().catch(() => {});
    return () => {
      disposed = true;
      handles.forEach(handle => { void handle.remove(); });
      window.removeEventListener('online', onlineChange);
      window.removeEventListener('offline', onlineChange);
      document.documentElement.classList.remove('af-keyboard-open');
    };
  }, []);
  if (!Capacitor.isNativePlatform()) return null;
  return <>
    {offline && <p className="af-connection-banner" role="status">Sem conexão. Conecte-se à internet para consultar ou salvar informações.</p>}
    {error && <div className="af-native-error" role="alert"><p>{error}</p><button type="button" onClick={() => setError('')}>Fechar aviso</button></div>}
  </>;
}
