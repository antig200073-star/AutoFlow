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

  return { success: true, message: "Conta criada com sucesso!" };
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Veículos
export async function fetchVehicles() {
  const client = await getCurrentClient();
  if (!client) return [];

  const { data, error } = await supabase
    .from("tb_veiculo")
    .select("id_veiculo, placa, marca, modelo, ano_do_modelo")
    .eq("cliente_id", client.id_cliente)
    .order("id_veiculo", { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id_veiculo,
    marca: row.marca || "",
    modelo: row.modelo || "",
    placa: row.placa || "",
    ano: row.ano_do_modelo || ""
  }));
}

export async function createVehicle(vehicle) {
  const client = await getCurrentClient();
  if (!client) return { success: false, message: "Usuário não encontrado." };

  const { data, error } = await supabase
    .from("tb_veiculo")
    .insert({
      placa: vehicle.placa,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      ano_do_modelo: vehicle.ano,
      cliente_id: client.id_cliente
    })
    .select("id_veiculo, placa, marca, modelo, ano_do_modelo")
    .single();

  if (error) return { success: false, message: friendlyError(error) };
  return { success: true, vehicle: data };
}