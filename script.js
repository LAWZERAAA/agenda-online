const SUPABASE_URL = "https://owfpyuwxpbfhdysokqwc.supabase.co";
const SUPABASE_KEY = "sb_publishable_RC2UVIHXkvrbur2BRN2IXg_p6lQ99rZ";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function agendar() {
  const nome = document.getElementById("nome").value;
  const email = document.getElementById("email").value;
  const data = document.getElementById("data").value;
  const hora = document.getElementById("hora").value;

  if (!nome || !data || !hora) {
    alert("Preencha os campos obrigatórios");
    return;
  }

  const { error } = await supabaseClient
    .from("agendamentos")
    .insert([{ nome, email, data, hora }]);

  if (error) {
    console.log(error);
    alert("Erro ao salvar agendamento");
  } else {
    alert("Agendamento realizado com sucesso!");
  }
}

async function listarAgendamentos() {
  const { data, error } = await supabaseClient
    .from("agendamentos")
    .select("*")
    .order("data", { ascending: true });

  if (error) {
    console.log(error);
    return;
  }

  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  data.forEach(item => {
    lista.innerHTML += `
      <div class="agendamento">
        <strong>${item.nome}</strong><br>
        ${item.data} às ${item.hora}
      </div>
    `;
  });
}
