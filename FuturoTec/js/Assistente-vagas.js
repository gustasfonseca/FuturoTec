// Bloco saveBtn corrigido e robusto:
saveBtn.addEventListener('click', async () => {
  console.log("Botão Salvar Clicado"); // Linha para debug

  const cargo = cargoInput.value.trim();
  // ... (outras variáveis)
  
  if(!cargo || !empresa || !local || !contato) { 
    // Mensagem de erro mais clara
    alert("ATENÇÃO: Você deve preencher TODOS os campos (Cargo, Empresa, Local, Contato) para salvar a vaga."); 
    return; // Interrompe
  }

  try {
    // Lógica de salvar/atualizar
    // ...
    alert("Vaga adicionada/atualizada com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar vaga:", error);
    alert("Falha ao salvar a vaga. Verifique a console para detalhes.");
  }
  
  modal.style.display = "none";
  carregarVagas();
});
