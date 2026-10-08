export const PHOTO_BUCKET = 'vehicle-photos';
const FIELDS = 'id_veiculo,placa,marca,modelo,ano_do_modelo,km_atual,foto_path';

export function validateVehicle(input) {
  const placa = String(input.placa || '').toUpperCase().replace(/[ -]/g, '');
  const marca = String(input.marca || '').trim();
  const modelo = String(input.modelo || '').trim();
  const ano = Number(input.ano);
  const km = Number(input.km_atual);
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) throw Error('Informe uma placa válida, como ABC1D23 ou ABC1234.');
  if (!marca || marca.length > 80 || !modelo || modelo.length > 120) throw Error('Informe a marca e o modelo do veículo.');
  if (!Number.isInteger(ano) || ano < 1900 || ano > new Date().getFullYear() + 1) throw Error('Informe um ano válido.');
  if (input.km_atual === '' || input.km_atual == null || !Number.isSafeInteger(km) || km < 0 || km > 999999999) throw Error('Informe a quilometragem em quilômetros inteiros, sem pontos ou vírgulas.');
  return { placa, marca, modelo, ano, km_atual: km };
}

export function vehicleError(error) {
  const message = String(error?.message || '');
  if (/schema cache|foto_path|register_vehicle_with_photo|Bucket not found/i.test(message)) return 'O cadastro com foto ainda precisa ser ativado no Supabase. Consulte o responsável pelo AutoFlow.';
  if (/JWT|session|token|not authenticated/i.test(message)) return 'Sua sessão expirou. Entre novamente.';
  if (/fetch|network|Failed to/i.test(message)) return 'Falha de conexão. Seus dados continuam nesta janela; tente salvar novamente.';
  return message || 'Não foi possível salvar. Confira sua conexão e tente novamente.';
}

export function createVehicleService(db) {
  async function account() {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw Error('Entre na sua conta para cadastrar ou consultar veículos.');
    const { data: client, error: profileError } = await db.from('tb_cli').select('id_cliente').eq('auth_user_id',user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!client) throw Error('Perfil do cliente não encontrado. Conclua seu cadastro.');
    return { user, client };
  }
  async function present(row) {
    let photoUrl = null;
    if (row.foto_path) {
      try {
        const { data, error } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(row.foto_path,3600);
        if (!error) photoUrl = data?.signedUrl || null;
      } catch { /* O cadastro continua válido mesmo se a imagem não carregar. */ }
    }
    return { id: row.id_veiculo, placa:row.placa,marca:row.marca || '',modelo:row.modelo || '',
      ano:row.ano_do_modelo,km_atual:row.km_atual,foto_path:row.foto_path,photoUrl };
  }
  return {
    async list() {
      const { client } = await account();
      const { data, error } = await db.from('tb_veiculo').select(FIELDS).eq('cliente_id',client.id_cliente).order('id_veiculo',{ascending:false});
      if (error) throw error;
      return Promise.all((data || []).map(present));
    },
    async create(input,capture) {
      const fields = validateVehicle(input);
      if (!(capture?.blob instanceof Blob) || capture.blob.type !== 'image/jpeg' || !capture.blob.size || capture.blob.size > 5242880) throw Error('Tire uma foto do veículo antes de salvar (máximo de 5 MB).');
      const { user,client } = await account();
      if (!capture.path || !capture.path.startsWith(`${user.id}/`)) {
        capture.path = `${user.id}/${crypto.randomUUID()}.jpg`; capture.uploaded = false;
      }
      // Recupera um cadastro cujo retorno se perdeu, evitando repetição da gravação.
      const previous = await db.from('tb_veiculo').select(FIELDS).eq('cliente_id',client.id_cliente).eq('foto_path',capture.path).maybeSingle();
      if (previous.error) throw previous.error;
      if (previous.data) { capture.saved=true; return present(previous.data); }
      if (!capture.uploaded) {
        const { error } = await db.storage.from(PHOTO_BUCKET).upload(capture.path,capture.blob,{contentType:'image/jpeg',upsert:false});
        if (error && String(error.statusCode || error.status) !== '409' && !/already exists|Duplicate/i.test(error.message || '')) throw error;
        capture.uploaded = true;
      }
      const { data,error } = await db.rpc('register_vehicle_with_photo',{
        p_plate:fields.placa,p_brand:fields.marca,p_model:fields.modelo,p_year:fields.ano,p_km:fields.km_atual,p_photo:capture.path,
      });
      if (error) throw error;
      capture.saved=true;
      return present(data);
    },
    async discard(capture) {
      // O banco proíbe excluir fotos já vinculadas, inclusive após retorno perdido.
      if (capture?.path && !capture.saved) {
        try { await db.storage.from(PHOTO_BUCKET).remove([capture.path]); } catch { /* Pode ser limpo posteriormente pelo administrador. */ }
      }
    },
  };
}
