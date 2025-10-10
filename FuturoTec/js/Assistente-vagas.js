document.addEventListener('DOMContentLoaded', () => {
  // Inicializações do Firebase
  const db = firebase.firestore();
  const auth = firebase.auth();

  let allJobs = []; // Guarda as vagas carregadas

  // Elementos do DOM
  const vagasTableBody = document.getElementById('tabela-vagas-body');
  const addVagaBtn = document.getElementById('add-vaga-btn');
  const vagaModal = document.getElementById('vaga-modal');
  const vagaForm = document.getElementById('vaga-form');
  const cancelBtn = document.getElementById('cancel-btn');
  const modalTitle = document.getElementById('modal-title');
  const vagaIdInput = document.getElementById('vaga-id');
  const empresaSelectGroup = document.getElementById('empresa-select-group');

  // Carrega e exibe as vagas na tabela principal
  const loadVagas = async () => {
    if (!vagasTableBody) return;
    vagasTableBody.innerHTML = '<tr><td colspan="4">Carregando vagas...</td></tr>';
    try {
      const snapshot = await db.collection('vagas').orderBy('criadaEm', 'desc').get();
      allJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (allJobs.length === 0) {
        vagasTableBody.innerHTML = '<tr><td colspan="4">Nenhuma vaga encontrada.</td></tr>';
        return;
      }

      vagasTableBody.innerHTML = '';
      for (const vaga of allJobs) {
        let empresaNome = 'Vaga Interna'; // Padrão se não houver empresaId
        if (vaga.empresaId) {
          const empresaDoc = await db.collection('usuarios').doc(vaga.empresaId).get();
          if (empresaDoc.exists) {
            empresaNome = empresaDoc.data().nome || 'Nome não informado';
          } else {
            empresaNome = 'Empresa não encontrada';
          }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${vaga.titulo}</td>
          <td>${empresaNome}</td>
          <td><span class="status ${vaga.status === 'Vaga Ativa' ? 'status-active' : 'status-inactive'}">${vaga.status || 'Ativa'}</span></td>
          <td class="actions-cell">
            <button class="action-btn btn-edit" data-id="${vaga.id}">Editar</button>
            <button class="action-btn btn-delete" data-id="${vaga.id}">Excluir</button>
          </td>
        `;
        vagasTableBody.appendChild(tr);
      }
    } catch (error) {
      console.error("Erro ao carregar vagas:", error);
      vagasTableBody.innerHTML = `<tr><td colspan="4">Erro ao carregar vagas. Verifique o console.</td></tr>`;
    }
  };

  // Abre o modal para adicionar vaga
  if (addVagaBtn) {
    addVagaBtn.addEventListener('click', () => {
      if (!auth.currentUser) {
        alert("Você precisa estar logado para adicionar uma vaga.");
        return;
      }
      modalTitle.textContent = 'Adicionar Nova Vaga';
      vagaForm.reset();
      vagaIdInput.value = '';
      empresaSelectGroup.style.display = 'none'; // Esconde seletor de empresa
      vagaModal.style.display = 'flex';
    });
  }

  // Fecha o modal
  const closeModal = () => {
    if (vagaModal) vagaModal.style.display = 'none';
  };
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Lida com o envio do formulário (Adicionar ou Editar)
  if (vagaForm) {
    vagaForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const user = auth.currentUser;
      if (!user) {
        alert("Sua sessão expirou. Por favor, faça login novamente.");
        return;
      }

      const id = vagaIdInput.value;
      const submitBtn = vagaForm.querySelector('button[type="submit"]');

      const vagaData = {
        titulo: document.getElementById('titulo').value,
        descricao: document.getElementById('descricao').value,
        requisitos: document.getElementById('requisitos').value,
        cargaHoraria: document.getElementById('cargaHoraria').value,
        cursosRequeridos: (document.getElementById('cursosRequeridos').value || '').split(',').map(c => c.trim()),
        status: 'Vaga Ativa',
      };

      submitBtn.disabled = true;

      try {
        if (id) { // Editando vaga existente
          submitBtn.textContent = 'Salvando...';
          await db.collection('vagas').doc(id).update({
            ...vagaData,
            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
          });
          alert('Vaga atualizada com sucesso!');
        } else { // Adicionando nova vaga
          submitBtn.textContent = 'Adicionando...';
          vagaData.empresaId = user.uid;
          vagaData.criadaEm = firebase.firestore.FieldValue.serverTimestamp();

          await db.collection('vagas').add(vagaData);
          alert('Vaga adicionada com sucesso!');
        }
        closeModal();
        loadVagas();
      } catch (error) {
        console.error("Erro ao salvar vaga:", error);
        // MELHORIA: Alerta mais específico para erro de permissão
        if (error.code === 'permission-denied') {
            alert('Erro de Permissão!\n\nSe você está EDITANDO uma vaga antiga, o `empresaId` associado a ela no banco de dados pode não corresponder ao seu usuário atual. Vagas antigas talvez precisem ser corrigidas manualmente no Console do Firebase.');
        } else {
            alert('Ocorreu um erro ao salvar a vaga. Verifique o console para mais detalhes.');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar';
      }
    });
  }

  // Lida com cliques na tabela (Editar e Excluir)
  if (vagasTableBody) {
    vagasTableBody.addEventListener('click', async (e) => {
      const target = e.target;

      const deleteButton = target.closest('.btn-delete');
      const editButton = target.closest('.btn-edit');

      if (deleteButton) {
        const id = deleteButton.dataset.id;
        if (confirm('Tem certeza que deseja excluir esta vaga?')) {
          try {
            await db.collection('vagas').doc(id).delete();
            alert('Vaga excluída com sucesso.');
            loadVagas();
          } catch (error) {
            console.error("Erro ao excluir vaga:", error);
            // MELHORIA: Alerta mais específico para erro de permissão
            if (error.code === 'permission-denied') {
                alert('Erro de Permissão ao Excluir!\n\nIsso geralmente acontece com vagas antigas cujo `empresaId` não corresponde ao seu usuário. A vaga pode precisar ser excluída manualmente no Console do Firebase.');
            } else {
                alert('Erro ao excluir vaga. Verifique as permissões.');
            }
          }
        }
      }

      if (editButton) {
        const id = editButton.dataset.id;
        const vaga = allJobs.find(v => v.id === id);
        if (vaga) {
          modalTitle.textContent = 'Editar Vaga';
          vagaIdInput.value = vaga.id;
          document.getElementById('titulo').value = vaga.titulo || '';
          document.getElementById('descricao').value = vaga.descricao || '';
          document.getElementById('requisitos').value = vaga.requisitos || '';
          document.getElementById('cargaHoraria').value = vaga.cargaHoraria || '';
          document.getElementById('cursosRequeridos').value = (vaga.cursosRequeridos || []).join(', ');
          empresaSelectGroup.style.display = 'none';
          vagaModal.style.display = 'flex';
        }
      }
    });
  }

  // Ponto de entrada: verifica a autenticação e carrega os dados
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log("Usuário autenticado:", user.uid);
      loadVagas();
    } else {
      console.log("Nenhum usuário logado. Redirecionando para o login...");
      // Se necessário, descomente a linha abaixo para redirecionar
      // window.location.href = 'login-assistente.html';
    }
  });
});
