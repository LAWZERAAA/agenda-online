const supabase = window.supabase.createClient(
  https://owfpyuwxpbfhdysokqwc.supabase.co,
  sb_publishable_RC2UVIHXkvrbur2BRN2IXg_p6lQ99rZ
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
  }
}
