// js/empresa.js

const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null; // O usuário da empresa autenticado
let selectedCourses = []; // Variável para armazenar os cursos selecionados (USADA PARA CRIAÇÃO E EDIÇÃO)
let availableCourses = []; // Variável para armazenar os cursos carregados do Firestore

const logoutBtn = document.querySelector('.logout-btn');

// =================================================================
// FUNÇÃO PARA CARREGAR OS CURSOS DO FIRESTORE
// =================================================================

const loadAvailableCourses = async () => {
    try {
        console.log("[Cursos] Buscando cursos na coleção 'cursos'...");
        const snapshot = await db.collection('cursos').get();
        
        // Mapeia os documentos para um array de strings (assumindo que o campo do nome do curso é 'nome')
        availableCourses = snapshot.docs.map(doc => doc.data().nome).filter(nome => nome); 
        
        console.log(`[Cursos] ${availableCourses.length} cursos carregados com sucesso.`);
    } catch (error) {
        console.error("Erro ao carregar cursos do Firestore:", error);
        // Fallback em caso de erro de conexão ou regra de segurança
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
    
    // 1. Buscar Nome da Empresa
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
    
    // 2. Contar Vagas Publicadas
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

    // 3. Contar Candidaturas Recebidas
    if (candidaturasCountEl) {
        try {
            if (vagaIds.length === 0) {
                 candidaturasCountEl.textContent = '0';
                 return;
            }

            let totalCandidaturas = 0;
            
            // Loop de N+1 queries (aceito para um número limitado de vagas)
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
    
    console.log(`[DEBUG - Buscando Vagas] UID da Empresa logada: ${currentUser.uid}`);

    db.collection('vagas')
      .where('empresaId', '==', currentUser.uid)
      .orderBy('criadaEm', 'desc') 
      .get()
      .then(snapshot => {
             console.log(`[DEBUG - Sucesso] ${snapshot.size} vagas encontradas para o UID: ${currentUser.uid}`); 
             vagasContainer.innerHTML = ''; 
             if (snapshot.empty) {
                 vagasContainer.innerHTML = '<p class="info-message">Você ainda não publicou nenhuma vaga. <a href="CriarVagaEmpresa.html">Crie sua primeira vaga aqui.</a></p>';
                 return;
             }
             snapshot.forEach(doc => {
                 const vaga = doc.data();
                 const vagaId = doc.id;
                 
                 // Exibe os cursos requeridos
                 const cursos = (vaga.cursosRequeridos && vaga.cursosRequeridos.length > 0) 
                     ? `<p class="job-courses">Cursos: ${vaga.cursosRequeridos.join(', ')}</p>` 
                     : '<p class="job-courses">Cursos: Não especificado</p>';
                 
                 // Adiciona badge PCD se a vaga for para PCD
                 const pcdBadge = vaga.pcd ? '<span class="pcd-badge">Vaga PCD</span>' : '';
                 
                 const vagaCard = document.createElement('div');
                 vagaCard.className = 'vaga-card';
                 vagaCard.innerHTML = `
                      <h3 class="job-title">${vaga.titulo} ${pcdBadge}</h3>
                      <p class="job-description">${vaga.descricao.substring(0, 150)}...</p> 
                      ${cursos}
                      <p class="job-time">Carga Horária: ${vaga.cargaHoraria}</p>
                      <p class="job-periodo">Período: ${vaga.periodo || 'Não especificado'}</p>
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
             console.error("ERRO FATAL AO BUSCAR VAGAS. (Verifique o erro abaixo):", error);
             vagasContainer.innerHTML = '<p class="error-message">Ocorreu um erro ao carregar suas vagas. Verifique o **Console do Navegador** para mais detalhes.</p>';
      });
};

const loadCandidaciesForCompany = async () => {
    const container = document.getElementById('candidaturas-empresa-container');
    
    console.log(`[CandidaturasEmpresa - DEBUG INICIAL] Container existe: ${!!container}, Usuário logado: ${!!currentUser}`);

    if (!container || !currentUser) {
        console.log('[CandidaturasEmpresa - RETORNO PRECOCE] Faltando container ou usuário. Verifique o ID do container e a autenticação.');
        return; 
    } 

    container.innerHTML = '<p class="info-message">Buscando suas vagas e candidatos...</p>';
    
    try {
        // 1. Buscando TODAS AS VAGAS criadas por esta empresa
        console.log(`[CandidaturasEmpresa] Buscando vagas para o UID: ${currentUser.uid}`); 
        const vagasSnapshot = await db.collection('vagas')
             .where('empresaId', '==', currentUser.uid)
             .get();

        if (vagasSnapshot.empty) {
            container.innerHTML = '<p class="info-message">Você ainda não publicou nenhuma vaga.</p>';
            console.log("[CandidaturasEmpresa] Nenhuma vaga encontrada."); 
            return;
        }
        
        console.log(`[CandidaturasEmpresa] ${vagasSnapshot.size} vagas encontradas. Processando candidaturas...`); 

        let fullHtml = '';
        
        // 2. Iterar sobre cada VAGA para montar o item do Acordeão
        for (const vagaDoc of vagasSnapshot.docs) {
             const vaga = vagaDoc.data();
             const vagaId = vagaDoc.id;
             
             // 3. Buscar TODAS AS CANDIDATURAS para esta VAGA
             const candidaturasSnapshot = await db.collection('candidaturas')
                 .where('vagaId', '==', vagaId)
                 .orderBy('dataCandidatura', 'asc')
                 .get();

             console.log(`[CandidaturasEmpresa - DEBUG] Vaga ID: ${vagaId}, Título: "${vaga.titulo}", Candidaturas encontradas: ${candidaturasSnapshot.size}`);

             const totalCandidatos = candidaturasSnapshot.size;
             
             const vagaStatusText = vaga.status || 'Vaga Ativa';
             const vagaStatusClass = vagaStatusText.toLowerCase().replace(' ', '-');
             
             let candidatosHtml = '';

             if (candidaturasSnapshot.empty) {
                 candidatosHtml = '<p class="no-candidates">Não há candidaturas para esta vaga.</p>';
             } else {
                 
                 // 4. Iterar sobre cada CANDIDATURA para buscar os dados do ALUNO
                 for (const candDoc of candidaturasSnapshot.docs) {
                      const candidatura = candDoc.data();
                      
                      // OBJETO ALUNO COM TODOS OS CAMPOS POSSÍVEIS
                      let aluno = { 
                          nome: 'Aluno Não Encontrado', 
                          email: 'N/A', 
                          telefone: 'N/A', 
                          curso: 'N/A', 
                          cursoNome: 'N/A', // ADICIONANDO CAMPO CURSO NOME
                          area: 'N/A' 
                      };

                      try {
                          if (!candidatura.alunoId) {
                              console.warn(`Candidatura ${candDoc.id} não tem alunoId.`);
                              continue;
                          }
                          
                          const alunoDoc = await db.collection('usuarios').doc(candidatura.alunoId).get();
                          if (alunoDoc.exists) {
                              const alunoData = alunoDoc.data();
                              aluno = { ...aluno, ...alunoData }; 
                              
                              // VERIFICAÇÃO ESPECÍFICA PARA O CURSO
                              if (alunoData.cursoNome) {
                                  aluno.curso = alunoData.cursoNome;
                              } else if (alunoData.curso) {
                                  aluno.curso = alunoData.curso;
                              } else if (alunoData.area) {
                                  aluno.curso = alunoData.area;
                              } else {
                                  aluno.curso = 'Curso não informado';
                              }
                              
                              if (aluno.email === 'N/A' && auth.currentUser) {
                                  aluno.email = auth.currentUser.email;
                              }
                          } else {
                               console.warn(`[CandidaturasEmpresa] Perfil do aluno ${candidatura.alunoId} não encontrado.`);
                          }
                      } catch (e) {
                           console.error("Erro ao buscar perfil do aluno:", candidatura.alunoId, e);
                      }
                      
                      // EXIBINDO O CURSO CORRETAMENTE (LOCAL FOI REMOVIDO)
                      const alunoCurso = aluno.curso || 'Curso não informado';
                      
                      candidatosHtml += `
                           <li class="candidate-card">
                                <div class="candidate-details">
                                    <h4 class="candidate-name">${aluno.nome}</h4>
                                    <p class="candidate-role"><strong>Curso:</strong> ${alunoCurso}</p>
                                    <p class="candidate-contact">
                                         <i data-feather="mail" class="icon-small"></i> <strong>Email:</strong> ${aluno.email}
                                    </p>
                                    <p class="candidate-contact">
                                         <i data-feather="phone" class="icon-small"></i> <strong>Telefone:</strong> ${aluno.telefone}
                                    </p>
                                </div>
                                <button class="view-cv-btn" data-aluno-id="${candidatura.alunoId}">Ver Perfil Completo</button>
                           </li>
                      `;
                 }
                 
                 candidatosHtml = `<ul class="candidate-list">${candidatosHtml}</ul>`;
             }
             
             // 5. Constrói o Item do Acordeão
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

        // 6. Insere o HTML final e configura os listeners
        container.innerHTML = fullHtml;
        if (typeof setupAccordionListeners !== 'undefined') {
             setupAccordionListeners(); 
        }
        if (typeof feather !== 'undefined') {
             feather.replace(); 
        }

    } catch (error) {
        console.error("ERRO FATAL AO CARREGAR CANDIDATURAS PARA EMPRESA:", error);
        
        let errorMessage = 'Não foi possível carregar as candidaturas devido a um erro de conexão ou permissão. ';
        if (error.code && error.code.includes('failed-precondition')) {
             errorMessage += 'Provavelmente **FALTA UM ÍNDICE COMPOSTO** no Firestore (vagaId + dataCandidatura). Verifique o console.';
        } else if (error.code && error.code.includes('permission-denied')) {
             errorMessage += 'Erro de Permissão (Regras de Segurança). Verifique o console.';
        }
        
        container.innerHTML = `<p class="error-message">**${errorMessage}**</p><p>Detalhes técnicos no console (F12).</p>`; 
    }
};

// =================================================================
// LÓGICA DE AUTOCOMPLETE PARA MÚLTIPLOS CURSOS (Não alterada)
// =================================================================

const renderSelectedCourses = () => {
    const container = document.getElementById('cursos-selecionados');
    if (!container) return;

    // Constrói o HTML das tags
    container.innerHTML = selectedCourses.map(course => `
        <span class="course-tag" data-course="${course}">
            ${course}
            <i data-feather="x" class="remove-tag" data-course="${course}"></i>
        </span>
    `).join('');

    // Re-renderizar os ícones do feather
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

const setupCourseAutocomplete = () => {
    // ATENÇÃO: Estes IDs devem ser usados no modal de edição também.
    const input = document.getElementById('curso-vaga'); 
    const suggestionsContainer = document.getElementById('sugestoes-curso-vaga');
    const selectedContainer = document.getElementById('cursos-selecionados');
    
    if (!input || !suggestionsContainer || !selectedContainer) {
        console.warn("Elementos de Autocomplete de Curso não encontrados. Verifique os IDs 'curso-vaga', 'sugestoes-curso-vaga' e 'cursos-selecionados'.");
        return;
    }

    // 1. Lógica do Input (Buscar Sugestões)
    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        suggestionsContainer.innerHTML = '';

        if (query.length === 0) {
            return;
        }

        // AGORA USA availableCourses (Carregado do Firestore)
        const filteredCourses = availableCourses.filter(course => 
            course.toLowerCase().includes(query) && !selectedCourses.includes(course)
        );

        if (filteredCourses.length > 0) {
            filteredCourses.forEach(course => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = course;
                item.addEventListener('click', () => handleCourseSelection(course));
                suggestionsContainer.appendChild(item);
            });
        } else {
            suggestionsContainer.innerHTML = '<div class="autocomplete-item no-results">Nenhum curso encontrado.</div>';
        }
    });
    
    // 2. Lógica de Seleção de Curso
    const handleCourseSelection = (course) => {
        if (!selectedCourses.includes(course)) {
            selectedCourses.push(course);
            renderSelectedCourses();
            input.value = ''; // Limpa o input
            suggestionsContainer.innerHTML = ''; // Esconde as sugestões
        }
    };
    
    // 3. Lógica de Remover Tag (usando delegação de eventos no container)
    selectedContainer.addEventListener('click', (e) => {
        const removeButton = e.target.closest('.remove-tag');
        if (removeButton) {
            const courseToRemove = removeButton.dataset.course;
            selectedCourses = selectedCourses.filter(c => c !== courseToRemove);
            renderSelectedCourses();
            
            // Reabilita o autocomplete, caso o input esteja focado
            const inputEl = document.getElementById('curso-vaga');
            if (inputEl && document.activeElement === inputEl) {
                 inputEl.dispatchEvent(new Event('input'));
            }
        }
    });

    // 4. Fechar Sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            suggestionsContainer.innerHTML = '';
        }
    });
}


// =================================================================
// LÓGICA DO FORMULÁRIO CRIAR VAGA
// =================================================================
const setupCreateJobForm = () => {
    // A lógica de autocomplete foi movida para o onAuthStateChanged
    
    const createJobForm = document.getElementById('create-job-form');
    if (createJobForm) {
        createJobForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (!currentUser) { 
                console.error("Erro: Usuário não autenticado no momento da submissão.");
                return; 
            }
            
            // Validação para garantir que pelo menos um curso foi selecionado
            if (selectedCourses.length === 0) {
                 alert("Por favor, selecione pelo menos um curso requerido para a vaga.");
                 return;
            }

            // Captura o valor do checkbox PCD
            const vagaPCD = document.getElementById('vaga-pcd').checked;

            const vagaData = {
                titulo: document.getElementById('titulo').value,
                descricao: document.getElementById('descricao').value,
                requisitos: document.getElementById('requisitos').value,
                cargaHoraria: document.getElementById('cargaHoraria').value,
                cursosRequeridos: selectedCourses,
                local: document.getElementById('local').value,
                periodo: document.getElementById('periodo').value,
                pcd: vagaPCD, // NOVO CAMPO: Indica se a vaga é para PCD
                empresaId: currentUser.uid, 
                status: 'Vaga Ativa', 
                criadaEm: firebase.firestore.FieldValue.serverTimestamp(),
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            };

            const submitButton = createJobForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Publicando...';

            db.collection('vagas').add(vagaData)
                .then(() => {
                    console.log('Vaga criada com sucesso! Redirecionando...');
                    createJobForm.reset();
                    selectedCourses = []; // Limpa o estado após o envio
                    renderSelectedCourses();
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
            console.warn(`[Atenção] Tentativa de excluir vaga: ${vagaId}. Esta ação deve ter um modal de confirmação.`);
            
            if (!confirm("Tem certeza que deseja excluir esta vaga?")) {
                return;
            }

            db.collection('vagas').doc(vagaId).delete()
                 .then(() => {
                     console.log('Vaga excluída com sucesso! 🗑️');
                     loadCompanyJobs();
                 })
                 .catch(error => {
                     console.error("Erro ao excluir vaga (Verifique as regras de segurança para 'delete'): ", error);
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
                     
                     // Pré-preenchimento do checkbox PCD (se existir no modal)
                     const pcdCheckbox = document.getElementById('edit-vaga-pcd');
                     if (pcdCheckbox) {
                         pcdCheckbox.checked = vaga.pcd || false;
                     }
                     
                     // Pré-preenchimento dos cursos
                     selectedCourses = [];
                     if (vaga.cursosRequeridos && Array.isArray(vaga.cursosRequeridos)) {
                          selectedCourses = [...vaga.cursosRequeridos]; 
                     }
                     renderSelectedCourses(); 
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
            
            // Validação de curso na edição
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
                 // Inclui o campo PCD apenas se o checkbox existir no modal
                 ...(document.getElementById('edit-vaga-pcd') && { 
                     pcd: document.getElementById('edit-vaga-pcd').checked 
                 }),
                 ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp() 
            };

            const submitButton = editForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';

            db.collection('vagas').doc(vagaId).update(updatedData)
                 .then(() => {
                     console.log('Vaga atualizada com sucesso! ✅');
                     editModal.style.display = 'none';
                     
                     // Limpa o estado global após salvar, para não afetar outras ações
                     selectedCourses = [];
                     
                     loadCompanyJobs();
                 })
                 .catch(error => {
                     console.error("Erro ao atualizar vaga (Verifique as regras de segurança para 'update'): ", error);
                 })
                 .finally(() => {
                     submitButton.disabled = false;
                     submitButton.textContent = 'Salvar Alterações';
                 });
        });
    }

    // FECHAR MODAL
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => { editModal.style.display = 'none'; selectedCourses = []; renderSelectedCourses(); });
    }
    if (editModal) {
         editModal.addEventListener('click', (e) => {
             if (e.target.id === 'edit-modal') { editModal.style.display = 'none'; selectedCourses = []; renderSelectedCourses(); }
         });
    }
};


// =================================================================
// PONTO PRINCIPAL: AUTENTICAÇÃO (CONTROLE DE FLUXO)
// =================================================================

auth.onAuthStateChanged(async (user) => { 
    if (user) {
        currentUser = user;
        console.log('Usuário autenticado:', currentUser.uid);

        const currentPath = window.location.pathname;
        
        // CARREGA OS CURSOS E CONFIGURA O AUTOCOMPLETE NAS PÁGINAS NECESSÁRIAS
        if (currentPath.includes('CriarVagaEmpresa.html') || currentPath.includes('MinhasVagas.html')) {
             await loadAvailableCourses(); 
             setupCourseAutocomplete(); 
        }

        if (currentPath.includes('CriarVagaEmpresa.html')) {
            setupCreateJobForm();
        } 
        
        // Outras páginas...
        else if (currentPath.includes('InicialEmpresa.html')) {
            loadDashboardData(currentUser);
        } else if (currentPath.includes('MinhasVagas.html')) {
            loadCompanyJobs();
            setupJobActions();
        } else if (currentPath.includes('EmpresaCandidatos.html')) { 
            loadCandidaciesForCompany();
        }
    } else {
        // Redireciona para o login se não estiver logado
        if (!window.location.pathname.includes('login-empresa.html')) {
            window.location.href = 'login-empresa.html'; 
        }
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
