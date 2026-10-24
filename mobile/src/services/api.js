import { createVehicleService } from '../../../web/public/assets/js/vehicle-service.js';
import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { NATIVE_AUTH_REDIRECT } from '../native/auth';

import { createClientService, friendlyError } from './client-service.js';
export { friendlyError } from './client-service.js';
export const clientService = createClientService(supabase, {
  emailRedirectTo: Capacitor.isNativePlatform() ? NATIVE_AUTH_REDIRECT : undefined,
});
export const getCurrentClient = () => clientService.currentClient();

// Autenticação
export async function loginWithGoogle() {
  const native = Capacitor.isNativePlatform();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: native ? NATIVE_AUTH_REDIRECT : window.location.origin + window.location.pathname,
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;
  if (native) {
    if (!data.url) throw Error('Não foi possível iniciar o login com Google.');
    await Browser.open({ url: data.url, toolbarColor: '#16181D' });
  }
}

export async function loginUser(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { success: false, message: friendlyError(error) };
  return { success: true, user: data.user };
}

export async function registerUser({ nome, telefone, email, senha }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, telefone },
      ...(Capacitor.isNativePlatform() ? { emailRedirectTo: NATIVE_AUTH_REDIRECT } : {}),
    }
  });

  if (error) return { success: false, message: friendlyError(error) };

  if (data.session && data.user) {
    const { error: profileError } = await supabase
      .from("tb_cli")
      .update({ nome, email, num_tel: telefone || null })
      .eq("auth_user_id", data.user.id);
    if (profileError) return { success: false, message: friendlyError(profileError) };
  }

  return { success: true, authenticated: Boolean(data.session), message: data.session ? "Conta criada. Entre para continuar." : "Confira seu e-mail para confirmar a conta. Se já tem cadastro, entre com sua senha." };
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

// Mesmo cadastro com foto utilizado pelo site.
export const vehicleService = createVehicleService(supabase);
export const fetchVehicles = () => vehicleService.list();
export const createVehicle = (vehicle, capture) => vehicleService.create(vehicle, capture);
