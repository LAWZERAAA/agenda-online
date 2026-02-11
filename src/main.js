import { supabase } from './supabase.js';

// ------------------------
// Config do App
// ------------------------
const telefoneWhatsApp = "5519992880591"; // Admin (DDI + DDD + número)
const START_DAY_MIN = 8 * 60;
const END_DAY_MIN   = 17 * 60;
const SLOT_MIN      = 60;

const servicos = [
  { id: "estetica_pes",       nome: "Estética dos Pés",         precoTexto: "R$ 40,00",              duracao: 60 },
  { id: "estetica_maos",      nome: "Estética das Mãos",        precoTexto: "R$ 35,00",              duracao: 60 },
  { id: "podologia_completa", nome: "Podologia Completa",       precoTexto: "a partir de R$ 100,00", duracao: 60 },
  { id: "plastica_pes",       nome: "Plástica dos Pés",         precoTexto: "R$ 80,00",              duracao: 60 }
];

let adminLogado = false;
let cacheAgenda = [];
let agendaChannel;

// ------------------------
// Utils
// ------------------------
function parseDateLocal(dateStr){
  const [y,m,d] = (dateStr||"").split("-").map(Number);
  if(!y || !m || !d) return null;
  return new Date(y, m-1, d, 0, 0, 0, 0);
}
function hhmmParaMinutos(hhmm){ const [h,m] = (hhmm||"").split(":").map(Number); return (isNaN(h)||isNaN(m)) ? NaN : h*60+m; }
function minutosParaHHMM(min){ if (typeof min !== "number" || isNaN(min)) return ""; const h = String(Math.floor(min/60)).padStart(2,"0"); const m = String(min%60).padStart(2,"0"); return `${h}:${m}`; }
function intervalosSobrepoem(aInicio, aDur, bInicio, bDur){ if([aInicio,aDur,bInicio,bDur].some(v => typeof v!=="number"||isNaN(v))) return false; return (aInicio < bInicio+bDur) && (bInicio < aInicio+aDur); }
function toDateInputValue(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }
function soDigitos(s){ return (s||"").replace(/\D/g,""); }
function isSunday(dateStr){ const dt=parseDateLocal(dateStr); if(!dt) return false; return dt.getDay()===0; }
function isPastDate(dateStr){ const hoje=new Date(); hoje.setHours(0,0,0,0); const d=parseDateLocal(dateStr); if(!d) return false; return d < hoje; }
function isPastTimeOnDate(dateStr,hhmm){
  const dt = parseDateLocal(dateStr);
  if(!dt || !hhmm) return false;
  const [h,m] = hhmm.split(":").map(Number);
  dt.setHours(h||0, m||0, 0, 0); // local
  return dt <= new Date();
}
function isToday(dateStr){ const dt=parseDateLocal(dateStr); if(!dt) return false; return toDateInputValue(dt) === toDateInputValue(new Date()); }
function orderByDataHora(a,b){ const ka = `${a.data||"9999-99-99"} ${a.hora||"99:99"}`; const kb = `${b.data||"9999-99-99"} ${b.hora||"99:99"}`; return ka.localeCompare(kb); }
const horariosBase = (()=>{ const a=[]; for(let m=START_DAY_MIN; m + SLOT_MIN <= END_DAY_MIN; m+=SLOT_MIN){ a.push(minutosParaHHMM(m)); } return a; })();

function abrirWhatsApp(url){ try{ window.location.href=url; }catch(e){ window.open(url,"_blank"); } }

// ------------------------
// UI Setup
// ------------------------
function popularServicos(){
  const sel = document.getElementById("servico");
  sel.innerHTML = `<option value="" disabled selected>Selecione o serviço</option>`;
  servicos.forEach(s=>{
    const op=document.createElement("option");
    op.value=s.id; op.textContent=`${s.nome} — ${s.precoTexto} (${s.duracao/60}h)`;
    sel.appendChild(op);
  });
  sel.onchange = ()=>{
    const horaSel = document.getElementById("hora");
    if (horaSel) { horaSel.innerHTML = ""; horaSel.disabled = true; }
    const msg = document.getElementById("msgHorarios");
    if (msg) msg.textContent = "Selecione data e serviço.";
    atualizarHorarios();
  };
}

// ------------------------
// Supabase — Realtime + Listagem
// ------------------------
async function carregarAgenda(){
  const { data, error } = await supabase
    .from('agendamentos')
    .select('*')
    .order('data', { ascending:true })
    .order('hora', { ascending:true });

  if (error) {
    console.error('Erro ao carregar agenda:', error);
    return;
  }
  cacheAgenda = data || [];
  mostrarAgenda();
  if (adminLogado) renderAdminList();
}

