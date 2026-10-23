import { vehicleError } from './vehicle-service.js';

// Compartilhado por HTML e React: a autorização só é emitida quando o cliente solicita.
if (globalThis.customElements && !customElements.get('autoflow-vehicle-link')) {
  class VehicleLink extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `<style>
        *{box-sizing:border-box}dialog{margin:auto;width:min(540px,calc(100% - 24px));max-height:90dvh;overflow:auto;padding:24px;border:1px solid #d7dbe0;border-radius:14px;background:#fff;color:#16181d;font:16px 'Segoe UI',Arial,sans-serif}
        dialog::backdrop{background:#10141bbb}header{display:flex;align-items:start;justify-content:space-between;gap:16px}h2{font-size:22px;margin:0}p{line-height:1.5}button{min-height:44px;padding:10px 14px;font:inherit;border:1px solid #d7dbe0;border-radius:8px;background:#c62828;color:white;cursor:pointer}button:disabled{opacity:.6;cursor:wait}header button{background:white;color:#16181d}input{width:100%;margin:8px 0 12px;padding:12px;font:15px monospace;background:white;color:#16181d;border:1px solid #939dac;border-radius:8px}label{display:block;font-weight:600}[hidden]{display:none!important}.error{color:#a61f1f}:focus-visible{outline:3px solid #2058a5;outline-offset:3px}
      </style><dialog aria-labelledby="title"><header><h2 id="title">Vincular à oficina</h2><button id="close" type="button">Fechar</button></header>
        <p id="vehicle"></p><p>Entregue este código somente à oficina escolhida. Ela deve informá-lo ao abrir a O.S. para que o serviço apareça na sua conta.</p>
        <p id="message" role="status"></p><div id="result" hidden><label for="code">Código de vínculo</label><input id="code" readonly><p id="expiry"></p><button id="copy" type="button">Copiar código</button></div>
        <p>O código vale por 15 minutos e pode ser usado uma vez. Gerar outro invalida o anterior.</p><button id="generate" type="button">Gerar código</button>
      </dialog>`;
      this.$ = id => this.shadowRoot.getElementById(id);
      this.dialog = this.shadowRoot.querySelector('dialog');
      this.revision = 0; this.busy = false;
      this.$('close').onclick = () => this.dialog.close();
      this.dialog.addEventListener('close', () => { this.revision++; this.$('code').value = ''; });
      this.$('generate').onclick = () => this.generate();
      this.$('copy').onclick = async () => {
        try { await navigator.clipboard.writeText(this.$('code').value); this.$('message').textContent = 'Código copiado.'; }
        catch { this.$('code').focus(); this.$('code').select(); this.$('message').textContent = 'Selecione e copie o código acima.'; }
      };
    }
    open(vehicle) {
      this.revision++; this.vehicle = vehicle;
      this.$('vehicle').textContent = `${vehicle.marca} ${vehicle.modelo} — ${vehicle.placa}`;
      this.$('message').textContent = ''; this.$('message').className = '';
      this.$('result').hidden = true; this.$('code').value = '';
      this.dialog.showModal();
    }
    disconnectedCallback() { this.revision++; this.dialog.close(); }
    async generate() {
      if (this.busy) return;
      this.busy = true; const current = ++this.revision;
      this.$('generate').disabled = true; this.$('result').hidden = true; this.$('code').value = '';
      this.$('message').className = ''; this.$('message').textContent = 'Gerando código…';
      try {
        if (!this.service) throw Error('Atualize a página e tente novamente.');
        const result = await this.service.issueWorkshopLink(this.vehicle.id);
        if (current !== this.revision || !this.dialog.open) return;
        this.$('code').value = result.code;
        this.$('expiry').textContent = `Válido até ${new Date(result.expires_at).toLocaleTimeString('pt-BR')}.`;
        this.$('result').hidden = false; this.$('message').textContent = 'Código gerado. Compartilhe com a oficina escolhida.';
      } catch (error) {
        if (current !== this.revision || !this.dialog.open) return;
        this.$('message').className = 'error';
        this.$('message').textContent = /issue_vehicle_workshop_link/.test(error?.message || '')
          ? 'O vínculo ainda precisa ser ativado pelo responsável do AutoFlow.' : vehicleError(error);
      } finally { this.busy = false; this.$('generate').disabled = false; }
    }
  }
  customElements.define('autoflow-vehicle-link', VehicleLink);
}
