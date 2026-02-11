const SUPABASE_URL = https://owfpyuwxpbfhdysokqwc.supabase.co;
const SUPABASE_KEY = sb_publishable_RC2UVIHXkvrbur2BRN2IXg_p6lQ99rZ;

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function agendar() {
  const nome = document.getElementById("nome").value;
  const email = document.getElementById("email").value;
  const data = document.getElementById("data").value;
  const hora = document.getElementById("hora").value;

  if (!nome || !data || !hora) {
    alert("Preencha os campos obrigatórios");
    return;
  }

  const { error } = await supabase
    .from("agendamentos")
    .insert([{ nome, email, data, hora }]);

  if (error) {
    alert("Erro ao salvar");
    console.log(error);
  } else {
    alert("Agendamento realizado!");
  }
}

async function listarAgendamentos() {
  const { data, error } = await supabase
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