function subscribeAgenda(){
  if (agendaChannel) supabase.removeChannel(agendaChannel);
  agendaChannel = supabase
    .channel('public:agendamentos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, async () => {
      await carregarAgenda();
    })
    .subscribe();
}

// ------------------------
// Cliente — horários e agenda
// ------------------------
async function atualizarHorarios(){
  const dataSel = document.getElementById("data")?.value;
  const servicoID = document.getElementById("servico")?.value;
  const horaSel = document.getElementById("hora");
  const msg = document.getElementById("msgHorarios");

  if(!horaSel || !msg) return;

  horaSel.innerHTML = "";
  horaSel.disabled = true;

  if(!dataSel || !servicoID){
    msg.textContent = "Selecione data e serviço.";
    return;
  }
  if(isPastDate(dataSel)){
    msg.textContent = "Data já passou. Escolha outra.";
    return;
  }
  if(isSunday(dataSel)){
    msg.textContent = "Domingo indisponível. Escolha outro dia.";
    return;
  }

  msg.textContent = "Carregando horários…";
  const servico = servicos.find(s=>s.id===servicoID);
  if(!servico){
    msg.textContent="Serviço inválido. Escolha novamente.";
    return;
  }

  // Busca ocupados no dia
  const { data: ocupadosData, error } = await supabase
    .from('agendamentos')
    .select('hora, duracao_minutes')
    .eq('data', dataSel);

  if (error) {
    console.error('Erro ao obter ocupados:', error);
  }

  const ocupados = (ocupadosData || []).map(r => ({
    inicio: hhmmParaMinutos((r.hora || '').slice(0,5)), // time vem como 'HH:MM:SS'
    dur: r.duracao_minutes || 60
  }));

  const sameDay = isToday(dataSel);
  let disponiveis=0;

  for(const hr of horariosBase){
    if(sameDay && isPastTimeOnDate(dataSel, hr)) continue;

    const inicio = hhmmParaMinutos(hr);
    const conflita = ocupados.some(o=>intervalosSobrepoem(inicio, servico.duracao, o.inicio, o.dur));
    if(!conflita){
      const op=document.createElement("option");
      op.value=hr; op.textContent=hr;
      horaSel.appendChild(op);
      disponiveis++;
    }
  }

  if(disponiveis>0){
    msg.textContent = "Horários disponíveis:";
    horaSel.disabled = false;
  }else{
    msg.textContent = "Nenhum horário disponível nesta data.";
    const op=document.createElement("option");
    op.value=""; op.textContent="— sem horários —"; op.disabled=true; op.selected=true;
    horaSel.appendChild(op);
  }
}

async function agendar(){
  const nome = (document.getElementById("nome").value||"").trim();
  const contatoRaw = (document.getElementById("contato").value||"").trim();
  const dataSel = document.getElementById("data").value;
  const horaSel = document.getElementById("hora").value;
  const servicoID = document.getElementById("servico").value;

  if(!nome || !contatoRaw || !dataSel || !horaSel || !servicoID){ alert("Preencha todos os campos."); return; }
  if(isPastDate(dataSel)){ alert("Data já passou."); return; }
  if(isSunday(dataSel)){ alert("Domingo indisponível."); return; }
  if(isToday(dataSel) && isPastTimeOnDate(dataSel,horaSel)){ alert("Horário já passou."); return; }

  const servico = servicos.find(s=>s.id===servicoID);
  if(!servico){ alert("Serviço inválido."); return; }

  // Confirma conflito
  const { data: existentes, error } = await supabase
    .from('agendamentos')
    .select('hora, duracao_minutes')
    .eq('data', dataSel);
  if (error) { alert('Não foi possível verificar conflitos agora.'); return; }

  const inicio = hhmmParaMinutos(horaSel);
  const conflita = (existentes||[]).some(x => {
    const aIni = inicio;
    const aDur = servico.duracao;
    const bIni = hhmmParaMinutos((x.hora || '').slice(0,5));
    const bDur = x.duracao_minutes || 60;
    return intervalosSobrepoem(aIni, aDur, bIni, bDur);
  });
  if(conflita){ alert("Conflito de horário. Escolha outro horário."); atualizarHorarios(); return; }

  const contato = soDigitos(contatoRaw);

  // created_by (se admin logado)
  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData?.user?.id ?? null;

  const registro = {
    nome,
    contato,
    data: dataSel,
    hora: `${horaSel}:00`,
    duracao_minutes: servico.duracao,
    servico: servico.nome,
    preco_texto: servico.precoTexto,
    created_by: createdBy
  };

  const { error: errIns } = await supabase.from('agendamentos').insert(registro);
  if (errIns) {
    console.error("Erro ao salvar agendamento:", errIns);
    alert("Não foi possível salvar o agendamento agora. Tente novamente.");
    return;
  }

  const success=document.getElementById("sucesso");
  if(success){ success.style.display="block"; setTimeout(()=>success.style.display="none",3000); }

  await atualizarHorarios();
  await carregarAgenda();

  const msg =
`Olá! 💅
Novo agendamento:

👤 ${nome}
💬 Contato: +55 ${contato}
💆 ${servico.nome}
💵 ${servico.precoTexto}
⏱️ ${servico.duracao/60}h
📅 ${dataSel}
⏰ ${horaSel}`;
  abrirWhatsApp(`https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(msg)}`);
}

