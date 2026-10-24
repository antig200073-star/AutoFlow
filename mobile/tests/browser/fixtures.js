export const user = { id: '11111111-1111-4111-8111-111111111111', email: 'cliente@example.test',
  aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { nome: 'Cliente de teste' }, created_at: '2026-01-01T00:00:00Z' };
export function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, aud: 'authenticated' })}.test-only`,
    refresh_token: 'test-only-refresh', expires_in: 3600, expires_at: exp, token_type: 'bearer', user };
}
export const storageKey = 'sb-tohlfwbzmkjlivcpssbe-auth-token';
export async function seedSession(page) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: session() });
}
export async function mockApi(page) {
  const requests = [];
  const vehicle = { id_veiculo: 10, cliente_id: 7, marca: 'Chevrolet', modelo: 'Opala', placa: 'ABC1D23', ano: 1980, km_atual: 10000, foto_path: null };
  const client = { id_cliente: 7, auth_user_id: user.id, nome: 'Cliente de teste', email: user.email, num_tel: '11999999999', cep: null };
  const workshop = { id: 2, nome: 'Oficina de teste', telefone: '11900000000', logradouro: 'Rua de teste', numero: '10', cidade: 'Santo André', estado: 'SP' };
  const orders = [
    { id: 31, cliente_id: 7, oficina_id: 2, veiculo_id: 10, status: 'em_analise', data_entrada: '2026-10-01T12:00:00Z', tb_veiculo: vehicle, oficinas: { nome: workshop.nome }, descricao_problema: 'Revisão' },
    { id: 30, cliente_id: 7, oficina_id: 2, veiculo_id: 10, status: 'entregue', data_entrada: '2026-09-01T12:00:00Z', data_saida: '2026-09-02T12:00:00Z', tb_veiculo: vehicle, oficinas: { nome: workshop.nome }, descricao_problema: 'Troca de óleo' },
  ];
  await page.route('https://tohlfwbzmkjlivcpssbe.supabase.co/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    requests.push({ path: url.pathname, query: url.searchParams.toString(), method: request.method(), body: request.postDataJSON() });
    let body; let status = 200; const headers = {};
    if (url.pathname === '/auth/v1/token') body = session();
    else if (url.pathname === '/auth/v1/user') body = user;
    else if (url.pathname === '/auth/v1/logout') { status = 204; body = null; }
    else if (url.pathname === '/auth/v1/signup') body = { user, session: null };
    else if (url.pathname === '/rest/v1/tb_cli') body = [client];
    else if (url.pathname === '/rest/v1/tb_veiculo') { body = [vehicle]; headers['content-range'] = '0-0/1'; }
    else if (url.pathname === '/rest/v1/ordens_servico') body = url.searchParams.has('id') ? orders.filter(o => `eq.${o.id}` === url.searchParams.get('id')) : orders;
    else if (url.pathname === '/rest/v1/oficinas') body = [workshop];
    else if (url.pathname === '/rest/v1/avaliacoes') body = request.method() === 'POST'
      ? [{ id: 1, ...request.postDataJSON(), created_at: '2026-10-24T00:00:00Z' }] : [];
    else if (url.pathname === '/rest/v1/rpc/workshop_public_reviews') body = [{ id: 1, nota: 5, comentario: 'Atendimento de teste', created_at: '2026-10-01T12:00:00Z' }];
    else if (url.pathname === '/rest/v1/rpc/issue_vehicle_workshop_link') body = { code: 'TESTE-CODIGO', expires_at: '2026-10-24T01:00:00Z' };
    else { await route.abort(); throw Error(`Requisição não simulada: ${request.method()} ${url.pathname}`); }
    if (request.headers().accept?.includes('vnd.pgrst.object+json') && Array.isArray(body)) body = body[0] ?? null;
    await route.fulfill({ status, contentType: 'application/json', headers, body: status === 204 || request.method() === 'HEAD' ? '' : JSON.stringify(body) });
  });
  return requests;
}

// Exercita a ponte JavaScript; não substitui testes do plugin em um Android real.
export async function mockNative(page) {
  await page.addInitScript(() => {
    window.androidBridge = {};
    const listeners = new Map(); let id = 0;
    window.nativeCalls = [];
    window.emitNative = async (event, payload = {}) => {
      for (const item of [...listeners.values()]) if (item.event === event) await item.callback(payload);
    };
    const methods = {
      App: ['getState', 'getLaunchUrl', 'minimizeApp'], Browser: ['open', 'close'],
      Keyboard: ['hide'], Preferences: ['get', 'set', 'remove'], SplashScreen: ['hide'], SystemBars: ['setStyle'],
    };
    window.Capacitor = {
      PluginHeaders: Object.entries(methods).map(([name, names]) => ({ name, methods: [
        ...names.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' },
      ] })),
      nativeCallback(plugin, method, options, callback) {
        const key = String(++id); listeners.set(key, { event: options.eventName, callback }); return key;
      },
      async nativePromise(plugin, method, options = {}) {
        window.nativeCalls.push({ plugin, method, options });
        if (method === 'removeListener') { listeners.delete(options.callbackId); return; }
        if (plugin === 'Preferences') {
          const key = `native:${options.key}`;
          if (method === 'get') return { value: localStorage.getItem(key) };
          if (method === 'set') localStorage.setItem(key, options.value);
          if (method === 'remove') localStorage.removeItem(key);
        }
        if (plugin === 'App' && method === 'getState') return { isActive: true };
        if (plugin === 'App' && method === 'getLaunchUrl') return {};
        return {};
      },
    };
  });
}
