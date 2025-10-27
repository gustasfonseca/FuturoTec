// empresa.js - Dashboard, Vagas e Perfil (Completo)

// =================================================================
// Importa 'auth', 'db', 'storage' e 'logoutEmpresa' do módulo auth-empresa.js
// IMPORTANTE: 'firebase' precisa estar global (carregado via <script> tag no HTML)
// para usar firebase.firestore.FieldValue.serverTimestamp().
// =================================================================
import { auth, db, storage, logoutEmpresa } from './auth-empresa.js';

// =================================================================
// 1. IMPORTAÇÃO DO MÓDULO DE ALERTA (Ajuste Inserido Aqui)
// Agora usamos a versão estilizada do alert-manager.js
// O alert-manager.js fornecido só lida com toasts (simples alerts),
// então vamos manter window.confirm para a lógica de confirmação de exclusão.
// =================================================================
import { showAlert as showToast } from './alert-manager.js'; 

// Cria uma função wrapper para gerenciar alerts e confirms, já que o alert-manager só faz toasts.
const showAlert = (message, type = 'info', confirm = false) => { 
    // Se for confirmação, usa a função nativa do navegador (bloqueante)
    if (confirm) return new Promise(resolve => resolve(window.confirm(message)));
    
    // Caso contrário, usa o alerta estilizado (toast) importado
    // O tipo 'warning' não está definido no seu CSS/JS, vamos mapear para 'error' ou 'info'.
    // Mapeando 'warning' para 'error' por ser mais crítico.
    const mappedType = (type === 'warning') ? 'error' : type;
    showToast(message, mappedType);
};


let currentUser = null; 
let selectedCourses = []; 
let availableCourses = []; 

// =================================================================
// FUNÇÕES DE PERFIL DA EMPRESA (Adicionadas/Integradas)
// =================================================================

const carregarDadosEmpresa = async (user) => {
    if (!document.getElementById('profile-form-empresa')) return; // Só roda na página do perfil
    
    try {
        const docSnap = await db.collection('usuarios').doc(user.uid).get();

        if (docSnap.exists) {
            const data = docSnap.data();

            const userNameEl = document.getElementById('user-name');
            const userEmailEl = document.getElementById('user-email');
            
            if (userNameEl) userNameEl.textContent = data.nome || 'Nome não encontrado';
            if (userEmailEl) userEmailEl.textContent = data.email || user.email;

            document.getElementById('email').value = data.email || user.email;
            document.getElementById('nome-empresa').value = data.nome || '';
            document.getElementById('cnpj-empresa').value = data.cnpj || '';

            console.log("[Perfil Empresa] Dados carregados com sucesso!");
        } else {
            console.error("[Perfil Empresa] Documento do usuário não encontrado!");
        }
    } catch (error) {
        console.error("[Perfil Empresa] Erro ao carregar dados:", error);
        showAlert("Erro ao carregar os dados do perfil.", 'error');
    }
}

const salvarDadosEmpresa = async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) return showAlert("Usuário não autenticado.", 'error'); // Ajuste: 'warning' -> 'error' (melhor visual para falha)

    const userId = user.uid;
    const nomeEmpresa = document.getElementById('nome-empresa').value.trim();
    const cnpj = document.getElementById('cnpj-empresa').value.trim();
    const saveButton = document.querySelector('.save-button');
    const originalText = saveButton ? saveButton.textContent : 'Salvar Alterações';

    if (!nomeEmpresa || !cnpj) return showAlert("Preencha todos os campos obrigatórios.", 'error'); // Ajuste: 'warning' -> 'error'
    if (saveButton) { saveButton.textContent = 'Salvando...'; saveButton.disabled = true; }

    try {
        await db.collection('usuarios').doc(userId).update({
            nome: nomeEmpresa,
            cnpj: cnpj,
            // O tipo de usuário já deve estar setado para 'empresa'
        });

        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = nomeEmpresa;

        showAlert("Perfil da Empresa atualizado com sucesso!", 'success');
    } catch (error) {
        console.error("Erro ao salvar dados do perfil:", error);
        showAlert("Erro ao salvar. Detalhes: " + error.message, 'error');
    } finally {
        if (saveButton) { saveButton.textContent = originalText; saveButton.disabled = false; }
    }
}


