// js/empresa.js - OTIMIZADO (SEM DOMContentLoaded)

const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;

const logoutBtn = document.querySelector('.logout-btn');

// =================================================================
// FUNÇÕES DE CARREGAMENTO DE DADOS (Dashboard e Minhas Vagas)
// =================================================================

const loadDashboardData = async (user) => {
    const empresaNameEl = document.querySelector('.company-dashboard .container h2');
    const vagasCountEl = document.getElementById('vagas-publicadas-count');
    const candidaturasCountEl = document.getElementById('candidaturas-count');
    
    // 1. Buscar Nome da Empresa
    if (empresaNameEl) {
         try {
            const empresaDoc = await db.collection('empresas').doc(user.uid).get();
            if (empresaDoc.exists) {
                const nomeEmpresa = empresaDoc.data().nome; // Campo 'nome' confirmado
                empresaNameEl.innerHTML = `Bem-vindo(a), <span class="company-name">${nomeEmpresa}</span>!`;
            } else {
                empresaNameEl.textContent = `Bem-vindo(a), Empresa Desconhecida!`;
            }
        } catch (error) {
            console.error("Erro ao carregar nome da empresa:", error);
            empresaNameEl.textContent = `Bem-vindo(a), Erro ao carregar nome!`; 
        }
    }
   
    // 2. Contar Vagas Publicadas
    if (vagasCountEl) {
        try {
            // A query funciona porque você criou o índice necessário
            const vagasSnapshot = await db.collection('vagas')
                .where('empresaId', '==', user.uid)
                .get();
            vagasCountEl.textContent = vagasSnapshot.size;
        } catch (error) {
            console.error("Erro ao contar vagas:", error);
            vagasCountEl.textContent = 'ERRO';
        }
    }

    // 3. Contar Candidaturas Recebidas
    if (candidaturasCountEl) {
        try {
            const candidaturasSnapshot = await db.collection('candidaturas')
                .where('empresaId', '==', user.uid) 
                .get();
            candidaturasCountEl.textContent = candidaturasSnapshot.size;
        } catch (error) {
            console.error("Erro ao contar candidaturas:", error);
            candidaturasCountEl.textContent = 'ERRO';
        }
    }
};

const loadCompanyJobs = () => {
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer || !currentUser) return;

    vagasContainer.innerHTML = '<p>Carregando suas vagas...</p>';

    // A query para listagem de vagas
    db.collection('vagas')
      .where('empresaId', '==', currentUser.uid)
      .orderBy('criadaEm', 'desc') 
      .get()
      .then(snapshot => {
          vagasContainer.innerHTML = ''; 
          if (snapshot.empty) {
              vagasContainer.innerHTML = '<p class="info-message">Você ainda não publicou nenhuma vaga. <a href="CriarVagaEmpresa.html">Crie sua primeira vaga aqui.</a></p>';
              return;
          }
          snapshot.forEach(doc => {
              const vaga = doc.data();
              const vagaId = doc.id;
              const vagaCard = document.createElement('div');
              vagaCard.className = 'vaga-card';
              vagaCard.innerHTML = `
                  <h3 class="job-title">${vaga.titulo}</h3>
                  <p class="job-description">${vaga.descricao.substring(0, 150)}...</p> 
                  <p class="job-time">Carga Horária: ${vaga.cargaHoraria}</p>
                  <div class="actions-vaga">
                      <button class="edit-btn action-button" data-id="${vagaId}" title="Editar Vaga">
                        <i data-feather="edit"></i> Editar
                      </button>
                      <button class="delete-btn action-button delete" data-id="${vagaId}" title="Excluir Vaga">
                        <i data-feather="trash-2"></i> Excluir
                      </button>
                  </div>
              `;
              vagasContainer.appendChild(vagaCard);
          });
          if (typeof feather !== 'undefined') {
             feather.replace(); 
          }
      })
      .catch(error => {
          console.error("Erro ao buscar vagas: ", error);
          vagasContainer.innerHTML = '<p class="error-message">Ocorreu um erro ao carregar suas vagas. Verifique o console para detalhes.</p>';
      });
};

// =================================================================
// PONTO PRINCIPAL: AUTENTICAÇÃO
// =================================================================

// Este bloco é executado imediatamente (garante que o estado de login seja verificado primeiro)
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        console.log('Usuário autenticado:', currentUser.uid);

        const currentPath = window.location.pathname;
        
        if (currentPath.includes('InicialEmpresa.html')) {
             loadDashboardData(currentUser);
        } else if (currentPath.includes('MinhasVagas.html')) {
            loadCompanyJobs();
            setupJobActions();
        } else if (currentPath.includes('CriarVagaEmpresa.html')) {
            // Garante que o formulário possa ser submetido após o currentUser ser setado
            setupCreateJobForm();
        }
        // Adicione outras páginas protegidas aqui

    } else {
        // Redireciona para o login se não houver usuário. 
        // A lentidão aqui era o problema de navegação.
        window.location.href = 'login-empresa.html'; 
    }
});

