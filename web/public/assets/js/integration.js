/*
=============================================================
AUTOFLOW - INTEGRAÇÃO SUPABASE
=============================================================
Camada única de autenticação e acesso ao banco.
A chave abaixo é a chave publicável/anon do Supabase e pode ser usada
no navegador. Nunca coloque service_role aqui.
=============================================================
*/

(() => {
    "use strict";

    const SUPABASE_URL = "https://tohlfwbzmkjlivcpssbe.supabase.co";
    const SUPABASE_KEY = "sb_publishable_mhjRE7bumaGkOBsmv9TpBw_TwC49j6D";

    if (!window.supabase?.createClient) {
        console.error("Supabase JS não foi carregado. Inclua @supabase/supabase-js antes de integration.js.");
        window.AutoFlowIntegration = {};
        return;
    }

    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });

    window.AutoFlowSupabase = db;

    function friendlyError(error, fallback = "Não foi possível concluir a operação.") {
        if (!error) return fallback;
        const message = String(error.message || error);

        if (/Invalid login credentials/i.test(message)) return "E-mail ou senha inválidos.";
        if (/User already registered/i.test(message)) return "Este e-mail já está cadastrado.";
        if (/Password should be at least/i.test(message)) return "A senha precisa ter pelo menos 6 caracteres.";
        if (/Email not confirmed/i.test(message)) return "E-mail ainda não confirmado. Abra a mensagem de confirmação enviada pelo Supabase e confirme sua conta antes de entrar.";
        if (/invalid input syntax for type bigint/i.test(message)) return "Foi enviado um identificador inválido ao banco. Atualize a página e selecione novamente o registro.";
        if (/duplicate key/i.test(message)) return "Já existe um registro com esses dados.";
        if (/row-level security/i.test(message)) return "Seu usuário não tem permissão para esta operação.";

        return message || fallback;
    }

    async function currentUser() {
        const { data, error } = await db.auth.getUser();
        if (error) throw error;
        return data.user;
    }

    async function currentClient() {
        const user = await currentUser();
        if (!user) return null;

        const { data, error } = await db
            .from("tb_cli")
            .select("id_cliente, auth_user_id, nome, email, num_tel, cep")
            .eq("auth_user_id", user.id)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async function requireClient() {
        const client = await currentClient();
        if (!client) throw new Error("Perfil do cliente não encontrado. Execute o SQL de integração do projeto no Supabase.");
        return client;
    }

    function vehicleToUI(row) {
        return {
            id: row.id_veiculo,
            marca: row.marca || "",
            modelo: row.modelo || "",
            placa: row.placa || "",
            ano: row.ano_do_modelo || ""
        };
    }

    function workshopAddress(row) {
        return [row.logradouro, row.numero, row.bairro, row.cidade, row.estado]
            .filter(Boolean)
            .join(", ");
    }

    const statusToUI = {
        aguardando: "Recebido",
        em_analise: "Diagnóstico",
        em_manutencao: "Em Reparo",
        pronto: "Pronto para Retirada",
        entregue: "Pronto para Retirada"
    };

    window.AutoFlowIntegration = {
        async login({ email, senha }) {
            const { error } = await db.auth.signInWithPassword({ email, password: senha });
            if (error) return { success: false, message: friendlyError(error) };
            return { success: true, redirect: "dashboard.html" };
        },

        async register({ nome, telefone, email, senha }) {
            const { data, error } = await db.auth.signUp({
                email,
                password: senha,
                options: {
                    data: { nome, telefone }
                }
            });

            if (error) return { success: false, message: friendlyError(error) };

            // O trigger SQL cria tb_cli automaticamente. Se já houver sessão,
            // atualizamos o telefone imediatamente para garantir sincronização.
            if (data.session && data.user) {
                const { error: profileError } = await db
                    .from("tb_cli")
                    .update({ nome, email, num_tel: telefone || null })
                    .eq("auth_user_id", data.user.id);

                if (profileError) return { success: false, message: friendlyError(profileError) };
                return { success: true, message: "Conta criada com sucesso!", redirect: "dashboard.html" };
            }

            return {
                success: true,
                message: "Conta criada. Confira seu e-mail para confirmar o cadastro.",
                redirect: "index.html"
            };
        },

        async loginWithGoogle() {
            const redirectTo = new URL("callback.html", window.location.href).href;
            const { error } = await db.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo }
            });
            if (error) throw error;
        },

        async logout() {
            const { error } = await db.auth.signOut();
            if (error) throw error;
            window.location.href = "index.html";
        },

        async loadVehicles() {
            const client = await currentClient();
            if (!client) return [];

            const { data, error } = await db
                .from("tb_veiculo")
                .select("id_veiculo, placa, marca, modelo, ano_do_modelo, km_atual")
                .eq("cliente_id", client.id_cliente)
                .order("id_veiculo", { ascending: false });

            if (error) throw error;
            return (data || []).map(vehicleToUI);
        },

        async createVehicle(vehicle) {
            try {
                const client = await requireClient();
                const { data, error } = await db
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

                if (error) throw error;
                return { success: true, message: "Veículo cadastrado com sucesso!", vehicle: vehicleToUI(data) };
            } catch (error) {
                return { success: false, message: friendlyError(error) };
            }
        },

        async loadDashboard() {
            const client = await currentClient();
            if (!client) return null;

            const [vehiclesResult, servicesResult] = await Promise.all([
                db.from("tb_veiculo").select("id_veiculo", { count: "exact", head: true }).eq("cliente_id", client.id_cliente),
                db.from("ordens_servico")
                    .select("id, status, data_entrada, veiculo_id, tb_veiculo(marca, modelo)")
                    .eq("cliente_id", client.id_cliente)
                    .order("data_entrada", { ascending: false })
            ]);

            if (vehiclesResult.error) throw vehiclesResult.error;
            if (servicesResult.error) throw servicesResult.error;

            const services = servicesResult.data || [];
            const active = services.filter(item => item.status !== "entregue");
            const finished = services.filter(item => item.status === "entregue");
            const latest = active[0] || services[0];
            const vehicle = latest?.tb_veiculo;

            return {
                dashboard: {
                    totalVehicles: vehiclesResult.count || 0,
                    totalServices: active.length,
                    totalFinished: finished.length
                },
                maintenance: latest ? {
                    vehicleName: [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ") || "Veículo",
                    status: statusToUI[latest.status] || "Recebido"
                } : null
            };
        },

        async loadWorkshops() {
            // A lista de oficinas é a parte essencial. O cálculo das avaliações é
            // complementar e não pode impedir as oficinas de aparecerem.
            const { data: workshops, error } = await db
                .from("oficinas")
                .select("id, nome, telefone, cep, logradouro, numero, bairro, cidade, estado")
                .order("nome");

            if (error) throw error;

            const ratings = new Map();

            try {
                const { data: orders, error: osError } = await db
                    .from("ordens_servico")
                    .select("id, oficina_id");

                if (osError) throw osError;

                const orderToWorkshop = new Map((orders || []).map(os => [Number(os.id), Number(os.oficina_id)]));
                const orderIds = [...orderToWorkshop.keys()];

                if (orderIds.length) {
                    const { data: evaluations, error: evError } = await db
                        .from("avaliacoes")
                        .select("os_id, nota")
                        .in("os_id", orderIds);

                    if (evError) throw evError;

                    (evaluations || []).forEach(ev => {
                        const workshopId = orderToWorkshop.get(Number(ev.os_id));
                        if (!workshopId) return;
                        if (!ratings.has(workshopId)) ratings.set(workshopId, []);
                        ratings.get(workshopId).push(Number(ev.nota));
                    });
                }
            } catch (ratingError) {
                // Não bloqueia a lista de oficinas por causa de uma falha nas avaliações.
                console.warn("Não foi possível calcular as avaliações das oficinas:", ratingError);
            }

            return (workshops || []).map(workshop => {
                const notes = ratings.get(Number(workshop.id)) || [];
                const average = notes.length
                    ? (notes.reduce((sum, value) => sum + value, 0) / notes.length).toFixed(1)
                    : "—";

                return {
                    id: Number(workshop.id),
                    nome: workshop.nome,
                    endereco: workshopAddress(workshop),
                    distancia: workshop.cidade || "Distância não informada",
                    avaliacao: average
                };
            });
        },

        async loadFormOptions() {
            // Cada grupo é carregado separadamente. Assim, por exemplo, uma falha
            // ao consultar oficinas não apaga os veículos que foram carregados.
            let vehicles = [];
            let workshops = [];
            let evaluationOrders = [];

            try {
                vehicles = await this.loadVehicles();
            } catch (vehicleError) {
                console.error("Erro ao carregar veículos para o formulário:", vehicleError);
            }

            try {
                workshops = await this.loadWorkshops();
            } catch (workshopError) {
                console.error("Erro ao carregar oficinas para o formulário:", workshopError);
            }

            try {
                const client = await currentClient();

                if (client) {
                    // Evita depender de relacionamentos aninhados do PostgREST.
                    // Primeiro buscamos as OS e depois resolvemos nomes de veículo/oficina.
                    const { data: orders, error: orderError } = await db
                        .from("ordens_servico")
                        .select("id, oficina_id, veiculo_id, status, data_entrada")
                        .eq("cliente_id", client.id_cliente)
                        .eq("status", "entregue")
                        .order("data_entrada", { ascending: false });

                    if (orderError) throw orderError;

                    const orderIds = (orders || []).map(order => Number(order.id));
                    let evaluatedIds = new Set();

                    if (orderIds.length) {
                        const { data: evaluations, error: evaluationError } = await db
                            .from("avaliacoes")
                            .select("os_id")
                            .in("os_id", orderIds);

                        if (evaluationError) throw evaluationError;
                        evaluatedIds = new Set((evaluations || []).map(item => Number(item.os_id)));
                    }

                    const vehicleMap = new Map(vehicles.map(vehicle => [Number(vehicle.id), vehicle]));
                    const workshopMap = new Map(workshops.map(workshop => [Number(workshop.id), workshop]));

                    evaluationOrders = (orders || [])
                        .filter(order => !evaluatedIds.has(Number(order.id)))
                        .map(order => {
                            const vehicle = vehicleMap.get(Number(order.veiculo_id));
                            const workshop = workshopMap.get(Number(order.oficina_id));

                            return {
                                id: Number(order.id),
                                oficina: workshop?.nome || `Oficina #${order.oficina_id}`,
                                veiculo: vehicle
                                    ? ([vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || vehicle.placa)
                                    : `Veículo #${order.veiculo_id}`
                            };
                        });
                }
            } catch (evaluationOrderError) {
                console.error("Erro ao carregar ordens disponíveis para avaliação:", evaluationOrderError);
            }

            return { vehicles, workshops, evaluationOrders };
        },

        async loadEvaluations() {
            const client = await currentClient();
            if (!client) return [];

            const { data: orders, error: osError } = await db
                .from("ordens_servico")
                .select("id, oficina_id, oficinas(nome)")
                .eq("cliente_id", client.id_cliente);
            if (osError) throw osError;

            const orderMap = new Map((orders || []).map(os => [os.id, os]));
            const orderIds = [...orderMap.keys()];
            if (!orderIds.length) return [];

            const { data, error } = await db
                .from("avaliacoes")
                .select("id, os_id, nota, comentario, created_at")
                .in("os_id", orderIds)
                .order("created_at", { ascending: false });
            if (error) throw error;

            return (data || []).map(ev => ({
                id: ev.id,
                oficina: orderMap.get(ev.os_id)?.oficinas?.nome || "Oficina",
                nota: ev.nota,
                comentario: ev.comentario || ""
            }));
        },

        async createEvaluation({ osId, nota, comentario }) {
            try {
                const client = await requireClient();
                const parsedOsId = Number(osId);
                const parsedNota = Number(nota);

                if (!Number.isInteger(parsedOsId) || parsedOsId <= 0) {
                    return { success: false, message: "Selecione uma ordem de serviço válida." };
                }
                if (!Number.isInteger(parsedNota) || parsedNota < 1 || parsedNota > 5) {
                    return { success: false, message: "Selecione uma nota de 1 a 5." };
                }

                const { data: order, error: osError } = await db
                    .from("ordens_servico")
                    .select("id, status, oficinas(nome)")
                    .eq("id", parsedOsId)
                    .eq("cliente_id", client.id_cliente)
                    .maybeSingle();

                if (osError) throw osError;
                if (!order) {
                    return { success: false, message: "Essa ordem de serviço não pertence ao usuário atual." };
                }
                if (order.status !== "entregue") {
                    return { success: false, message: "A avaliação só pode ser enviada após a finalização do serviço." };
                }

                const { data: existing, error: existingError } = await db
                    .from("avaliacoes")
                    .select("id")
                    .eq("os_id", parsedOsId)
                    .maybeSingle();
                if (existingError) throw existingError;
                if (existing) {
                    return { success: false, message: "Essa ordem de serviço já foi avaliada." };
                }

                const { data, error } = await db
                    .from("avaliacoes")
                    .insert({ os_id: parsedOsId, nota: parsedNota, comentario: comentario || null })
                    .select("id, nota, comentario")
                    .single();
                if (error) throw error;

                return {
                    success: true,
                    message: "Avaliação enviada com sucesso!",
                    evaluation: {
                        id: data.id,
                        oficina: order.oficinas?.nome || "Oficina",
                        nota: data.nota,
                        comentario: data.comentario || ""
                    }
                };
            } catch (error) {
                return { success: false, message: friendlyError(error) };
            }
        },

        async loadProfile() {
            const client = await currentClient();
            if (!client) return null;
            return {
                nome: client.nome || "",
                email: client.email || "",
                telefone: client.num_tel || ""
            };
        },

        async updateProfile(profile) {
            try {
                const user = await currentUser();
                if (!user) return { success: false, message: "Faça login para editar o perfil." };

                if (profile.email && profile.email !== user.email) {
                    const { error: authError } = await db.auth.updateUser({ email: profile.email });
                    if (authError) throw authError;
                }

                const { data, error } = await db
                    .from("tb_cli")
                    .update({
                        nome: profile.nome,
                        email: profile.email,
                        num_tel: profile.telefone || null
                    })
                    .eq("auth_user_id", user.id)
                    .select("nome, email, num_tel")
                    .single();
                if (error) throw error;

                return {
                    success: true,
                    message: "Perfil atualizado com sucesso!",
                    profile: { nome: data.nome, email: data.email, telefone: data.num_tel || "" }
                };
            } catch (error) {
                return { success: false, message: friendlyError(error) };
            }
        }
    };

    document.addEventListener("DOMContentLoaded", async () => {
        const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
        const publicPages = new Set(["index.html", "cadastro.html", "callback.html", ""]);

        try {
            const { data } = await db.auth.getSession();
            const loggedIn = Boolean(data.session);

            if (!publicPages.has(page) && !loggedIn) {
                window.location.replace("index.html");
                return;
            }
        } catch (error) {
            console.error("Falha ao validar sessão:", error);
            if (!publicPages.has(page)) {
                window.location.replace("index.html");
                return;
            }
        }

        const logoutLink = document.getElementById("logout-link");
        if (logoutLink) {
            logoutLink.addEventListener("click", async (event) => {
                event.preventDefault();
                try {
                    await window.AutoFlowIntegration.logout();
                } catch (error) {
                    console.error("Erro ao sair:", error);
                }
            });
        }

        const googleButton = document.getElementById("btn-google");
        if (googleButton) {
            googleButton.addEventListener("click", async () => {
                try {
                    googleButton.disabled = true;
                    await window.AutoFlowIntegration.loginWithGoogle();
                } catch (error) {
                    console.error("Erro ao autenticar com Google:", error);
                    const message = document.getElementById("login-message");
                    if (message) {
                        message.textContent = friendlyError(error, "Não foi possível entrar com o Google.");
                        message.className = "form-message message-error";
                    }
                    googleButton.disabled = false;
                }
            });
        }
    });
})();
