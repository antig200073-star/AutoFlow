import { createVehicleService } from '../../../web/public/assets/js/vehicle-service.js';
import { supabase } from '../supabase';

// Mapeamento de erros
export function friendlyError(error, fallback = "Não foi possível concluir a operação.") {
  if (!error) return fallback;
  const message = String(error.message || error);

  if (/Invalid login credentials/i.test(message)) return "E-mail ou senha inválidos.";
  if (/User already registered/i.test(message)) return "Este e-mail já está cadastrado.";
  if (/Password should be at least/i.test(message)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/Email not confirmed/i.test(message)) return "E-mail ainda não confirmado.";
  return message || fallback;
}

// Obter usuário e cliente logado
export async function getCurrentClient() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("tb_cli")
    .select("id_cliente, auth_user_id, nome, email, num_tel, cep")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Autenticação
export async function loginUser(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { success: false, message: friendlyError(error) };
  return { success: true, user: data.user };
}

export async function registerUser({ nome, telefone, email, senha }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, telefone } }
  });

  if (error) return { success: false, message: friendlyError(error) };

  if (data.session && data.user) {
    await supabase
      .from("tb_cli")
      .update({ nome, email, num_tel: telefone || null })
      .eq("auth_user_id", data.user.id);
  }

  return { success: true, message: data.session ? "Conta criada. Entre para continuar." : "Confira seu e-mail para confirmar a conta. Se já tem cadastro, entre com sua senha." };
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function fetchApprovedWorkshops() {
  const { data, error } = await supabase.from('oficinas')
    .select('id,nome,logradouro,numero,bairro,cidade,estado')
    .eq('status', 'aprovada').order('nome');
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id, nome: row.nome,
    endereco: [row.logradouro,row.numero,row.bairro,row.cidade,row.estado].filter(Boolean).join(', '),
    distancia: 'Distância não calculada', avaliacao: 'Oficina aprovada',
  }));
}

// Mesmo cadastro com foto utilizado pelo site.
export const vehicleService = createVehicleService(supabase);
export const fetchVehicles = () => vehicleService.list();
export const createVehicle = (vehicle, capture) => vehicleService.create(vehicle, capture);
