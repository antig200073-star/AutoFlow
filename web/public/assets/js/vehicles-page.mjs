import {createVehicleService,vehicleError} from './vehicle-service.mjs';
import './vehicle-registration.mjs';

const list=document.getElementById('vehicle-list');
const message=document.getElementById('vehicles-message');
const registration=document.querySelector('autoflow-vehicle-registration');
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;};
let vehicles=[];
let revision=0;
function render() {
  list.replaceChildren();
  if(!vehicles.length){list.append(node('p','Nenhum veículo cadastrado. Use o botão para adicionar seu primeiro veículo.','empty-state'));return;}
  for(const vehicle of vehicles) {
    const card=node('article',null,'af-vehicle-card');
    const placeholder=node('div',vehicle.foto_path?'Foto indisponível. Atualize a lista para tentar novamente.':'Veículo cadastrado sem foto.','af-vehicle-no-photo');
    if(vehicle.photoUrl){const img=node('img');img.src=vehicle.photoUrl;img.alt=`${vehicle.marca} ${vehicle.modelo}`;img.loading='lazy';img.onerror=()=>img.replaceWith(placeholder);card.append(img);}else card.append(placeholder);
    const body=node('div',null,'af-vehicle-body');body.append(node('h3',`${vehicle.marca} ${vehicle.modelo}`.trim()||'Veículo'));
    const dl=node('dl');
    for(const [label,value] of [['Placa',vehicle.placa],['Ano',vehicle.ano??'Não informado'],['Quilometragem',vehicle.km_atual==null?'Não informada':`${Number(vehicle.km_atual).toLocaleString('pt-BR')} km`]]) {
      const item=node('div');item.append(node('dt',label),node('dd',String(value),label==='Placa'?'af-plate':''));dl.append(item);
    }
    body.append(dl);card.append(body);list.append(card);
  }
}
async function load() {
  const current=++revision;
  message.textContent='';message.classList.remove('error');
  list.replaceChildren(node('p','Carregando veículos…','empty-state'));
  try {const result=await registration.service.list();if(current!==revision)return;vehicles=result;render();}
  catch(error){if(current!==revision)return;list.replaceChildren();message.textContent=vehicleError(error);message.classList.add('error');}
}
if(window.AutoFlowSupabase) {
  registration.service=createVehicleService(window.AutoFlowSupabase);
  document.getElementById('add-vehicle').onclick=()=>registration.open();
  document.getElementById('reload-vehicles').onclick=load;
  registration.addEventListener('vehicle-saved',event=>{
    revision++;
    vehicles=[event.detail,...vehicles.filter(v=>v.id!==event.detail.id)];render();
    message.classList.remove('error');message.textContent='Veículo cadastrado com sucesso!';
  });
  load();
}else {message.textContent='Não foi possível conectar. Atualize a página.';message.classList.add('error');}
