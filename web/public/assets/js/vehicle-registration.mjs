import { vehicleError } from './vehicle-service.mjs';

// Componente compartilhado: mesma câmera, validação e janela no HTML e React.
if (globalThis.customElements && !customElements.get('autoflow-vehicle-registration')) {
  class VehicleRegistration extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({mode:'open'});
      this.shadowRoot.innerHTML = `
        <style>
          :host { font-family: 'Inter','Segoe UI',Arial,sans-serif; color:#16181d; }
          * { box-sizing:border-box; } [hidden] { display:none !important; }
          dialog { color:#16181d; background:#fff; border:1px solid #d7dbe0; border-radius:18px; padding:0; width:min(720px,calc(100% - 24px)); max-height:calc(100dvh - 32px); box-shadow:0 24px 80px #0005; }
          dialog::backdrop { background:#10141bbb; }
          header { padding:24px 28px 18px; border-top:5px solid #c62828; border-bottom:1px solid #e5e7eb; display:flex; align-items:start; justify-content:space-between; gap:16px; }
          .eyebrow { color:#a61f1f; font-size:11px; font-weight:700; letter-spacing:1.5px; margin:0 0 8px; }
          h2 { margin:0; font-size:25px; letter-spacing:-.5px; } p { line-height:1.5; }
          header p:last-child { margin:8px 0 0; color:#586171; font-size:14px; }
          .content { padding:22px 28px 26px; }
          .photo { background:#f3f4f6; border:1px dashed #bec5cf; border-radius:12px; padding:16px; text-align:center; }
          video,img { width:100%; aspect-ratio:16/9; object-fit:contain; background:#16181d; border-radius:8px; display:block; max-height:270px; margin-bottom:14px; }
          .empty-photo { padding:16px; } .empty-photo svg { width:44px; height:44px; color:#a61f1f; }
          .empty-photo p { margin:8px 0; font-size:14px; color:#586171; }
          .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:22px; }
          label { display:block; font-size:14px; font-weight:600; margin-bottom:7px; }
          input { width:100%; min-width:0; font:inherit; font-size:16px; min-height:46px; padding:11px 12px; border:1px solid #bfc5ce; border-radius:8px; background:white; color:#16181d; }
          .wide { grid-column:1/-1; } .hint { margin:8px 0 0; font-size:12px; color:#586171; }
          .actions { display:flex; justify-content:end; gap:10px; margin-top:24px; }
          button { cursor:pointer; font:inherit; font-size:14px; font-weight:650; min-height:44px; padding:11px 18px; border:1px solid transparent; border-radius:8px; background:#c62828; color:white; }
          button:hover { background:#a61f1f; } .secondary { color:#16181d; background:white; border-color:#bfc5ce; } .secondary:hover { background:#e9ecf0; }
          .close { padding:8px; min-width:44px; font-size:22px; background:transparent; color:#586171; }
          button:disabled { cursor:default; opacity:.55; } fieldset { border:0; padding:0; margin:0; min-width:0; }
          #message:not(:empty) { padding:12px; background:#fbeaea; color:#8f1d1d; border-radius:8px; margin:16px 0 0; font-size:14px; }
          :focus-visible { outline:3px solid #2058a5; outline-offset:3px; }
          @media(max-width:520px) { header { padding:20px 18px 16px; } .content { padding:18px; } h2 { font-size:22px; } .grid { grid-template-columns:1fr; gap:14px; } .actions button { flex:1; } dialog { max-height:calc(100dvh - 16px); } }
          @media(prefers-reduced-motion:no-preference) { dialog[open] { animation:appear .15s ease-out; } @keyframes appear { from { opacity:0; transform:translateY(8px); } } }
        </style>
        <dialog aria-labelledby="title" aria-describedby="description">
          <header><div><p class="eyebrow">MINHA GARAGEM</p><h2 id="title">Cadastrar veículo</h2><p id="description">Tire uma foto e preencha os dados do seu veículo.</p></div><button class="close" id="close" type="button" aria-label="Fechar cadastro">×</button></header>
          <div class="content">
            <form id="form">
              <fieldset id="fields">
                <section class="photo" aria-label="Foto do veículo">
                  <div id="empty" class="empty-photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h4l2-3h6l2 3h4v14H3z"/><circle cx="12" cy="12" r="4"/></svg><p>Fotografe o veículo por fora, em um local bem iluminado.</p></div>
                  <video id="camera" muted playsinline autoplay hidden aria-label="Prévia da câmera"></video>
                  <img id="preview" alt="Foto capturada do seu veículo" hidden>
                  <button id="start" class="secondary" type="button">Abrir câmera</button>
                  <button id="shoot" type="button" hidden>Tirar foto</button>
                  <p class="hint">A foto é obrigatória. Você pode refazê-la antes de salvar.</p>
                </section>
                <div class="grid">
                  <div><label for="plate">Placa</label><input id="plate" name="placa" placeholder="ABC1D23" maxlength="8" autocomplete="off" autocapitalize="characters" required></div>
                  <div><label for="brand">Marca</label><input id="brand" name="marca" placeholder="Ex.: Chevrolet" maxlength="80" required></div>
                  <div class="wide"><label for="model">Modelo</label><input id="model" name="modelo" placeholder="Ex.: Onix 1.0" maxlength="120" required></div>
                  <div><label for="year">Ano do modelo</label><input id="year" name="ano" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear()+1}" step="1" placeholder="2022" required></div>
                  <div><label for="km">Quilometragem atual (km)</label><input id="km" name="km_atual" type="number" inputmode="numeric" min="0" max="999999999" step="1" placeholder="45000" required></div>
                </div>
              </fieldset>
              <p id="message" role="status" aria-live="polite"></p>
              <div class="actions"><button id="cancel" class="secondary" type="button">Cancelar</button><button id="save" type="submit">Salvar veículo</button></div>
            </form>
          </div>
        </dialog>`;
      this.$ = id => this.shadowRoot.getElementById(id);
      this.dialog = this.shadowRoot.querySelector('dialog');
      this.busy=false; this.cameraGeneration=0;
      this.$('close').onclick=this.$('cancel').onclick=()=>this.close();
      this.$('start').onclick=()=>this.startCamera();
      this.$('shoot').onclick=()=>this.takePhoto();
      this.$('plate').oninput=()=>{ this.$('plate').value=this.$('plate').value.toUpperCase(); };
      this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
      this.dialog.addEventListener('close',()=>this.stopCamera());
      this.$('form').onsubmit=event=>{event.preventDefault();this.save();};
    }
    open() {
      if (this.dialog.open) return;
      this.$('form').reset(); this.$('message').textContent=''; this.resetPhoto();
      this.dialog.showModal();
    }
    close() {
      if (this.busy) return;
      this.stopCamera(); this.dialog.close();
      const discarded=this.capture;this.capture=null;
      this.service?.discard(discarded);
      this.resetPhoto();
    }
    disconnectedCallback() {
      this.stopCamera();
      if (!this.busy) this.service?.discard(this.capture);
      if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    }
    stopCamera() {
      this.cameraGeneration++;
      this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
      this.$('camera').srcObject=null;
      this.$('camera').hidden=true;this.$('shoot').hidden=true;this.$('start').hidden=false;
      this.$('start').disabled=false;
    }
    resetPhoto() {
      if(this.previewUrl) URL.revokeObjectURL(this.previewUrl);
      this.previewUrl=null;this.capture=null;
      this.$('preview').hidden=true;this.$('preview').removeAttribute('src');
      this.$('empty').hidden=false;this.$('start').textContent='Abrir câmera';
    }
    async startCamera() {
      this.stopCamera();
      const generation=this.cameraGeneration;
      this.$('message').textContent='';this.$('start').disabled=true;
      if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        this.$('message').textContent='A câmera precisa de HTTPS (ou localhost no computador). Abra o AutoFlow por uma conexão segura e permita o uso da câmera.';
        this.$('start').disabled=false;return;
      }
      try {
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
        if(generation!==this.cameraGeneration || !this.dialog.open || !this.isConnected) {stream.getTracks().forEach(track=>track.stop());return;}
        this.stream=stream;
        this.$('camera').srcObject=stream;
        this.$('camera').hidden=false;this.$('empty').hidden=true;this.$('preview').hidden=true;
        await this.$('camera').play();
        if(generation!==this.cameraGeneration || !this.dialog.open)return;
        this.$('start').hidden=true;this.$('shoot').hidden=false;
      } catch(error) {
        if(generation!==this.cameraGeneration)return;
        this.stopCamera();
        this.$('preview').hidden=!this.capture;this.$('empty').hidden=!!this.capture;
        this.$('message').textContent=error.name==='NotAllowedError'
          ? 'Permita o acesso à câmera nas configurações do navegador e tente novamente.'
          : error.name==='NotFoundError' ? 'Nenhuma câmera foi encontrada. Use um celular ou computador com câmera.'
          : 'Não foi possível abrir a câmera. Feche outros aplicativos que estejam usando a câmera e tente novamente.';
      } finally { this.$('start').disabled=false; }
    }
    async takePhoto() {
      const video=this.$('camera');
      if(!video.videoWidth || !video.videoHeight) {this.$('message').textContent='Aguarde a imagem da câmera aparecer.';return;}
      this.$('shoot').disabled=true;
      const generation=this.cameraGeneration;
      try {
        const canvas=document.createElement('canvas');
        const ratio=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
        canvas.width=Math.round(video.videoWidth*ratio);canvas.height=Math.round(video.videoHeight*ratio);
        canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
        if(generation!==this.cameraGeneration || !this.dialog.open)return;
        if(!blob)throw Error('Não foi possível capturar a foto. Tente novamente.');
        const discarded=this.capture;this.service?.discard(discarded);
        if(this.previewUrl)URL.revokeObjectURL(this.previewUrl);
        this.capture={blob};this.previewUrl=URL.createObjectURL(blob);
        this.$('preview').src=this.previewUrl;this.$('preview').hidden=false;
        this.$('start').textContent='Refazer foto';this.$('message').textContent='';
        this.stopCamera();this.$('plate').focus();
      } catch(error) {this.$('message').textContent=vehicleError(error);}
      finally {this.$('shoot').disabled=false;}
    }
    async save() {
      if(this.busy)return;
      if(!this.capture) {this.$('message').textContent='Tire uma foto do veículo antes de salvar.';this.$('start').focus();return;}
      if(!this.service) {this.$('message').textContent='Não foi possível conectar. Atualize a página.';return;}
      this.busy=true;this.stopCamera();this.$('message').textContent='Salvando foto e veículo…';
      this.$('fields').disabled=true;
      for(const id of ['close','cancel','save'])this.$(id).disabled=true;
      this.$('save').textContent='Salvando…';
      try {
        const payload={};
        // Fieldset desabilitado não entra em FormData: lê os campos conhecidos.
        for(const name of ['placa','marca','modelo','ano','km_atual'])payload[name]=this.$('form').elements.namedItem(name).value;
        const vehicle=await this.service.create(payload,this.capture);
        this.dialog.close();this.resetPhoto();
        this.dispatchEvent(new CustomEvent('vehicle-saved',{detail:vehicle,bubbles:true,composed:true}));
      } catch(error) {this.$('message').textContent=vehicleError(error);}
      finally {
        this.busy=false;this.$('fields').disabled=false;
        for(const id of ['close','cancel','save'])this.$(id).disabled=false;
        this.$('save').textContent='Salvar veículo';
      }
    }
  }
  customElements.define('autoflow-vehicle-registration',VehicleRegistration);
}
