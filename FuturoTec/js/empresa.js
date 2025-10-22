// empresa.js
let currentUser = null;
let selectedCourses = [];
let availableCourses = [];

// Assume-se que 'auth', 'db' e 'firebase' estão globalmente disponíveis (carregados via script em seus HTMLs)
// Ex: <script src="https://www.gstatic.com/firebasejs/.../firebase-app.js"></script>

const logoutBtn = document.querySelector('.logout-btn');
// =================================================================
// FUNÇÃO PARA CARREGAR OS CURSOS DO FIRESTORE
// =================================================================
const loadAvailableCourses = async () => {
    try {
        console.log("[Cursos] Buscando cursos na coleção 'cursos'...");
        // db.collection('cursos') deve ser acessível globalmente
        const snapshot = await db.collection('cursos').get();
        // Filtra para garantir que apenas nomes válidos sejam incluídos
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
            
            // Nota: Este loop pode ser ineficiente para muitas vagas. 
            // Uma Query Collection Group seria mais escalável se fosse usada uma estrutura 
            // diferente ou se 'candidaturas' fosse uma subcoleção.
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
             // feather.replace() deve ser acessível globalmente (carregado via script em seus HTMLs)
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
             .orderBy('criadaEm', 'desc')
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
                      
                      let aluno = { nome: 'Aluno Não Encontrado', email: 'N/A', telefone: 'N/A', cidade: 'N/A', estado: 'N/A', curso: 'N/A', area: 'N/A' };

                      try {
                          if (!candidatura.alunoId) {
                              console.warn(`Candidatura ${candDoc.id} não tem alunoId.`);
                              continue;
                          }
                          
                          const alunoDoc = await db.collection('usuarios').doc(candidatura.alunoId).get();
                          if (alunoDoc.exists) {
                              aluno = { ...aluno, ...alunoDoc.data() }; 
                              if (aluno.email === 'N/A' && auth.currentUser) {
                                  // Linha comentada na lógica original: 
                                  // aluno.email = auth.currentUser.email; 
                              }
                          } else {
                               console.warn(`[CandidaturasEmpresa] Perfil do aluno ${candidatura.alunoId} não encontrado.`);
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
                                          <i data-feather="phone" class="icon-small"></i> **Telefone:** ${aluno.telefone}
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
        // As funções setupAccordionListeners e feather.replace() devem ser acessíveis
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
// FUNÇÕES DE PERFIL DA EMPRESA (PerfilEmpresa.html)
// =================================================================
const loadAndSetupProfile = async (user) => {
    // Referências aos elementos HTML
    const userNameElement = document.getElementById('user-name'); 
    const userEmailElement = document.getElementById('user-email'); 
    const inputEmail = document.getElementById('email'); 
    const inputNomeEmpresa = document.getElementById('nome-empresa'); 
    const inputCnpj = document.getElementById('cnpj-empresa'); 
    const profileForm = document.getElementById('profile-form-empresa'); 
    const btnExcluir = document.getElementById('btn-excluir-conta-empresa');
    // NOVO: Referência ao botão de logout na Danger Zone
    const btnLogoutDanger = document.getElementById('btn-logout-danger-zone');

    // 1. CARREGAR DADOS
    if (inputEmail && inputNomeEmpresa && inputCnpj && userNameElement && userEmailElement) {
        try {
            const docRef = db.collection('usuarios').doc(user.uid);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                const data = docSnap.data();
                
                // Preencher a seção de resumo
                userNameElement.textContent = data.nome || 'Nome não definido';
                userEmailElement.textContent = user.email;

                // Preencher o formulário
                inputEmail.value = user.email; // Email do Auth (campo desabilitado)
                inputNomeEmpresa.value = data.nome || '';
                inputCnpj.value = data.cnpj || '';

            } else {
                userNameElement.textContent = 'Perfil Incompleto';
                userEmailElement.textContent = user.email;
                inputEmail.value = user.email;
                console.warn("Perfil da empresa não encontrado no Firestore, mas usuário está logado.");
            }

        } catch (error) {
            console.error("Erro ao carregar os dados do perfil:", error);
        }
    }
    
    // 2. CONFIGURAR O FORMULÁRIO DE EDIÇÃO (Salvar Alterações)
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentUser = auth.currentUser;
            if (!currentUser) {
                alert("Nenhum usuário logado. Por favor, faça login novamente.");
                return;
            }

            const nomeAtualizado = inputNomeEmpresa.value.trim();
            const cnpjAtualizado = inputCnpj.value.trim();

            if (!nomeAtualizado || !cnpjAtualizado) {
                 alert("Nome da Empresa e CNPJ são obrigatórios.");
                 return;
            }
            // Validação simples de 14 dígitos numéricos
            if (cnpjAtualizado.length !== 14 || isNaN(cnpjAtualizado)) {
                 alert("O CNPJ deve ter 14 dígitos e conter somente números.");
                 return;
            }

            const submitButton = profileForm.querySelector('.save-button');
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';

            try {
                // firebase.firestore.FieldValue deve ser acessível globalmente
                await db.collection('usuarios').doc(currentUser.uid).update({
                    nome: nomeAtualizado,
                    cnpj: cnpjAtualizado,
                    dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                if(userNameElement) userNameElement.textContent = nomeAtualizado; // Atualiza o resumo
                alert('✅ Perfil atualizado com sucesso!');

            } catch (error) {
                console.error("Erro ao salvar o perfil:", error);
                alert(`❌ Erro ao salvar as alterações: ${error.message}`);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Salvar Alterações';
            }
        });
    }
    
    // 3. LÓGICA DO BOTÃO DE EXCLUIR CONTA
    // Assume-se que a função 'excluirContaEmpresa' está definida em auth-empresa.js
    if (btnExcluir && typeof excluirContaEmpresa !== 'undefined') {
        btnExcluir.addEventListener('click', () => { 
             excluirContaEmpresa(user); 
        });
    } else if (btnExcluir) {
        console.warn("Atenção: A função 'excluirContaEmpresa' não foi encontrada. O botão de exclusão de conta pode não funcionar.");
    }
    
    // 4. LÓGICA DO BOTÃO DE LOGOUT NA DANGER ZONE (NOVO)
    if (btnLogoutDanger) {
        btnLogoutDanger.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                window.location.href = 'login-empresa.html';
            }).catch(error => {
                console.error("Erro ao fazer logout:", error);
                alert("Ocorreu um erro ao tentar fazer logout. Verifique sua conexão.");
            });
        });
    }

};

