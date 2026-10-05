(() => {
    "use strict";

    // =========================================================
    // AUTOFLOW - CAMADA DE INTERFACE
    // =========================================================
    // Este arquivo cuida apenas da interface e das validações.
    // A integração com banco/API deve ser feita em integration.js.

    function getIntegration() {
        return window.AutoFlowIntegration || {};
    }

    async function runIntegrationHook(name, payload) {
        const hook = getIntegration()[name];

        if (typeof hook !== "function") {
            return { handled: false, result: null };
        }

        const result = await hook(payload);
        return { handled: true, result };
    }

    function setMessage(element, text = "", type = "") {
        if (!element) return;

        element.textContent = text;
        element.className = type ? `form-message ${type}` : "form-message";
    }

    function normalizePlate(value) {
        return value
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 7);
    }

    function isValidPlate(value) {
        const placaAntiga = /^[A-Z]{3}[0-9]{4}$/;
        const placaMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

        return placaAntiga.test(value) || placaMercosul.test(value);
    }

    function createElement(tag, options = {}) {
        const element = document.createElement(tag);

        if (options.className) element.className = options.className;
        if (options.text !== undefined) element.textContent = options.text;

        return element;
    }

    // =========================================================
    // LOGIN
    // =========================================================

    function initLogin() {
        const form = document.querySelector("#login-form");
        const message = document.querySelector("#login-message");

        if (!form) return;

        form.addEventListener("submit", async function(event) {
            event.preventDefault();

            const payload = {
                email: form.elements.email.value.trim(),
                senha: form.elements.senha.value
            };

            setMessage(message, "");

            try {
                const { handled, result } = await runIntegrationHook("login", payload);

                if (!handled) {
                    console.log("Login pronto para integração:", payload.email);
                    setMessage(message, "Formulário de login validado.", "message-success");
                    return;
                }

                if (result?.success === false) {
                    setMessage(message, result.message || "E-mail ou senha inválidos.", "message-error");
                    return;
                }

                if (result?.redirect) {
                    window.location.href = result.redirect;
                }
            } catch (error) {
                console.error(error);
                setMessage(message, "Não foi possível realizar o login.", "message-error");
            }
        });
    }

    // =========================================================
    // CADASTRO
    // =========================================================

    function initRegister() {
        const form = document.querySelector("#register-form");
        const senha = document.querySelector("#senha");
        const confirmarSenha = document.querySelector("#confirmar-senha");
        const message = document.querySelector("#register-message");

        if (!form || !senha || !confirmarSenha) return;

        function validarSenhas() {
            if (confirmarSenha.value && senha.value !== confirmarSenha.value) {
                confirmarSenha.setCustomValidity("As senhas não coincidem.");
            } else {
                confirmarSenha.setCustomValidity("");
            }
        }

        senha.addEventListener("input", validarSenhas);
        confirmarSenha.addEventListener("input", validarSenhas);

        form.addEventListener("submit", async function(event) {
            event.preventDefault();
            validarSenhas();

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const payload = {
                nome: form.elements.nome.value.trim(),
                telefone: form.elements.telefone.value.trim(),
                email: form.elements.email.value.trim(),
                senha: form.elements.senha.value
            };

            setMessage(message, "");

            try {
                const { handled, result } = await runIntegrationHook("register", payload);

                if (!handled) {
                    setMessage(message, "Cadastro validado e pronto para integração.", "message-success");
                    return;
                }

                if (result?.success === false) {
                    setMessage(message, result.message || "Não foi possível criar a conta.", "message-error");
                    return;
                }

                setMessage(message, result?.message || "Conta criada com sucesso!", "message-success");

                if (result?.redirect) {
                    window.location.href = result.redirect;
                }
            } catch (error) {
                console.error(error);
                setMessage(message, "Não foi possível criar a conta.", "message-error");
            }
        });
    }

    // =========================================================
    // MOSTRAR / OCULTAR SENHA
    // =========================================================

    function initPasswordToggles() {
        const buttons = document.querySelectorAll(".toggle-password");

        buttons.forEach(function(button) {
            button.addEventListener("click", function() {
                const targetId = button.dataset.target;
                const input = document.getElementById(targetId);

                if (!input) return;

                const mostrar = input.type === "password";
                input.type = mostrar ? "text" : "password";
                button.textContent = mostrar ? "Ocultar senha" : "Mostrar senha";
            });
        });
    }

    // =========================================================
    // VEÍCULOS
    // =========================================================

    function createVehicleCard(vehicle) {
        const article = createElement("article", { className: "vehicle-card" });
        article.dataset.vehicleId = vehicle.id ?? "";

        const title = createElement("h3", {
            text: `${vehicle.marca || ""} ${vehicle.modelo || ""}`.trim() || "Veículo"
        });

        const dl = document.createElement("dl");
        const dtPlaca = createElement("dt", { text: "Placa" });
        const ddPlaca = createElement("dd", { text: vehicle.placa || "—" });
        const dtAno = createElement("dt", { text: "Ano" });
        const ddAno = createElement("dd", { text: vehicle.ano || "—" });

        dl.append(dtPlaca, ddPlaca, dtAno, ddAno);

        const details = createElement("button", {
            className: "button-link vehicle-details",
            text: "Ver detalhes"
        });
        details.type = "button";
        details.dataset.vehicleId = vehicle.id ?? "";

        article.append(title, dl, details);
        return article;
    }

    function renderVehicles(vehicles) {
        const list = document.querySelector("#vehicle-list");
        if (!list || !Array.isArray(vehicles)) return;

        list.innerHTML = "";

        if (vehicles.length === 0) {
            list.append(createElement("p", {
                className: "empty-state",
                text: "Nenhum veículo cadastrado."
            }));
            return;
        }

        vehicles.forEach(vehicle => list.append(createVehicleCard(vehicle)));
    }

    function initVehicles() {
        const placaInput = document.querySelector("#placa");
        const anoInput = document.querySelector("#ano");
        const form = document.querySelector("#vehicle-form");
        const list = document.querySelector("#vehicle-list");
        const message = document.querySelector("#vehicle-message");

        if (placaInput) {
            placaInput.addEventListener("input", function() {
                placaInput.value = normalizePlate(placaInput.value);

                if (placaInput.value === "" || isValidPlate(placaInput.value)) {
                    placaInput.setCustomValidity("");
                } else {
                    placaInput.setCustomValidity("Digite uma placa válida.");
                }
            });
        }

        if (anoInput) {
            const anoAtual = new Date().getFullYear();
            anoInput.max = anoAtual + 1;

            anoInput.addEventListener("input", function() {
                const ano = Number(anoInput.value);

                if (anoInput.value === "" || (ano >= 1900 && ano <= anoAtual + 1)) {
                    anoInput.setCustomValidity("");
                } else {
                    anoInput.setCustomValidity(`Informe um ano entre 1900 e ${anoAtual + 1}.`);
                }
            });
        }

        if (!form || !list) return;

        form.addEventListener("submit", async function(event) {
            event.preventDefault();

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const payload = {
                modelo: form.elements.modelo.value.trim(),
                marca: form.elements.marca.value.trim(),
                placa: normalizePlate(form.elements.placa.value),
                ano: Number(form.elements.ano.value)
            };

            setMessage(message, "");

            try {
                const { handled, result } = await runIntegrationHook("createVehicle", payload);

                if (handled && result?.success === false) {
                    setMessage(message, result.message || "Não foi possível cadastrar o veículo.", "message-error");
                    return;
                }

                const vehicle = handled && result?.vehicle ? result.vehicle : payload;

                const emptyState = list.querySelector(".empty-state");
                if (emptyState) emptyState.remove();

                list.append(createVehicleCard(vehicle));
                form.reset();
                setMessage(message, result?.message || "Veículo cadastrado com sucesso!", "message-success");
            } catch (error) {
                console.error(error);
                setMessage(message, "Não foi possível cadastrar o veículo.", "message-error");
            }
        });
    }

    // =========================================================
    // DASHBOARD
    // =========================================================

    const maintenanceStatuses = [
        "Recebido",
        "Diagnóstico",
        "Aguardando Peça",
        "Em Reparo",
        "Pronto para Retirada"
    ];

    function renderDashboard(data = {}) {
        const totalVehicles = document.querySelector("#total-vehicles");
        const totalServices = document.querySelector("#total-services");
        const totalFinished = document.querySelector("#total-finished");

        if (totalVehicles && data.totalVehicles !== undefined) {
            totalVehicles.textContent = data.totalVehicles;
        }
        if (totalServices && data.totalServices !== undefined) {
            totalServices.textContent = data.totalServices;
        }
        if (totalFinished && data.totalFinished !== undefined) {
            totalFinished.textContent = data.totalFinished;
        }
    }

    function renderMaintenance(data = {}) {
        const vehicleName = document.querySelector("#maintenance-vehicle-name");
        const statusElement = document.querySelector("#maintenance-status");
        const steps = document.querySelectorAll(".progress-steps .step");

        if (vehicleName && data.vehicleName) {
            vehicleName.textContent = data.vehicleName;
        }

        if (!statusElement || steps.length === 0 || !data.status) return;

        const currentIndex = maintenanceStatuses.indexOf(data.status);
        statusElement.textContent = data.status;

        steps.forEach(function(step, index) {
            step.classList.toggle("active", currentIndex >= 0 && index <= currentIndex);
        });
    }

    async function loadDashboardData() {
        try {
            const { handled, result } = await runIntegrationHook("loadDashboard");
            if (!handled || !result) return;

            if (result.dashboard) renderDashboard(result.dashboard);
            if (result.maintenance) renderMaintenance(result.maintenance);
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
        }
    }

    // =========================================================
    // OPÇÕES PARA AVALIAÇÕES
    // =========================================================

    function populateSelect(select, items, options = {}) {
        if (!select || !Array.isArray(items)) return;

        const placeholder = options.placeholder || "Selecione uma opção";
        const valueKey = options.valueKey || "id";
        const label = options.label || (item => item.nome || item.name || item.id);

        select.innerHTML = "";

        const firstOption = document.createElement("option");
        firstOption.value = "";
        firstOption.textContent = placeholder;
        select.append(firstOption);

        items.forEach(function(item) {
            const option = document.createElement("option");
            option.value = item[valueKey] ?? "";
            option.textContent = label(item);
            select.append(option);
        });
    }

    function populateEvaluationOptions(data = {}) {
        const evaluationOrder = document.querySelector("#evaluation-order");
        if (!evaluationOrder || !Array.isArray(data.evaluationOrders)) return;

        populateSelect(evaluationOrder, data.evaluationOrders, {
            placeholder: data.evaluationOrders.length
                ? "Selecione uma ordem de serviço"
                : "Nenhum serviço concluído disponível para avaliação",
            label: order => `${order.oficina} — ${order.veiculo} (OS #${order.id})`
        });

        evaluationOrder.disabled = data.evaluationOrders.length === 0;
    }

    async function loadEvaluationOptions() {
        const evaluationOrder = document.querySelector("#evaluation-order");
        if (!evaluationOrder) return;

        try {
            const { handled, result } = await runIntegrationHook("loadFormOptions");
            if (handled && result) populateEvaluationOptions(result);
        } catch (error) {
            console.error("Erro ao carregar ordens disponíveis para avaliação:", error);
        }
    }

    // =========================================================
    // OFICINAS
    // =========================================================

    function createWorkshopCard(workshop) {
        const article = createElement("article", { className: "workshop-card" });
        article.dataset.workshopId = workshop.id ?? "";

        const header = createElement("div", { className: "workshop-header" });
        header.append(
            createElement("h3", { text: workshop.nome || workshop.name || "Oficina" }),
            createElement("span", {
                className: "rating",
                text: `⭐ ${workshop.avaliacao ?? workshop.rating ?? "—"}`
            })
        );

        const address = createElement("p", {
            className: "workshop-address",
            text: `📍 ${workshop.endereco || workshop.address || "Endereço não informado"}`
        });

        const distance = createElement("p", {
            className: "workshop-distance",
            text: workshop.distancia || workshop.distance || "Distância não informada"
        });

        const button = createElement("button", {
            className: "button-link workshop-details",
            text: "Ver oficina"
        });
        button.type = "button";
        button.dataset.workshopId = workshop.id ?? "";
        button.dataset.name = workshop.nome || workshop.name || "Oficina";
        button.dataset.address = workshop.endereco || workshop.address || "Endereço não informado";
        button.dataset.distance = workshop.distancia || workshop.distance || "Distância não informada";
        button.dataset.rating = workshop.avaliacao ?? workshop.rating ?? "—";

        article.append(header, address, distance, button);
        return article;
    }

    function renderWorkshops(workshops) {
        const grid = document.querySelector("#workshop-list");
        if (!grid || !Array.isArray(workshops)) return;

        grid.innerHTML = "";

        if (workshops.length === 0) {
            grid.append(createElement("p", {
                className: "empty-state",
                text: "Nenhuma oficina encontrada."
            }));
            return;
        }

        workshops.forEach(workshop => grid.append(createWorkshopCard(workshop)));
    }

    function initWorkshopSearch() {
        const search = document.querySelector("#workshop-search");
        const grid = document.querySelector("#workshop-list");

        if (!search || !grid) return;

        search.addEventListener("input", function() {
            const query = search.value.trim().toLowerCase();
            const cards = grid.querySelectorAll(".workshop-card");

            cards.forEach(function(card) {
                const text = card.textContent.toLowerCase();
                card.hidden = !text.includes(query);
            });
        });
    }

    function initWorkshopModal() {
        const grid = document.querySelector("#workshop-list");
        const modal = document.querySelector("#workshop-modal");
        const closeButton = document.querySelector("#close-workshop-modal");
        const name = document.querySelector("#workshop-modal-name");
        const address = document.querySelector("#workshop-modal-address");
        const distance = document.querySelector("#workshop-modal-distance");
        const rating = document.querySelector("#workshop-modal-rating");

        if (!grid || !modal || !closeButton || !name || !address || !distance || !rating) return;

        function closeModal() {
            modal.hidden = true;
        }

        grid.addEventListener("click", function(event) {
            const button = event.target.closest(".workshop-details");
            if (!button) return;

            name.textContent = button.dataset.name || "Oficina";
            address.textContent = `📍 ${button.dataset.address || "Endereço não informado"}`;
            distance.textContent = button.dataset.distance || "Distância não informada";
            rating.textContent = `⭐ ${button.dataset.rating || "—"}`;
            modal.hidden = false;
        });

        closeButton.addEventListener("click", closeModal);

        modal.addEventListener("click", function(event) {
            if (event.target === modal) closeModal();
        });

        document.addEventListener("keydown", function(event) {
            if (event.key === "Escape" && !modal.hidden) closeModal();
        });
    }

    async function loadWorkshops() {
        try {
            const { handled, result } = await runIntegrationHook("loadWorkshops");
            if (handled && Array.isArray(result)) renderWorkshops(result);
        } catch (error) {
            console.error("Erro ao carregar oficinas:", error);
        }
    }

    // =========================================================
    // AVALIAÇÕES
    // =========================================================

    function createEvaluationCard(evaluation) {
        const article = createElement("article", { className: "evaluation-card" });
        article.dataset.evaluationId = evaluation.id ?? "";

        const header = createElement("div", { className: "evaluation-header" });
        header.append(
            createElement("h3", { text: evaluation.oficina || evaluation.workshopName || "Oficina" }),
            createElement("span", { text: "⭐".repeat(Number(evaluation.nota) || 0) })
        );

        article.append(
            header,
            createElement("p", { text: evaluation.comentario || evaluation.comment || "Sem comentário." })
        );

        return article;
    }

    function renderEvaluations(evaluations) {
        const grid = document.querySelector("#evaluation-list");
        if (!grid || !Array.isArray(evaluations)) return;

        grid.innerHTML = "";

        if (evaluations.length === 0) {
            grid.append(createElement("p", {
                className: "empty-state",
                text: "Você ainda não possui avaliações."
            }));
            return;
        }

        evaluations.forEach(evaluation => grid.append(createEvaluationCard(evaluation)));
    }

    function initEvaluations() {
        const stars = document.querySelectorAll(".rating-star");
        const ratingValue = document.querySelector("#rating-value");
        const form = document.querySelector("#evaluation-form");
        const message = document.querySelector("#evaluation-message");

        if (stars.length === 0 || !ratingValue || !form) return;

        stars.forEach(function(star) {
            star.addEventListener("click", function() {
                const value = Number(star.dataset.value);
                ratingValue.value = value;

                stars.forEach(function(currentStar) {
                    currentStar.classList.toggle(
                        "selected",
                        Number(currentStar.dataset.value) <= value
                    );
                });

                setMessage(message, "");
            });
        });

        form.addEventListener("submit", async function(event) {
            event.preventDefault();

            if (!ratingValue.value) {
                setMessage(message, "Selecione uma nota antes de enviar.", "message-error");
                return;
            }

            const osId = form.elements.os_id.value;
            if (!osId) {
                setMessage(message, "Selecione uma ordem de serviço antes de enviar.", "message-error");
                return;
            }

            const payload = {
                osId,
                nota: Number(ratingValue.value),
                comentario: form.elements.comentario.value.trim()
            };

            try {
                const { handled, result } = await runIntegrationHook("createEvaluation", payload);

                if (handled && result?.success === false) {
                    setMessage(message, result.message || "Não foi possível enviar a avaliação.", "message-error");
                    return;
                }

                setMessage(message, result?.message || "Avaliação enviada com sucesso!", "message-success");
                form.reset();
                ratingValue.value = "";
                stars.forEach(star => star.classList.remove("selected"));

                if (handled && result?.evaluation) {
                    const list = document.querySelector("#evaluation-list");
                    const emptyState = list?.querySelector(".empty-state");
                    if (emptyState) emptyState.remove();
                    list?.prepend(createEvaluationCard(result.evaluation));
                    loadEvaluationOptions();
                }
            } catch (error) {
                console.error(error);
                setMessage(message, "Não foi possível enviar a avaliação.", "message-error");
            }
        });
    }

    async function loadEvaluations() {
        try {
            const { handled, result } = await runIntegrationHook("loadEvaluations");
            if (handled && Array.isArray(result)) renderEvaluations(result);
        } catch (error) {
            console.error("Erro ao carregar avaliações:", error);
        }
    }

    // =========================================================
    // PERFIL
    // =========================================================

    function renderProfile(profile = {}) {
        const name = document.querySelector("#profile-name");
        const email = document.querySelector("#profile-email");
        const phone = document.querySelector("#profile-phone");

        if (name && profile.nome !== undefined) name.value = profile.nome;
        if (email && profile.email !== undefined) email.value = profile.email;
        if (phone && profile.telefone !== undefined) phone.value = profile.telefone;
    }

    function initProfile() {
        const form = document.querySelector("#profile-form");
        const editButton = document.querySelector("#edit-profile");
        const saveButton = document.querySelector("#save-profile");
        const cancelButton = document.querySelector("#cancel-profile");
        const message = document.querySelector("#profile-message");

        if (!form || !editButton || !saveButton || !cancelButton) return;

        const inputs = Array.from(form.querySelectorAll("input"));
        let previousValues = [];

        function setEditing(editing) {
            inputs.forEach(input => input.readOnly = !editing);
            editButton.hidden = editing;
            saveButton.hidden = !editing;
            cancelButton.hidden = !editing;
        }

        editButton.addEventListener("click", function() {
            previousValues = inputs.map(input => input.value);
            setEditing(true);
            setMessage(message, "");
        });

        cancelButton.addEventListener("click", function() {
            inputs.forEach((input, index) => input.value = previousValues[index] ?? "");
            setEditing(false);
            setMessage(message, "Alterações canceladas.");
        });

        form.addEventListener("submit", async function(event) {
            event.preventDefault();

            const payload = {
                nome: form.elements.nome.value.trim(),
                email: form.elements.email.value.trim(),
                telefone: form.elements.telefone.value.trim()
            };

            try {
                const { handled, result } = await runIntegrationHook("updateProfile", payload);

                if (handled && result?.success === false) {
                    setMessage(message, result.message || "Não foi possível atualizar o perfil.", "message-error");
                    return;
                }

                if (handled && result?.profile) renderProfile(result.profile);
                setEditing(false);
                setMessage(message, result?.message || "Perfil atualizado com sucesso!", "message-success");
            } catch (error) {
                console.error(error);
                setMessage(message, "Não foi possível atualizar o perfil.", "message-error");
            }
        });
    }

    async function loadProfile() {
        try {
            const { handled, result } = await runIntegrationHook("loadProfile");
            if (handled && result) renderProfile(result);
        } catch (error) {
            console.error("Erro ao carregar perfil:", error);
        }
    }

    // =========================================================
    // CARREGAMENTO INICIAL
    // =========================================================

    async function loadVehicles() {
        try {
            const { handled, result } = await runIntegrationHook("loadVehicles");
            if (handled && Array.isArray(result)) renderVehicles(result);
        } catch (error) {
            console.error("Erro ao carregar veículos:", error);
        }
    }

    document.addEventListener("DOMContentLoaded", function() {
        initLogin();
        initRegister();
        initPasswordToggles();
        initVehicles();
        initWorkshopSearch();
        initWorkshopModal();
        initEvaluations();
        initProfile();

        loadVehicles();
        loadWorkshops();
        loadDashboardData();
        loadEvaluationOptions();
        loadEvaluations();
        loadProfile();
    });

    // API pública para que a integração consiga atualizar a interface
    // sem duplicar código de DOM.
    window.AutoFlowUI = Object.freeze({
        renderVehicles,
        renderWorkshops,
        renderDashboard,
        renderMaintenance,
        renderEvaluations,
        renderProfile,
        populateEvaluationOptions,
        setMessage
    });
})();