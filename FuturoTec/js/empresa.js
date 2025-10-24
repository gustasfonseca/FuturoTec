// CÓDIGO COMPLETO RESULTANTE DA UNIÃO DAS DUAS PARTES
// =================================================================
// Variáveis Globais e Inicialização
// =================================================================
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null; // O usuário da empresa autenticado
let selectedCourses = []; // Variável para armazenar os cursos selecionados (USADA PARA CRIAÇÃO E EDIÇÃO)
let availableCourses = []; // Variável para armazenar os cursos carregados do Firestore

let realLogoutBtn = null; // Variável para o botão de logout dedicado (Deve ter ID: 'btn-logout-empresa')

// =================================================================
// FUNÇÃO PARA CARREGAR OS CURSOS DO FIRESTORE
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
        alert("Atenção: Houve um erro ao carregar a lista de cursos. Verifique o console.");
    }
};

// =================================================================
// FUNÇÕES DE CARREGAMENTO DE DADOS (Dashboard e Minhas Vagas)
// =================================================================
const loadDashboardData = async (user) => {
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
            
            // Note: Este loop pode ser lento para muitas vagas/candidaturas.
            // Otimização futura pode envolver um campo de 'candidaturasCount' na coleção 'vagas'.
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
                 
                 const vagaCard = document.createElement('div');
                 vagaCard.className = 'vaga-card';
                 vagaCard.innerHTML = `
                      <h3 class="job-title">${vaga.titulo}</h3>
                      <p class="job-description">${vaga.descricao.substring(0, 150)}...</p> 
                      ${cursos}
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
                 vagaCard.appendChild(document.createElement('div')); 
                 vagasContainer.appendChild(vagaCard);
             });
             if (typeof feather !== 'undefined') {
                 feather.replace(); 
             }
      })
      .catch(error => {
             console.error("ERRO FATAL AO BUSCAR VAGAS:", error);
             vagasContainer.innerHTML = '<p class="error-message">Ocorreu um erro ao carregar suas vagas. Verifique o **Console do Navegador**.</p>';
      });
};

const loadCandidaciesForCompany = async () => {
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
                              // Tenta garantir que o email do Auth esteja disponível
                              if (!aluno.email && auth.currentUser && auth.currentUser.uid === candidatura.alunoId) {
                                   aluno.email = auth.currentUser.email;
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
        // Assume que estas funções estão definidas globalmente ou em outro arquivo importado:
        if (typeof setupAccordionListeners !== 'undefined') {
             setupAccordionListeners(); 
        }
        if (typeof feather !== 'undefined') {
             feather.replace(); 
        }

    } catch (error) {
        console.error("ERRO FATAL AO CARREGAR CANDIDATURAS PARA EMPRESA:", error);
        let errorMessage = 'Não foi possível carregar as candidaturas devido a um erro de conexão ou permissão.';
        container.innerHTML = `<p class="error-message">**${errorMessage}**</p><p>Detalhes técnicos no console (F12).</p>`; 
    }
};

// =================================================================
// LÓGICA DE AUTOCOMPLETE PARA MÚLTIPLOS CURSOS
// CORRIGIDA PARA FUNCIONAR EM CRIAÇÃO E EDIÇÃO
// =================================================================

const renderSelectedCourses = (targetContainerId) => {
    // Usa o ID do container do formulário de criação ou edição
    const container = document.getElementById(targetContainerId); 
    if (!container) return;

    container.innerHTML = selectedCourses.map(course => `
        <span class="course-tag" data-course="${course}">
            ${course}
            <i data-feather="x" class="remove-tag" data-course="${course}"></i>
        </span>
    `).join('');

    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

const setupCourseAutocomplete = () => {
    const setupAutocompleteForElements = (inputID, suggestionsID, selectedID) => {
        const currentInput = document.getElementById(inputID);
        const currentSuggestionsContainer = document.getElementById(suggestionsID);
        const currentSelectedContainer = document.getElementById(selectedID);
        
        if (!currentInput || !currentSuggestionsContainer || !currentSelectedContainer) return;
        
        // 1. Lógica do Input (Buscar Sugestões)
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
        
        // 2. Lógica de Seleção de Curso
        const handleCourseSelection = (course, inputEl, suggestionsEl, selectedContainerId) => {
            if (!selectedCourses.includes(course)) {
                selectedCourses.push(course);
                renderSelectedCourses(selectedContainerId);
                inputEl.value = ''; 
                suggestionsEl.innerHTML = ''; 
            }
        };
        
        // 3. Lógica de Remover Tag (Delegação)
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

        // 4. Fechar Sugestões ao clicar fora
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-container')) {
                currentSuggestionsContainer.innerHTML = '';
            }
        });
    }

    // Configura para o formulário de criação (CriarVagaEmpresa.html)
    setupAutocompleteForElements('curso-vaga', 'sugestoes-curso-vaga', 'cursos-selecionados');
    
    // Configura para o modal de edição (MinhasVagas.html)
    setupAutocompleteForElements('edit-curso-vaga', 'edit-sugestoes-curso-vaga', 'edit-cursos-selecionados');
}


// =================================================================
// LÓGICA DO FORMULÁRIO CRIAR VAGA
// =================================================================
const setupCreateJobForm = () => {
    const createJobForm = document.getElementById('create-job-form');
    if (createJobForm) {
        // Limpa o array global ao carregar a tela de criação
        selectedCourses = [];
        renderSelectedCourses('cursos-selecionados');

        createJobForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (!currentUser) { 
                alert("Erro: Usuário não autenticado.");
                return; 
            }
            
            if (selectedCourses.length === 0) {
                 alert("Por favor, selecione pelo menos um curso requerido para a vaga.");
                 return;
            }

            const vagaData = {
                titulo: document.getElementById('titulo').value,
                descricao: document.getElementById('descricao').value,
                requisitos: document.getElementById('requisitos').value,
                cargaHoraria: document.getElementById('cargaHoraria').value,
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
                    createJobForm.reset();
                    selectedCourses = [];
                    renderSelectedCourses('cursos-selecionados');
                    window.location.href = 'MinhasVagas.html';
                })
                .catch(error => {
                    console.error("Erro ao criar a vaga: ", error); 
                    alert(`Erro ao criar a vaga: ${error.message}`);
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
            if (!confirm("Tem certeza que deseja excluir esta vaga?")) return;
            
            db.collection('vagas').doc(vagaId).delete()
                 .then(() => {
                     console.log('Vaga excluída com sucesso! 🗑️');
                     loadCompanyJobs();
                 })
                 .catch(error => {
                     console.error("Erro ao excluir vaga:", error);
                 });
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
                     
                     // 1. Limpa o estado global
                     selectedCourses = [];
                     
                     // 2. Popula e renderiza no modal
                     if (vaga.cursosRequeridos && Array.isArray(vaga.cursosRequeridos)) {
                          selectedCourses = [...vaga.cursosRequeridos]; 
                     }
                     renderSelectedCourses('edit-cursos-selecionados'); 
                     
                     editModal.style.display = 'flex';
                 } else {
                     console.error('Vaga não encontrada!');
                 }
             });
        }
    });
    
    // SALVAR EDIÇÃO
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const vagaId = document.getElementById('edit-vaga-id').value;
            
            if (selectedCourses.length === 0) {
                 alert("Por favor, selecione pelo menos um curso requerido para a vaga.");
                 return;
            }
            
            const updatedData = {
                 titulo: document.getElementById('edit-titulo').value,
                 descricao: document.getElementById('edit-descricao').value,
                 requisitos: document.getElementById('edit-requisitos').value,
                 cargaHoraria: document.getElementById('edit-cargaHoraria').value,
                 cursosRequeridos: selectedCourses,
                 ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            };

            const submitButton = editForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';

            db.collection('vagas').doc(vagaId).update(updatedData)
                 .then(() => {
                     console.log('Vaga atualizada com sucesso! ✅');
                     editModal.style.display = 'none';
                     selectedCourses = []; // Limpa o estado após salvar
                     loadCompanyJobs();
                 })
                 .catch(error => {
                     console.error("Erro ao atualizar vaga:", error);
                 })
                 .finally(() => {
                     submitButton.disabled = false;
                     submitButton.textContent = 'Salvar Alterações';
                 });
        });
    }

    // FECHAR MODAL
    const closeModal = () => { editModal.style.display = 'none'; selectedCourses = []; renderSelectedCourses('edit-cursos-selecionados'); };
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeModal);
    }
    if (editModal) {
          editModal.addEventListener('click', (e) => {
              if (e.target.id === 'edit-modal') { closeModal(); }
          });
    }
};

// =================================================================
// LÓGICA DO PERFIL DA EMPRESA (PerfilEmpresa.html)
// =================================================================

const loadCompanyProfile = async (user) => {
    const emailEl = document.getElementById('email');
    const nameInput = document.getElementById('nome-empresa');
    const cnpjInput = document.getElementById('cnpj-empresa');
    const displayNameEl = document.getElementById('user-name');
    const displayEmailEl = document.getElementById('user-email');

    if (emailEl) emailEl.value = user.email || 'Não informado';
    if (displayEmailEl) displayEmailEl.textContent = user.email || 'Não informado';

    try {
        const doc = await db.collection('usuarios').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            
            if (nameInput) nameInput.value = data.nome || '';
            if (cnpjInput) cnpjInput.value = data.cnpj || '';
            
            if (displayNameEl) displayNameEl.textContent = data.nome || 'Empresa';

        } else {
            console.warn("Documento do usuário não encontrado no Firestore.");
            if (displayNameEl) displayNameEl.textContent = 'Empresa Desconhecida';
        }
    } catch (error) {
        console.error("Erro ao carregar dados do perfil da empresa:", error);
    }
};

const setupProfileForm = (user) => {
    const profileForm = document.getElementById('profile-form-empresa');
    if (!profileForm) return;

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitButton = profileForm.querySelector('.save-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        const updatedData = {
            nome: document.getElementById('nome-empresa').value,
            cnpj: document.getElementById('cnpj-empresa').value,
            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('usuarios').doc(user.uid).update(updatedData);

            if (user.displayName !== updatedData.nome) {
                 await user.updateProfile({ displayName: updatedData.nome });
            }
            
            await loadCompanyProfile(user); 

            alert('Perfil atualizado com sucesso! ✅');
        } catch (error) {
            console.error("Erro ao salvar perfil da empresa:", error);
            alert(`Erro ao salvar perfil: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Alterações';
        }
    });

    // Lógica para Excluir Conta (Ação Permanente)
    const deleteAccountBtn = document.getElementById('btn-excluir-conta-empresa');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
             if (!confirm("AVISO DE EXCLUSÃO PERMANENTE: Tem certeza que deseja excluir sua conta? Todas as vagas publicadas e candidaturas serão PERDIDAS!")) {
                 return;
             }

             deleteAccountBtn.disabled = true;
             deleteAccountBtn.textContent = 'Excluindo...';

             try {
                 // Nota: É necessário verificar se há dados sensíveis (vagas/candidaturas) e deletá-los também.
                 await db.collection('usuarios').doc(user.uid).delete();
                 await user.delete();
                 alert("Conta excluída com sucesso. Você será redirecionado para o login.");
                 window.location.href = 'login-empresa.html'; 

             } catch (error) {
                 console.error("Erro ao excluir conta:", error);
                 let errorMessage = "Ocorreu um erro ao excluir a conta. Consulte o console.";
                 
                 if (error.code === 'auth/requires-recent-login') {
                     errorMessage = "Erro de segurança: Por favor, saia e entre novamente antes de tentar excluir a conta. (É necessário login recente)";
                 }
                 
                 alert(errorMessage);
                 deleteAccountBtn.disabled = false;
                 deleteAccountBtn.textContent = 'Excluir Minha Conta Permanentemente';
             }
        });
    }
};

