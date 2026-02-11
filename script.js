const SUPABASE_URL = "https://owfpyuwxpbfhdysokqwc.supabase.co";
const SUPABASE_KEY = "SUA_CHAVE_AQUI";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function agendar() {
  const nome = document.getElementById("nome").value;
  const telefone = document.getElementById("telefone").value;
  const data = document.getElementById("data").value;
  const hora = document.getElementById("hora").value;

  if (!nome || !data || !hora) {
    alert("Preencha todos os campos");
    return;
  }

  // 🔒 Verificar se já existe agendamento nesse horário
  const { data: existente } = await supabaseClient
    .from("agendamentos")
    .select("*")
    .eq("data", data)
    .eq("hora", hora);

  if (existente.length > 0) {
    alert("Horário já agendado!");
    return;
  }

  const { error } = await supabaseClient
    .from("agendamentos")
    .insert([{ nome, telefone, data, hora }]);

  if (error) {
    alert("Erro ao salvar");
    return;
  }

  alert("Agendamento confirmado!");

  // 📲 WhatsApp automático (abre mensagem pronta)
  const mensagem = `Olá ${nome}, seu agendamento foi confirmado para ${data} às ${hora}`;
  const link = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
  window.open(link, "_blank");
}

async function listarAdmin() {
  const { data } = await supabaseClient
    .from("agendamentos")
    .select("*")
    .order("data", { ascending: true });

  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  data.forEach(item => {
    lista.innerHTML += `
      <div class="agendamento">
        <strong>${item.nome}</strong><br>
        ${item.data} às ${item.hora}<br>
        <button onclick="cancelar(${item.id})">Cancelar</button>
      </div>
    `;
  });
}

async function cancelar(id) {
  await supabaseClient
    .from("agendamentos")
    .delete()
    .eq("id", id);

  alert("Agendamento cancelado");
  listarAdmin();
}