// Lógica de Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut().then(() => { 
            window.location.href = 'login-empresa.html'; 
        });
    });
}

// =================================================================
// LÓGICA DO FORMULÁRIO CRIAR VAGA
// =================================================================
const setupCreateJobForm = () => {
    const createJobForm = document.getElementById('create-job-form');
    if (createJobForm) {
        createJobForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Re-checa se o usuário está setado antes de enviar (o que resolve o erro de permissão no console)
            if (!currentUser) { 
                console.error("Erro: Usuário não autenticado no momento da submissão.");
                return alert('Erro de autenticação. Por favor, tente recarregar a página.'); 
            }

            const vagaData = {
                titulo: document.getElementById('titulo').value,
                descricao: document.getElementById('descricao').value,
                requisitos: document.getElementById('requisitos').value,
                cargaHoraria: document.getElementById('cargaHoraria').value,
                empresaId: currentUser.uid, // Usa o UID do usuário autenticado
                criadaEm: firebase.firestore.FieldValue.serverTimestamp()
            };

            const submitButton = createJobForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Publicando...';

            db.collection('vagas').add(vagaData)
                .then(() => {
                    alert('Vaga criada com sucesso!');
                    createJobForm.reset();
                    window.location.href = 'MinhasVagas.html';
                })
                .catch(error => {
                    // O erro de permissão é capturado aqui
                    console.error("Erro ao criar a vaga: ", error); 
                    alert('Falha ao criar a vaga. Verifique as Regras de Segurança do Firestore.');
                })
                .finally(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Publicar Vaga';
                });
        });
    }
}

// =================================================================
// LÓGICA DE EDIÇÃO/EXCLUSÃO (MINHAS VAGAS)
// =================================================================
const setupJobActions = () => {
    const vagasContainer = document.getElementById('vagas-container');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-job-form');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
    if (!vagasContainer) return; 

    vagasContainer.addEventListener('click', (e) => {
        const targetButton = e.target.closest('.action-button');
        if (!targetButton) return;
        const vagaId = targetButton.dataset.id;

        // AÇÃO DE EXCLUIR
        if (targetButton.classList.contains('delete-btn')) {
            if (confirm('Tem certeza de que deseja excluir esta vaga?')) {
                db.collection('vagas').doc(vagaId).delete()
                    .then(() => {
                        alert('Vaga excluída com sucesso! 🗑️');
                        loadCompanyJobs();
                    })
                    .catch(error => {
                        console.error("Erro ao excluir vaga: ", error);
                        alert('Falha ao excluir a vaga.');
                    });
            }
        }
        
        // AÇÃO DE EDITAR (ABRIR MODAL)
        if (targetButton.classList.contains('edit-btn') && editModal) {
            db.collection('vagas').doc(vagaId).get().then(doc => {
                if (doc.exists) {
                    const vaga = doc.data();
                    document.getElementById('edit-vaga-id').value = vagaId;
                    document.getElementById('edit-titulo').value = vaga.titulo;
                    document.getElementById('edit-descricao').value = vaga.descricao;
                    document.getElementById('edit-requisitos').value = vaga.requisitos;
                    document.getElementById('edit-cargaHoraria').value = vaga.cargaHoraria;
                    editModal.style.display = 'flex';
                } else {
                    alert('Vaga não encontrada!');
                }
            });
        }
    });
    
    // SALVAR EDIÇÃO
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const vagaId = document.getElementById('edit-vaga-id').value;
            
            const updatedData = {
                titulo: document.getElementById('edit-titulo').value,
                descricao: document.getElementById('edit-descricao').value,
                requisitos: document.getElementById('edit-requisitos').value,
                cargaHoraria: document.getElementById('edit-cargaHoraria').value,
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            };

            const submitButton = editForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';

            db.collection('vagas').doc(vagaId).update(updatedData)
                .then(() => {
                    alert('Vaga atualizada com sucesso! ✅');
                    editModal.style.display = 'none';
                    loadCompanyJobs();
                })
                .catch(error => {
                    console.error("Erro ao atualizar vaga: ", error);
                    alert('Falha ao atualizar a vaga.');
                })
                .finally(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Salvar Alterações';
                });
        });
    }

    // FECHAR MODAL
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => { editModal.style.display = 'none'; });
    }
    if (editModal) {
         editModal.addEventListener('click', (e) => {
            if (e.target.id === 'edit-modal') { editModal.style.display = 'none'; }
        });
    }
};