function mostrarAgenda(){
  const wrap=document.getElementById("agenda");
  const agenda=cacheAgenda.slice().sort(orderByDataHora);

  wrap.innerHTML="";
  if(agenda.length===0){ wrap.innerHTML=`<div class="muted">Nenhum agendamento encontrado.</div>`; return; }

  wrap.innerHTML += `<div class="muted" style="margin-bottom:8px">${agenda.length} agendamento(s)</div>`;
  agenda.forEach(a=>{
    wrap.innerHTML += `
      <div class="item">
        <strong>${a.nome}</strong><br/>
        ${a.servico} — ${a.preco_texto}<br/>
        WhatsApp: +55 ${a.contato}<br/>
        ${a.data} às ${(a.hora || '').slice(0,5)}<br/>
      </div>`;
  });
}

// ------------------------
// Admin — Login por e-mail OU usuário
// ------------------------
function isEmail(v){ return (v||"").includes('@'); }

async function resolveEmailFromIdentifier(identifier){
  const id = (identifier||"").trim().toLowerCase();
  if (!id) throw new Error('Identificador vazio');
  if (isEmail(id)) return id;

  const { data, error } = await supabase.rpc('get_email_by_username', { p_username: id });
  if (error || !data) throw new Error('Usuário inexistente');
  return String(data).trim().toLowerCase();
}

async function loginAdmin(){
  const identifier = (document.getElementById("adminUser")?.value||"").trim();
  const pass       = (document.getElementById("adminPass")?.value||"").trim();
  if(!identifier || !pass){ alert("Informe identificador (e-mail ou usuário) e senha."); return; }

  try{
    const email = await resolveEmailFromIdentifier(identifier);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  }catch(e){
    console.error('Login falhou:', e);
    alert('Credenciais incorretas ou usuário inexistente.');
  }
}

async function logoutAdmin(){
  await supabase.auth.signOut();
}

function onAuthChanged(session){
  adminLogado = !!session?.user;
  const loginBox = document.getElementById("adminLogin");
  const adminArea = document.getElementById("adminArea");

  if(adminLogado){
    if(loginBox) loginBox.style.display="none";
    if(adminArea) adminArea.style.display="block";
    renderAdminList();
  }else{
    if(adminArea) adminArea.style.display="none";
    if(loginBox) loginBox.style.display="none";
  }
}

function statusBadge(item){
  const hoje = toDateInputValue(new Date());
  const hhmm = (item.hora || '').slice(0,5);
  if(item.data < hoje) return {cls:"past", txt:"Passado"};
  if(item.data > hoje) return {cls:"future", txt:"Futuro"};
  return isPastTimeOnDate(item.data, hhmm) ? {cls:"past",txt:"Passado"} : {cls:"today",txt:"Hoje"};
}

function formatarDataBr(yyyyMMdd){
  const dt = parseDateLocal(yyyyMMdd);
  if(!dt) return yyyyMMdd||"-";
  const semana = dt.toLocaleDateString('pt-BR', { weekday:'long' });
  const dia    = String(dt.getDate()).padStart(2,"0");
  const mes    = dt.toLocaleDateString('pt-BR', { month:'long' });
  const ano    = dt.getFullYear();
  return `${semana}, ${dia} de ${mes} de ${ano}`;
}

