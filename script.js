const supabase = window.supabase.createClient(
  "SUA_URL_SUPABASE",
  "SUA_CHAVE_PUBLICA"
);

async function agendar() {

  const nome = document.getElementById("nome").value;
  const contato = document.getElementById("contato").value;
  const data = document.getElementById("data").value;
  const hora = document.getElementById("hora").value;

  if (!nome || !data || !hora) {
    document.getElementById("mensagem").innerText = "Preencha todos os campos!";
    return;
  }

  const { error } = await supabase
    .from("agendamentos")
    .insert([
      { nome, contato, data, hora }
    ]);

  if (error) {
    document.getElementById("mensagem").innerText = "Erro ao salvar!";
    console.log(error);
  } else {
    document.getElementById("mensagem").innerText = "Agendamento realizado com sucesso!";
    limparCampos();
    carregarAgendamentos();
  }
}

function limparCampos() {
  document.getElementById("nome").value = "";
  document.getElementById("contato").value = "";
  document.getElementById("data").value = "";
  document.getElementById("hora").value = "";
}

async function carregarAgendamentos() {

  const { data, error } = await supabase
    .from("agendamentos")
    .select("*")
    .order("data", { ascending: true });

  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  if (error) {
    lista.innerHTML = "Erro ao carregar dados.";
    console.log(error);
    return;
  }

  if (data.length === 0) {
    lista.innerHTML = "Nenhum agendamento encontrado.";
    return;
  }

  data.forEach(item => {
    lista.innerHTML += `
      <div class="item">
        <strong>${item.nome}</strong><br>
        📅 ${item.data} ⏰ ${item.hora}<br>
        📱 ${item.contato || "-"}
      </div>
    `;
  });
}

window.onload = carregarAgendamentos;
