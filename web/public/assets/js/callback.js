(() => {
    "use strict";

    async function finishOAuthLogin() {
        const message = document.getElementById("callback-message");
        const client = window.AutoFlowSupabase;

        if (!client) {
            if (message) message.textContent = "A conexão com o Supabase não foi carregada.";
            return;
        }

        try {
            // detectSessionInUrl é habilitado em integration.js. O cliente processa
            // os parâmetros retornados pelo OAuth e persiste a sessão no navegador.
            const { data, error } = await client.auth.getSession();
            if (error) throw error;

            if (data.session) {
                window.location.replace("dashboard.html");
                return;
            }

            // Em alguns navegadores o processamento do retorno OAuth termina
            // alguns instantes depois do DOMContentLoaded. Esperamos o primeiro
            // evento de autenticação antes de declarar falha.
            await new Promise((resolve, reject) => {
                let settled = false;
                const timeout = window.setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    subscription?.unsubscribe();
                    reject(new Error("Sessão não encontrada após o retorno do Google."));
                }, 5000);

                const { data: listener } = client.auth.onAuthStateChange((event, session) => {
                    if (settled || !session) return;
                    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
                        settled = true;
                        window.clearTimeout(timeout);
                        listener.subscription.unsubscribe();
                        resolve();
                    }
                });

                const subscription = listener.subscription;
            });

            window.location.replace("dashboard.html");
        } catch (error) {
            console.error("Falha no callback OAuth:", error);
            if (message) {
                message.textContent = "Não foi possível concluir o login com o Google. Volte e tente novamente.";
            }
            window.setTimeout(() => window.location.replace("index.html"), 2500);
        }
    }

    document.addEventListener("DOMContentLoaded", finishOAuthLogin);
})();