async function cancelarAdminById(id){
  if(!confirm("Deseja cancelar este horário?")) return;
  const { error } = await supabase.from('agendamentos').delete().eq('id', id);
  if (error) {
    console.error("Erro ao cancelar (admin):", error);
    alert("Não foi possível cancelar. Verifique se sua conta é admin.");
    return;
  }
  // Opcional: enviar WhatsApp ao cliente (se ainda nos dados locais)
  try{
    const item = cacheAgenda.find(x => x.id === id);
    if(item){
      const msgCliente =
`Olá ${item.nome}! ❌
Seu agendamento foi cancelado pelo administrador.
${item.servico}
📅 ${item.data} ⏰ ${(item.hora || '').slice(0,5)}

Se quiser remarcar, é só responder esta mensagem.`;
      const foneCliente = `55${soDigitos(item.contato)}`;
      if(foneCliente.length>=12){
        abrirWhatsApp(`https://wa.me/${foneCliente}?text=${encodeURIComponent(msgCliente)}`);
      }
    }
  }catch(_){}
}

function renderAdminList(){
  const wrap = document.getElementById("adminList");
  const countEl = document.getElementById("adminCount");
  const agenda = cacheAgenda.slice().sort(orderByDataHora);

  wrap.innerHTML="";
  if(countEl) countEl.textContent=`${agenda.length} registro(s)`;
  if(agenda.length===0){ wrap.innerHTML=`<div class="muted">Nenhum agendamento encontrado.</div>`; return; }

  let atual=""; let grupoEl=null;
  agenda.forEach(item=>{
    if(item.data !== atual){
      atual=item.data;
      grupoEl=document.createElement("div");
      grupoEl.className="date-group";
      grupoEl.innerHTML=`
        <div class="group-header">
          <div class="group-title">${formatarDataBr(atual)}</div>
          <div class="group-count"></div>
        </div>`;
      wrap.appendChild(grupoEl);
    }
    const badge = statusBadge(item);
    const row=document.createElement("div");
    row.className="admin-item";
    row.innerHTML=`
      <div class="slot">
        <div class="time">
          <span class="chip">${(item.hora || '').slice(0,5)}</span>
          <span class="badge ${badge.cls}">${badge.txt}</span>
        </div>
      </div>
      <div class="details">
        <div><strong>${item.servico}</strong> — <span class="muted">${item.preco_texto}</span></div>
        <div>Cliente: <strong>${item.nome}</strong></div>
        <div>WhatsApp: +55 ${item.contato || '-'}</div>
      </div>
      <div class="actions">
        <button class="btn-danger" data-del="${item.id}">Cancelar</button>
      </div>`;
    grupoEl.appendChild(row);
  });

  // Contagem por grupo
  [...wrap.querySelectorAll(".date-group")].forEach(group=>{
    const items = group.querySelectorAll(".admin-item").length;
    const el = group.querySelector(".group-count");
    if(el) el.textContent = `${items} agendamento(s)`;
  });

  // Bind dos botões de cancelamento
  wrap.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const id = e.currentTarget.getAttribute('data-del');
      await cancelarAdminById(id);
    });
  });
}

// ------------------------
// Inicialização
// ------------------------
window.addEventListener('DOMContentLoaded', async ()=>{
  // Data mínima = hoje
  const dataEl = document.getElementById("data");
  if (dataEl) dataEl.min = toDateInputValue(new Date());

  // Desabilita horários no carregamento
  const horaSel = document.getElementById("hora");
  if (horaSel) { horaSel.innerHTML = ""; horaSel.disabled = true; }

  popularServicos();

  const msg = document.getElementById("msgHorarios");
  if (msg) msg.textContent = "Selecione data e serviço.";

  // Eventos
  document.getElementById('data')?.addEventListener('change', atualizarHorarios);
  document.getElementById('btnAgendar')?.addEventListener('click', agendar);
  document.getElementById('btnMostrarLogin')?.addEventListener('click', ()=>{
    const loginBox = document.getElementById("adminLogin");
    const adminArea = document.getElementById("adminArea");
    if(adminArea && adminArea.style.display === "block") return;
    if(loginBox) loginBox.style.display="block";
    document.getElementById("adminUser")?.focus();
  });
  document.getElementById('btnLogin')?.addEventListener('click', loginAdmin);
  document.getElementById('btnLogout')?.addEventListener('click', logoutAdmin);

  // Auth listener
  supabase.auth.onAuthStateChange((_event, session) => {
    onAuthChanged(session);
  });

  // Carga inicial + realtime
  await carregarAgenda();
  subscribeAgenda();
});