// =================================================================
// FUNÇÃO PARA CARREGAR OS CURSOS DO FIRESTORE (Mantida)
// =================================================================
const loadAvailableCourses = async () => {
    try {
        console.log("[Cursos] Buscando cursos na coleção 'cursos'...");
        const snapshot = await db.collection('cursos').get();
        availableCourses = snapshot.docs.map(doc => doc.data().nome).filter(nome => nome); 
        console.log(`[Cursos] ${availableCourses.length} cursos carregados com sucesso.`);
    } catch (error) {
        console.error("Erro ao carregar cursos do Firestore:", error);
        availableCourses = ["Erro ao carregar (Tente recarregar)"];
        showAlert("Atenção: Houve um erro ao carregar a lista de cursos. Verifique o console.", 'error');
    }
};

// =================================================================
// FUNÇÕES DE CARREGAMENTO DE DADOS (Dashboard e Minhas Vagas) - Mantidas
// =================================================================
const loadDashboardData = async (user) => {
    // ... (Seu código original loadDashboardData)
    const empresaNameEl = document.querySelector('.company-dashboard .container h2');
    const vagasCountEl = document.getElementById('vagas-publicadas-count');
    const candidaturasCountEl = document.getElementById('candidaturas-count');
    
    if (empresaNameEl) {
        try {
             const empresaDoc = await db.collection('usuarios').doc(user.uid).get(); 
             if (empresaDoc.exists) {
                 const nomeEmpresa = empresaDoc.data().nome || "Empresa"; 
                 empresaNameEl.innerHTML = `Bem-vindo(a), <span class="company-name">${nomeEmpresa}</span>!`;
             } else {
                 empresaNameEl.textContent = `Bem-vindo(a), Empresa Desconhecida!`;
             }
        } catch (error) {
             console.error("Erro ao carregar nome da empresa:", error);
             empresaNameEl.textContent = `Bem-vindo(a), Erro ao carregar nome!`; 
        }
    }
    let vagaIds = [];
    if (vagasCountEl) {
        try {
            const vagasSnapshot = await db.collection('vagas')
                 .where('empresaId', '==', user.uid)
                 .get();
            vagasCountEl.textContent = vagasSnapshot.size;
            vagaIds = vagasSnapshot.docs.map(doc => doc.id); 
        } catch (error) {
            console.error("Erro ao contar vagas:", error);
            vagasCountEl.textContent = 'ERRO';
        }
    }
    if (candidaturasCountEl) {
        try {
            if (vagaIds.length === 0) {
                 candidaturasCountEl.textContent = '0';
                 return;
            }
            let totalCandidaturas = 0;
            for (const vagaId of vagaIds) {
                 const candidaturasSnapshot = await db.collection('candidaturas')
                      .where('vagaId', '==', vagaId)
                      .get();
                 totalCandidaturas += candidaturasSnapshot.size;
            }
            candidaturasCountEl.textContent = totalCandidaturas; 
        } catch (error) {
            console.error("Erro ao contar candidaturas:", error); 
            candidaturasCountEl.textContent = 'ERRO';
        }
    }
};

