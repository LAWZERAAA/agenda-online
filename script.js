const SUPABASE_URL = https://owfpyuwxpbfhdysokqwc.supabase.co;
const SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZnB5dXd4cGJmaGR5c29rcXdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3Njc2NTUsImV4cCI6MjA4NjM0MzY1NX0.tQoYJUiTl3R3HOrzk0-Hadl9jQvk2zsK75T9kKR7AKU;

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