// =================================================================
// PONTO PRINCIPAL: AUTENTICAÇÃO E ROTEAMENTO (FLOW CONTROL)
// =================================================================

auth.onAuthStateChanged(async (user) => { 
    if (user) {
        try {
            const doc = await db.collection('usuarios').doc(user.uid).get();
            // APLICAÇÃO DE SEGURANÇA: Verifica se o usuário tem a role 'empresa'
            if (doc.exists && doc.data().role === 'empresa') {
                
                currentUser = user;
                console.log('Usuário autenticado e autorizado como EMPRESA:', currentUser.uid);
                const currentPath = window.location.pathname;

                // Roteamento baseado na URL
                if (currentPath.includes('CriarVagaEmpresa.html') || currentPath.includes('MinhasVagas.html')) {
                     await loadAvailableCourses(); 
                     setupCourseAutocomplete(); 
                }
                
                if (currentPath.includes('CriarVagaEmpresa.html')) {
                     setupCreateJobForm();
                } 
                else if (currentPath.includes('InicialEmpresa.html')) {
                     loadDashboardData(currentUser);
                } 
                else if (currentPath.includes('MinhasVagas.html')) {
                     loadCompanyJobs();
                     setupJobActions();
                } 
                else if (currentPath.includes('EmpresaCandidatos.html')) { 
                     loadCandidaciesForCompany();
                } 
                else if (currentPath.includes('PerfilEmpresa.html')) { 
                     loadCompanyProfile(currentUser);
                     setupProfileForm(currentUser);
                }

            } else {
                // Usuário logado, mas NÃO é uma empresa. Força o logout.
                console.warn('Usuário autenticado, mas sem role de empresa. Forçando logout e redirecionando...');
                await auth.signOut();
                if (!window.location.pathname.includes('login-empresa.html')) {
                     window.location.href = 'login-empresa.html'; 
                }
            }
        } catch (error) {
            console.error("Erro durante a verificação de role:", error);
            await auth.signOut();
            if (!window.location.pathname.includes('login-empresa.html')) {
                window.location.href = 'login-empresa.html'; 
            }
        }
    } else {
        // Usuário NÃO autenticado. Redireciona para login, exceto se já estiver no login.
        if (!window.location.pathname.includes('login-empresa.html')) {
            window.location.href = 'login-empresa.html'; 
        }
    }
});

// =================================================================
// LÓGICA DE LOGOUT (Garante que o link de Perfil NÃO seja o Logout)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // CORRIGIDO: Seleciona o botão de Logout dedicado (deve ter o ID 'btn-logout-empresa')
    realLogoutBtn = document.getElementById('btn-logout-empresa'); 
    
    // Configura o evento do botão de Logout APENAS após o DOM ser carregado
    if (realLogoutBtn) {
        realLogoutBtn.addEventListener('click', (e) => {
             e.preventDefault();
             auth.signOut().then(() => { 
                 window.location.href = 'login-empresa.html'; 
             });
        });
    }

});