// =================================================================
// LÓGICA DE AUTOCOMPLETE PARA MÚLTIPLOS CURSOS 
// =================================================================

const renderSelectedCourses = () => {
    // ATENÇÃO: Esta função deve ser usada para renderizar *tanto* no form Criar Vaga *quanto* no modal de Edição.
    // Os containers devem ter o mesmo ID: 'cursos-selecionados' (no HTML principal e no modal).
    
    const container = document.getElementById('cursos-selecionados');
    // Adiciona o suporte para o container de edição (caso seja um modal com ID diferente, ajuste aqui)
    const containerEdit = document.getElementById('cursos-selecionados-edit') || container;
    
    // Define qual container deve ser usado (prioriza o da página se não for o modal)
    const targetContainer = document.getElementById('edit-modal') && document.getElementById('edit-modal').style.display === 'flex' 
        ? document.getElementById('cursos-selecionados-edit') || container 
        : container;

    if (!targetContainer) return;

    // Constrói o HTML das tags
    targetContainer.innerHTML = selectedCourses.map(course => `
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
    
    // Elementos para o modal de edição (se existirem)
    const inputEdit = document.getElementById('edit-curso-vaga'); 
    const suggestionsContainerEdit = document.getElementById('edit-sugestoes-curso-vaga');
    const selectedContainerEdit = document.getElementById('edit-cursos-selecionados');

    // Array de pares [input, suggestionsContainer, selectedContainer] para iterar
    const setupElements = [
        [input, suggestionsContainer, selectedContainer],
        [inputEdit, suggestionsContainerEdit, selectedContainerEdit]
    ].filter(arr => arr[0]); // Filtra os que têm input

    if (setupElements.length === 0) {
        console.warn("Elementos de Autocomplete de Curso não encontrados. Verifique os IDs 'curso-vaga' (e seus equivalentes 'edit-').");
        return;
    }

    // Lógica de Seleção de Curso
    const handleCourseSelection = (course, inputEl, suggestionsEl) => {
        if (!selectedCourses.includes(course)) {
            selectedCourses.push(course);
            renderSelectedCourses();
            inputEl.value = ''; // Limpa o input
            suggestionsEl.innerHTML = ''; // Esconde as sugestões
        }
    };
    
    setupElements.forEach(([inputEl, suggestionsEl, selectedEl]) => {
        if (!inputEl) return;
        
        // 1. Lógica do Input (Buscar Sugestões)
        inputEl.addEventListener('input', () => {
            const query = inputEl.value.toLowerCase().trim();
            suggestionsEl.innerHTML = '';

            if (query.length === 0) {
                return;
            }

            // Usa availableCourses (Carregado do Firestore)
            const filteredCourses = availableCourses.filter(course => 
                course.toLowerCase().includes(query) && !selectedCourses.includes(course)
            );

            if (filteredCourses.length > 0) {
                filteredCourses.forEach(course => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.textContent = course;
                    // Passa os elementos específicos para a função de seleção
                    item.addEventListener('click', () => handleCourseSelection(course, inputEl, suggestionsEl));
                    suggestionsEl.appendChild(item);
                });
            } else {
                suggestionsEl.innerHTML = '<div class="autocomplete-item no-results">Nenhum curso encontrado.</div>';
            }
        });
        
        // 3. Lógica de Remover Tag (usando delegação de eventos no container)
        // Adicionada a verificação para garantir que o evento só é anexado uma vez
        if (selectedEl) {
             selectedEl.addEventListener('click', (e) => {
                const removeButton = e.target.closest('.remove-tag');
                if (removeButton) {
                    const courseToRemove = removeButton.dataset.course;
                    selectedCourses = selectedCourses.filter(c => c !== courseToRemove);
                    renderSelectedCourses();
                    
                    // Reabilita o autocomplete, caso o input esteja focado
                    if (document.activeElement === inputEl) {
                         inputEl.dispatchEvent(new Event('input'));
                    }
                }
            });
        }
        
        // 4. Fechar Sugestões ao clicar fora
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-container') && suggestionsEl) {
                 suggestionsEl.innerHTML = '';
            }
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
            
            if (!currentUser) { 
                console.error("Erro: Usuário não autenticado no momento da submissão.");
                alert("Erro de autenticação. Tente recarregar a página.");
                return; 
            }
            
            // Validação para garantir que pelo menos um curso foi selecionado
            if (selectedCourses.length === 0) {
                 alert("Por favor, selecione pelo menos um curso requerido para a vaga.");
                 return;
            }

            const vagaData = {
                titulo: document.getElementById('titulo').value,
                descricao: document.getElementById('descricao').value,
                requisitos: document.getElementById('requisitos').value,
                cargaHoraria: document.getElementById('cargaHoraria').value,
                cursosRequeridos: selectedCourses, // <<=== ARRAY DE CURSOS
                empresaId: currentUser.uid, 
                status: 'Vaga Ativa', 
                // firebase.firestore.FieldValue deve ser acessível globalmente
                criadaEm: firebase.firestore.FieldValue.serverTimestamp() 
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
                      // Preenche o formulário
                      document.getElementById('edit-vaga-id').value = vagaId;
                      document.getElementById('edit-titulo').value = vaga.titulo;
                      document.getElementById('edit-descricao').value = vaga.descricao;
                      document.getElementById('edit-requisitos').value = vaga.requisitos;
                      document.getElementById('edit-cargaHoraria').value = vaga.cargaHoraria;
                      
                      // **PRÉ-PREENCHIMENTO DOS CURSOS**
                      // 1. Limpa o estado global
                      selectedCourses = [];
                      
                      // 2. Popula com os cursos da vaga, se existirem
                      if (vaga.cursosRequeridos && Array.isArray(vaga.cursosRequeridos)) {
                           // Cria uma cópia para o array global ser manipulado pelo modal
                           selectedCourses = [...vaga.cursosRequeridos]; 
                      }
                      
                      // 3. Renderiza as tags no modal (usa o ID 'edit-cursos-selecionados' se definido no modal)
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
                 cursosRequeridos: selectedCourses, // **SALVA OS CURSOS EDITADOS**
                 // firebase.firestore.FieldValue deve ser acessível globalmente
                 ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp() 
            };

            const submitButton = editForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';

            db.collection('vagas').doc(vagaId).update(updatedData)
                 .then(() => {
                      console.log('Vaga atualizada com sucesso! ✅');
                      editModal.style.display = 'none';
                      
                      // Limpa o estado global após salvar
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
    const closeModal = () => {
         if (editModal) {
             editModal.style.display = 'none'; 
             selectedCourses = []; 
             renderSelectedCourses(); // Limpa as tags no DOM
         }
    };
    
    if (cancelEditBtn) {
         cancelEditBtn.addEventListener('click', closeModal);
    }
    if (editModal) {
          editModal.addEventListener('click', (e) => {
               if (e.target.id === 'edit-modal') { 
                 closeModal();
               }
           });
    }
};


// =================================================================
// PONTO PRINCIPAL: AUTENTICAÇÃO (CONTROLE DE FLUXO)
// =================================================================

// Correção: Assume-se que 'auth' e 'db' são declaradas em outro arquivo e estão globalmente acessíveis.
// Esta função é o coração do roteamento e carregamento de dados
auth.onAuthStateChanged(async (user) => { 
    if (user) {
        currentUser = user;
        console.log('Usuário autenticado:', currentUser.uid);

        const currentPath = window.location.pathname;
        
        // 1. CARREGA OS CURSOS e configura o AUTOCOMPLETE APENAS nas páginas que precisam
        if (currentPath.includes('CriarVagaEmpresa.html') || currentPath.includes('MinhasVagas.html')) {
             await loadAvailableCourses(); 
             setupCourseAutocomplete(); 
        }

        // 2. CHAMA AS FUNÇÕES ESPECÍFICAS DE CADA PÁGINA
        if (currentPath.includes('CriarVagaEmpresa.html')) {
            setupCreateJobForm();
        } 
        else if (currentPath.includes('InicialEmpresa.html')) {
            loadDashboardData(currentUser);
        } else if (currentPath.includes('MinhasVagas.html')) {
            loadCompanyJobs();
            setupJobActions();
        } else if (currentPath.includes('EmpresaCandidatos.html')) { 
            loadCandidaciesForCompany();
        } 
        else if (currentPath.includes('PerfilEmpresa.html')) {
            loadAndSetupProfile(currentUser);
        }
    } else {
        // Redireciona para o login se não estiver logado, exceto se já estiver na página de login
        if (!window.location.pathname.includes('login-empresa.html')) {
            window.location.href = 'login-empresa.html'; 
        }
    }
});

// Lógica de Logout (Para o botão de logout padrão no cabeçalho/navegação com a classe .logout-btn)
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // auth.signOut() deve ser acessível globalmente
        auth.signOut().then(() => { 
            window.location.href = 'login-empresa.html'; 
        }).catch(error => {
            console.error("Erro ao fazer logout:", error);
            alert("Ocorreu um erro ao tentar fazer logout. Verifique sua conexão.");
        });
    });
}
