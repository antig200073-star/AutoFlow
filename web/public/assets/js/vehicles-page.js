import {createVehicleService,vehicleError,vehicleRemovalPrompt,vehicleRemovalError} from './vehicle-service.js';
import './vehicle-registration.js';
import './vehicle-link.js';

const list=document.getElementById('vehicle-list');
const message=document.getElementById('vehicles-message');
const registration=document.querySelector('autoflow-vehicle-registration');
const workshopLink=document.querySelector('autoflow-vehicle-link');
const historyDialog=document.getElementById('vehicle-history-dialog');
const historyTitle=document.getElementById('vehicle-history-title');
const historyMessage=document.getElementById('vehicle-history-message');
const historyList=document.getElementById('vehicle-history-list');
let historyRequest=0;
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;};
let vehicles=[];
let revision=0;
let removing=false;
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
    const remove=node('button','Excluir veículo','af-delete-vehicle');
    remove.type='button';remove.disabled=removing;
    remove.setAttribute('aria-label',`Excluir veículo ${vehicle.placa}`);
    remove.onclick=()=>removeVehicle(vehicle);
    const history=node('button','Histórico de manutenção','af-history-button');
    history.type='button';history.disabled=removing;
    history.setAttribute('aria-label',`Ver histórico de manutenção do veículo ${vehicle.placa}`);
    history.onclick=()=>openHistory(vehicle);
    const actions=node('div',null,'af-vehicle-actions');
    const link=node('button','Vincular à oficina','af-history-button');
    link.type='button'; link.onclick=()=>workshopLink.open(vehicle);
    actions.append(link,history,remove);
    body.append(dl,actions);card.append(body);list.append(card);
  }
}
const HISTORY_STATUSES = {
  aguardando:'Aguardando Peças',
  em_analise:'Em Diagnóstico',
  em_manutencao:'Em Manutenção',
  pronto:'Pronto para Retirada',
  entregue:'Entregue',
};
function displayDate(value) {
  if(!value)return 'Não informada';
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?'Não informada':
    new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(parsed);
}
function closeHistory() {
  historyRequest++;
  if(historyDialog.open)historyDialog.close();
}
document.getElementById('close-vehicle-history').addEventListener('click',closeHistory);
historyDialog.addEventListener('close',()=>{historyRequest++;});
async function openHistory(vehicle) {
  if(!registration?.service) {
    message.textContent='Não foi possível consultar o histórico. Atualize a página.';
    message.classList.add('error');
    return;
  }
  const current=++historyRequest;
  historyTitle.textContent=`Histórico de manutenção — ${vehicle.marca} ${vehicle.modelo} (${vehicle.placa})`;
  historyMessage.textContent='Consultando ordens de serviço…';
  historyList.replaceChildren();
  if(!historyDialog.open)historyDialog.showModal();
  try {
    const orders=await registration.service.history(vehicle.id);
    if(current!==historyRequest || !historyDialog.open)return;
    historyMessage.textContent=orders.length?`${orders.length} ordem(ns) de serviço encontrada(s).`:'Nenhuma manutenção registrada para este veículo.';
    historyList.replaceChildren();
    for(const order of orders) {
      const card=node('article',null,'af-history-item');
      card.append(
        node('h3',`O.S. nº ${order.id} — ${HISTORY_STATUSES[order.status] || order.status || 'Status não informado'}`),
        node('p',`Oficina: ${order.oficina}`),
        node('p',`Serviço / defeito: ${order.problema || 'Não informado'}`),
        node('p',`Entrada: ${displayDate(order.entrada)}`),
      );
      if(order.saida)card.append(node('p',`Saída: ${displayDate(order.saida)}`));
      card.append(node('small',order.status==='entregue'?'Manutenção entregue':'Manutenção em acompanhamento'));
      historyList.append(card);
    }
  } catch(error) {
    if(current!==historyRequest || !historyDialog.open)return;
    console.error('AutoFlow - histórico do veículo:',error);
    historyMessage.textContent=vehicleError(error);
    historyList.replaceChildren();
  }
}
async function removeVehicle(vehicle) {
  if(removing || !window.confirm(vehicleRemovalPrompt(vehicle)))return;
  removing=true;revision++;render();
  document.getElementById('reload-vehicles').disabled=true;
  message.classList.remove('error');message.textContent='Excluindo veículo…';
  try {
    await registration.service.remove(vehicle.id);
    vehicles=vehicles.filter(v=>v.id!==vehicle.id);
    message.textContent='Veículo excluído da sua lista. Histórico preservado.';
  } catch(error) {message.textContent=vehicleRemovalError(error);message.classList.add('error');}
  finally {removing=false;revision++;render();document.getElementById('reload-vehicles').disabled=false;}
}
async function load() {
  if(removing)return;
  const current=++revision;
  message.textContent='';message.classList.remove('error');
  list.replaceChildren(node('p','Carregando veículos…','empty-state'));
  try {const result=await registration.service.list();if(current!==revision)return;vehicles=result;render();}
  catch(error){if(current!==revision)return;list.replaceChildren();message.textContent=vehicleError(error);message.classList.add('error');}
}
const addButton = document.getElementById('add-vehicle');
const reloadButton = document.getElementById('reload-vehicles');
function showError(error) {
  console.error('AutoFlow - cadastro de veículos:', error);
  message.textContent = error instanceof Error ? vehicleError(error) : String(error);
  message.classList.add('error');
}
if(window.AutoFlowSupabase && registration && typeof registration.open === 'function') {
  registration.service=createVehicleService(window.AutoFlowSupabase);
  workshopLink.service=registration.service;
  addButton.addEventListener('click',()=>{
    try {
      message.textContent='';message.classList.remove('error');
      registration.open();
    } catch(error) {showError(error);}
  });
  reloadButton.addEventListener('click',()=>load());
  registration.addEventListener('vehicle-saved',event=>{
    revision++;
    vehicles=[event.detail,...vehicles.filter(v=>v.id!==event.detail.id)];render();
    message.classList.remove('error');message.textContent='Veículo cadastrado com sucesso!';
  });
  load();
}else {
  addButton.addEventListener('click',()=>{
    message.textContent='O cadastro de veículos não foi carregado. Verifique a conexão e atualize a página.';
    message.classList.add('error');
  });
  reloadButton.addEventListener('click',()=>window.location.reload());
  message.textContent='Falha ao iniciar o formulário de veículos. Atualize a página ou verifique o console do navegador.';
  message.classList.add('error');
}