const loadCompanyJobs = () => {
    // ... (Seu código original loadCompanyJobs)
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer || !currentUser) return;
    vagasContainer.innerHTML = '<p>Carregando suas vagas...</p>';
    
    db.collection('vagas')
      .where('empresaId', '==', currentUser.uid)
      .orderBy('criadaEm', 'desc') 
      .get()
      .then(snapshot => {
             console.log(`[DEBUG - Sucesso] ${snapshot.size} vagas encontradas.`); 
             vagasContainer.innerHTML = ''; 
             if (snapshot.empty) {
                 vagasContainer.innerHTML = '<p class="info-message">Você ainda não publicou nenhuma vaga. <a href="CriarVagaEmpresa.html">Crie sua primeira vaga aqui.</a></p>';
                 return;
             }
             snapshot.forEach(doc => {
                 const vaga = doc.data();
                 const vagaId = doc.id;
                 const cursos = (vaga.cursosRequeridos && vaga.cursosRequeridos.length > 0) 
                      ? `<p class="job-courses">Cursos: ${vaga.cursosRequeridos.join(', ')}</p>` 
                      : '<p class="job-courses">Cursos: Não especificado</p>';
                 
                 const periodoVaga = vaga.periodo || 'Não Informado';
                 const localVaga = vaga.local || 'Não informado'; 
                 
                 const vagaCard = document.createElement('div');
                 vagaCard.className = 'vaga-card';
                 vagaCard.innerHTML = `
                      <h3 class="job-title">${vaga.titulo}</h3>
                      <p class="job-description">${vaga.descricao.substring(0, 150)}...</p> 
                      ${cursos}
                      <p class="job-time">Carga Horária: ${vaga.cargaHoraria}</p>
                      <p class="job-periodo">Período: ${periodoVaga}</p>
                      <p class="job-location">Local: ${localVaga}</p> <div class="actions-vaga">
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
             setupJobActions();
      })
      .catch(error => {
             console.error("ERRO FATAL AO BUSCAR VAGAS:", error);
             vagasContainer.innerHTML = '<p class="error-message">Ocorreu um erro ao carregar suas vagas. Verifique o **Console do Navegador**.</p>';
      });
};

const loadCandidaciesForCompany = async () => {
    // ... (Seu código original loadCandidaciesForCompany)
    const container = document.getElementById('candidaturas-empresa-container');
    if (!container || !currentUser) return; 
    container.innerHTML = '<p class="info-message">Buscando suas vagas e candidatos...</p>'; 
    
    try {
        const vagasSnapshot = await db.collection('vagas')
             .where('empresaId', '==', currentUser.uid)
             .orderBy('criadaEm', 'desc')
             .get();

        if (vagasSnapshot.empty) {
            container.innerHTML = '<p class="info-message">Você ainda não publicou nenhuma vaga.</p>';
            return;
        }
        
        let fullHtml = '';
        for (const vagaDoc of vagasSnapshot.docs) {
             const vaga = vagaDoc.data();
             const vagaId = vagaDoc.id;
             const candidaturasSnapshot = await db.collection('candidaturas')
                  .where('vagaId', '==', vagaId)
                  .orderBy('dataCandidatura', 'asc')
                  .get();

             const totalCandidatos = candidaturasSnapshot.size;
             const vagaStatusText = vaga.status || 'Vaga Ativa';
             const vagaStatusClass = vagaStatusText.toLowerCase().replace(' ', '-');
             
             let candidatosHtml = '';

             if (candidaturasSnapshot.empty) {
                 candidatosHtml = '<p class="no-candidates">Não há candidaturas para esta vaga.</p>';
             } else {
                 for (const candDoc of candidaturasSnapshot.docs) {
                      const candidatura = candDoc.data();
                      let aluno = { nome: 'Aluno Não Encontrado', email: 'N/A', telefone: 'N/A', cidade: 'N/A', estado: 'N/A', curso: 'N/A', area: 'N/A' };

                      try {
                          if (!candidatura.alunoId) continue;
                          const alunoDoc = await db.collection('usuarios').doc(candidatura.alunoId).get();
                          if (alunoDoc.exists) {
                              aluno = { ...aluno, ...alunoDoc.data() };
                              // Tenta buscar o email do Auth se não estiver no Firestore
                              if (!aluno.email) {
                                  // Nota: Só pode buscar o email do Auth para o currentUser, ou precisa de Funções Cloud
                                  // Para simplificar, confiamos no email no Firestore
                              }
                          }
                      } catch (e) {
                          console.error("Erro ao buscar perfil do aluno:", candidatura.alunoId, e);
                      }
                      
                      const alunoCurso = aluno.curso || aluno.area || 'Informação de perfil indisponível'; 
                      const alunoLocalizacao = (aluno.cidade && aluno.estado) ? `${aluno.cidade}, ${aluno.estado}` : 'Localização não informada';
                      
                      candidatosHtml += `
                                                 <li class="candidate-card">
                                                     <div class="candidate-details">
                                                         <h4 class="candidate-name">${aluno.nome}</h4>
                                                         <p class="candidate-role">**Curso/Área:** ${alunoCurso}</p>
                                                         <p class="candidate-contact">
                                                             <i data-feather="mail" class="icon-small"></i> **Email:** ${aluno.email}
                                                         </p>
                                                         <p class="candidate-contact">
                                                             <i data-feather="phone" class="icon-small"></i> **Telefone:** ${aluno.telefone || 'N/A'}
                                                         </p>
                                                         <p class="candidate-location">
                                                             <i data-feather="map-pin" class="icon-small"></i> **Local:** ${alunoLocalizacao}
                                                         </p>
                                                     </div>
                                                     <button class="view-cv-btn" data-aluno-id="${candidatura.alunoId}">Ver Perfil Completo</button>
                                                 </li>
                      `;
                 }
                 
                 candidatosHtml = `<ul class="candidate-list">${candidatosHtml}</ul>`;
             }
             
             fullHtml += `
                 <div class="accordion-item">
                      <button class="accordion-header">
                          <div class="job-info">
                              <span class="job-title">${vaga.titulo}</span>
                              <span class="job-status ${vagaStatusClass}">${vagaStatusText}</span>
                          </div>
                          <div class="candidate-count">
                              <span>${totalCandidatos} Candidato${totalCandidatos !== 1 ? 's' : ''}</span>
                              <i data-feather="chevron-down" class="chevron"></i>
                          </div>
                      </button>
                      <div class="accordion-body">
                          ${candidatosHtml}
                      </div>
                 </div>
             `;
        } 

        container.innerHTML = fullHtml;
        if (typeof setupAccordionListeners !== 'undefined') setupAccordionListeners(); 
        if (typeof feather !== 'undefined') feather.replace(); 

    } catch (error) {
        console.error("ERRO FATAL AO CARREGAR CANDIDATURAS PARA EMPRESA:", error);
        container.innerHTML = `<p class="error-message">Não foi possível carregar as candidaturas devido a um erro de conexão ou permissão.</p>`; 
    }
};

// =================================================================
// LÓGICA DE AUTOCOMPLETE PARA MÚLTIPLOS CURSOS (Mantida)
// =================================================================
const renderSelectedCourses = (targetContainerId) => {
    const container = document.getElementById(targetContainerId); 
    if (!container) return;
    container.innerHTML = selectedCourses.map(course => `
        <span class="course-tag" data-course="${course}">
            ${course}
            <i data-feather="x" class="remove-tag" data-course="${course}"></i>
        </span>
    `).join('');
    if (typeof feather !== 'undefined') feather.replace();
}

const setupCourseAutocomplete = () => {
    const setupAutocompleteForElements = (inputID, suggestionsID, selectedID) => {
        const currentInput = document.getElementById(inputID);
        const currentSuggestionsContainer = document.getElementById(suggestionsID);
        const currentSelectedContainer = document.getElementById(selectedID);
        if (!currentInput || !currentSuggestionsContainer || !currentSelectedContainer) return;
        
        currentInput.addEventListener('input', () => {
            const query = currentInput.value.toLowerCase().trim();
            currentSuggestionsContainer.innerHTML = '';
            if (query.length === 0) return;
            const filteredCourses = availableCourses.filter(course => 
                course.toLowerCase().includes(query) && !selectedCourses.includes(course)
            );
            if (filteredCourses.length > 0) {
                filteredCourses.forEach(course => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.textContent = course;
                    item.addEventListener('click', () => handleCourseSelection(course, currentInput, currentSuggestionsContainer, selectedID));
                    currentSuggestionsContainer.appendChild(item);
                });
            } else {
                currentSuggestionsContainer.innerHTML = '<div class="autocomplete-item no-results">Nenhum curso encontrado.</div>';
            }
        });
        
        const handleCourseSelection = (course, inputEl, suggestionsEl, selectedContainerId) => {
            if (!selectedCourses.includes(course)) {
                selectedCourses.push(course);
                renderSelectedCourses(selectedContainerId);
                inputEl.value = ''; 
                suggestionsEl.innerHTML = ''; 
            }
        };
        
        currentSelectedContainer.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.remove-tag');
            if (removeButton) {
                const courseToRemove = removeButton.dataset.course;
                selectedCourses = selectedCourses.filter(c => c !== courseToRemove);
                renderSelectedCourses(selectedID);
                if (document.activeElement === currentInput) {
                    currentInput.dispatchEvent(new Event('input'));
                }
            }
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-container')) currentSuggestionsContainer.innerHTML = '';
        });
    }
    setupAutocompleteForElements('curso-vaga', 'sugestoes-curso-vaga', 'cursos-selecionados');
    setupAutocompleteForElements('edit-curso-vaga', 'edit-sugestoes-curso-vaga', 'edit-cursos-selecionados');
}

// =================================================================
// LÓGICA DO FORMULÁRIO CRIAR VAGA (Mantida)
// =================================================================
const setupCreateJobForm = () => {
    const createJobForm = document.getElementById('create-job-form');
    if (createJobForm) {
        selectedCourses = [];
        renderSelectedCourses('cursos-selecionados');

        createJobForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!currentUser) return showAlert("Erro: Usuário não autenticado.", 'error');
            if (selectedCourses.length === 0) return showAlert("Selecione pelo menos um curso requerido.", 'error'); // Ajuste: 'warning' -> 'error'

            const periodoSelecionado = document.getElementById('periodo').value;
            const localVaga = document.getElementById('local').value.trim(); 

            if (!periodoSelecionado) return showAlert("Selecione o Período de trabalho.", 'error'); // Ajuste: 'warning' -> 'error'

            const vagaData = {
                titulo: document.getElementById('titulo').value,
                descricao: document.getElementById('descricao').value,
                requisitos: document.getElementById('requisitos').value,
                cargaHoraria: document.getElementById('cargaHoraria').value,
                periodo: periodoSelecionado,
                local: localVaga || 'Não informado', 
                cursosRequeridos: selectedCourses,
                empresaId: currentUser.uid, 
                status: 'Vaga Ativa', 
                criadaEm: firebase.firestore.FieldValue.serverTimestamp()
            };

            const submitButton = createJobForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Publicando...';

            db.collection('vagas').add(vagaData)
                .then(() => {
                    console.log('Vaga criada com sucesso!');
                    showAlert("Vaga criada com sucesso!", 'success');
                    createJobForm.reset();
                    selectedCourses = [];
                    renderSelectedCourses('cursos-selecionados');
                    // Não redireciona imediatamente para dar tempo de ver o toast.
                    // Se precisar redirecionar, insira: window.location.href = 'MinhasVagas.html';
                })
                .catch(error => {
                    console.error("Erro ao criar a vaga: ", error); 
                    showAlert(`Erro ao criar a vaga: ${error.message}`, 'error');
                })
                .finally(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Publicar Vaga';
                });
        });
    }
}

// =================================================================
// LÓGICA DE EDIÇÃO/EXCLUSÃO (MINHAS VAGAS) - Mantida
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

        if (targetButton.classList.contains('delete-btn')) {
            // 2. USO DO SHOWALERT COM CONFIRM (Usa window.confirm, conforme a lógica acima)
            showAlert("Tem certeza que deseja excluir esta vaga?", 'error', true) // Tipo 'error' para confirmação
                .then(isConfirmed => {
                    if (!isConfirmed) return;
                    
                    db.collection('vagas').doc(vagaId).delete()
                         .then(() => {
                             loadCompanyJobs();
                             showAlert("Vaga excluída com sucesso!", 'success');
                         })
                         .catch(error => {
                             console.error("Erro ao excluir vaga:", error);
                             showAlert("Erro ao excluir vaga.", 'error');
                         });
                });
            return;
        }
        
        if (targetButton.classList.contains('edit-btn') && editModal) {
             db.collection('vagas').doc(vagaId).get().then(doc => {
                 if (doc.exists) {
                     const vaga = doc.data();
                     document.getElementById('edit-vaga-id').value = vagaId;
                     document.getElementById('edit-titulo').value = vaga.titulo;
                     document.getElementById('edit-descricao').value = vaga.descricao;
                     document.getElementById('edit-requisitos').value = vaga.requisitos;
                     document.getElementById('edit-cargaHoraria').value = vaga.cargaHoraria;
                     
                     const editPeriodoEl = document.getElementById('edit-periodo');
                     if (editPeriodoEl) editPeriodoEl.value = vaga.periodo || '';
                     
                     const editLocalEl = document.getElementById('edit-local');
                     if (editLocalEl) editLocalEl.value = vaga.local || ''; 

                     selectedCourses = vaga.cursosRequeridos || [];
                     renderSelectedCourses('edit-cursos-selecionados');

                     editModal.style.display = 'block';
                 }
             });
        }
    });

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => editModal.style.display = 'none');
    }

    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const vagaId = document.getElementById('edit-vaga-id').value;
            const periodoSelecionado = document.getElementById('edit-periodo').value;
            const localVagaEdit = document.getElementById('edit-local').value.trim(); 

            if (!vagaId) return showAlert("Vaga inválida!", 'error');
            if (selectedCourses.length === 0) return showAlert("Selecione pelo menos um curso requerido.", 'error'); // Ajuste: 'warning' -> 'error'

            const updatedData = {
                titulo: document.getElementById('edit-titulo').value,
                descricao: document.getElementById('edit-descricao').value,
                requisitos: document.getElementById('edit-requisitos').value,
                cargaHoraria: document.getElementById('edit-cargaHoraria').value,
                periodo: periodoSelecionado,
                local: localVagaEdit || 'Não informado', 
                cursosRequeridos: selectedCourses
            };

            db.collection('vagas').doc(vagaId).update(updatedData)
                .then(() => {
                    editModal.style.display = 'none';
                    loadCompanyJobs();
                    showAlert("Vaga atualizada com sucesso!", 'success');
                })
                .catch(error => {
                    console.error("Erro ao atualizar vaga:", error);
                    showAlert("Erro ao atualizar vaga: " + error.message, 'error');
                });
        });
    }
}

// =================================================================
// INICIALIZAÇÃO PRINCIPAL (Integrada)
// =================================================================
auth.onAuthStateChanged(user => {
    if (!user) return; // Redirecionamento já está no auth-empresa.js

    currentUser = user;
    
    // Configura o botão de logout para todas as páginas
    const btnLogout = document.getElementById('btn-logout-empresa');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            logoutEmpresa().then(() => {
                showAlert("Saindo do sistema...", 'info');
                // Redireciona
                setTimeout(() => {
                    window.location.href = "login-empresa.html";
                }, 500); // 0.5s para o usuário ver o toast
            }).catch(error => console.error("Erro ao sair:", error));
        });
    }

    // Lógica do Perfil
    if (window.location.pathname.includes('PerfilEmpresa.html')) {
        carregarDadosEmpresa(user);
        const profileForm = document.getElementById('profile-form-empresa');
        if (profileForm) profileForm.addEventListener('submit', salvarDadosEmpresa);
    }
    
    // Lógica Comum: Carrega cursos e configura autocomplete/criação de vaga
    loadAvailableCourses().then(() => {
        setupCourseAutocomplete();
        setupCreateJobForm();
    });

    // Lógica Específica por Página
    if (window.location.pathname.includes('InicialEmpresa.html')) {
        loadDashboardData(user);
    }

    if (window.location.pathname.includes('MinhasVagas.html')) {
        loadCompanyJobs();
        setupJobActions(); 
    }
    
    if (window.location.pathname.includes('EmpresaCandidatos.html')) {
        loadCandidaciesForCompany();
    }
});
