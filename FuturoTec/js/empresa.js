// IMPORTANTE: Adicionar esta linha se você não estiver usando um arquivo de módulo
// import { getFirestore, collection, doc, getDoc, query, where, getDocs, updateDoc, deleteDoc, orderBy, FieldValue } from "firebase/firestore";

const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null; // O usuário da empresa autenticado

const logoutBtn = document.querySelector('.logout-btn');

// =================================================================
// FUNÇÕES DE CARREGAMENTO DE DADOS (Dashboard e Minhas Vagas)
// =================================================================

const loadDashboardData = async (user) => {
    const empresaNameEl = document.querySelector('.company-dashboard .container h2');
    const vagasCountEl = document.getElementById('vagas-publicadas-count');
    const candidaturasCountEl = document.getElementById('candidaturas-count');
    
    // 1. Buscar Nome da Empresa
    // CORRIGIDO: Coleção alterada de 'empresas' para 'usuarios' para alinhar com as regras.
    if (empresaNameEl) {
        try {
             // LINHA 27 CORRIGIDA
             const empresaDoc = await db.collection('usuarios').doc(user.uid).get(); 
             if (empresaDoc.exists) {
                 const nomeEmpresa = empresaDoc.data().nome || "Empresa"; // Use 'nome' ou um fallback
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
            vagaIds = vagasSnapshot.docs.map(doc => doc.id); // Guarda os IDs para a próxima contagem
        } catch (error) {
            console.error("Erro ao contar vagas:", error);
            vagasCountEl.textContent = 'ERRO';
        }
    }

    // 3. Contar Candidaturas Recebidas
    // CORRIGIDO: Lógica de contagem alterada para buscar candidaturas por VAGA ID.
    if (candidaturasCountEl) {
        try {
            if (vagaIds.length === 0) {
                 candidaturasCountEl.textContent = '0';
                 return;
            }

            let totalCandidaturas = 0;
            
            // Itera sobre as IDs das vagas da empresa (obtidas no passo 2)
            for (const vagaId of vagaIds) {
                const candidaturasSnapshot = await db.collection('candidaturas')
                     .where('vagaId', '==', vagaId)
                     .get();
                totalCandidaturas += candidaturasSnapshot.size;
            }
            // LINHA 54 CORRIGIDA
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
    
    // === PONTO DE DEBUG CRUCIAL ===
    console.log(`[DEBUG - Buscando Vagas] UID da Empresa logada: ${currentUser.uid}`);
    // =============================

    // A query para listagem de vagas
    db.collection('vagas')
      .where('empresaId', '==', currentUser.uid)
      .orderBy('criadaEm', 'desc') 
      .get()
      .then(snapshot => {
           console.log(`[DEBUG - Sucesso] ${snapshot.size} vagas encontradas para o UID: ${currentUser.uid}`); // DEBUG
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
               vagaCard.appendChild(document.createElement('div')); // Placeholder para corrigir o loop do feather
               vagasContainer.appendChild(vagaCard);
           });
           if (typeof feather !== 'undefined') {
               feather.replace(); 
           }
      })
      .catch(error => {
           // SE ESTE BLOCO FOR ACESSADO, O ERRO É DE PERMISSÃO (REGRAS) OU DE CONEXÃO.
           console.error("ERRO FATAL AO BUSCAR VAGAS. (Verifique o erro abaixo):", error);
           vagasContainer.innerHTML = '<p class="error-message">Ocorreu um erro ao carregar suas vagas. Verifique o **Console do Navegador** para mais detalhes.</p>';
      });
};

// =================================================================
// NOVO: FUNÇÃO PARA CARREGAR CANDIDATURAS AGRUPADAS POR VAGA
// =================================================================

const loadCandidaciesForCompany = async () => {
    const container = document.getElementById('candidaturas-empresa-container');
    
    // NOVO DEBUG CRÍTICO: Verificar se os pré-requisitos estão ok
    console.log(`[CandidaturasEmpresa - DEBUG INICIAL] Container existe: ${!!container}, Usuário logado: ${!!currentUser}`);

    // Usa 'currentUser' para o ID da empresa
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
             // Verifica se o campo 'vagaId' corresponde ao ID da vaga atual.
             const candidaturasSnapshot = await db.collection('candidaturas')
                 .where('vagaId', '==', vagaId)
                 .orderBy('dataCandidatura', 'asc')
                 .get();

             // LOG CRÍTICO ADICIONADO AQUI
             console.log(`[CandidaturasEmpresa - DEBUG] Vaga ID: ${vagaId}, Título: "${vaga.titulo}", Candidaturas encontradas: ${candidaturasSnapshot.size}`);

             const totalCandidatos = candidaturasSnapshot.size;
             
             // Define o status e a classe CSS do cabeçalho da vaga
             const vagaStatusText = vaga.status || 'Vaga Ativa';
             const vagaStatusClass = vagaStatusText.toLowerCase().replace(' ', '-');
             
             let candidatosHtml = '';

             if (candidaturasSnapshot.empty) {
                  candidatosHtml = '<p class="no-candidates">Não há candidaturas para esta vaga.</p>';
             } else {
                 
                 // 4. Iterar sobre cada CANDIDATURA para buscar os dados do ALUNO
                 for (const candDoc of candidaturasSnapshot.docs) {
                     const candidatura = candDoc.data();
                     
                     // Buscar Nome e Detalhes do Aluno (coleção 'usuarios')
                     // INÍCIO DO AJUSTE PARA EXIBIR MAIS DADOS
                     let aluno = { nome: 'Aluno Não Encontrado', email: 'N/A', telefone: 'N/A', cidade: 'N/A', estado: 'N/A', curso: 'N/A', area: 'N/A' };

                     try {
                         // NOVO DEBUG: Verificando se o alunoId está presente
                         if (!candidatura.alunoId) {
                             console.warn(`Candidatura ${candDoc.id} não tem alunoId.`);
                             continue;
                         }
                         
                         const alunoDoc = await db.collection('usuarios').doc(candidatura.alunoId).get();
                         if (alunoDoc.exists) {
                             aluno = { ...aluno, ...alunoDoc.data() }; 
                             // Garante que o email de login esteja disponível se o perfil não tiver o campo
                             if (aluno.email === 'N/A' && auth.currentUser) {
                                 aluno.email = auth.currentUser.email;
                             }
                         } else {
                              console.warn(`[CandidaturasEmpresa] Perfil do aluno ${candidatura.alunoId} não encontrado.`);
                         }
                     } catch (e) {
                         console.error("Erro ao buscar perfil do aluno:", candidatura.alunoId, e);
                     }
                     
                     const alunoCurso = aluno.curso || aluno.area || 'Informação de perfil indisponível'; 
                     const alunoLocalizacao = (aluno.cidade && aluno.estado) ? `${aluno.cidade}, ${aluno.estado}` : 'Localização não informada';
                     
                     // Constrói o card do candidato com os novos campos (Email, Telefone, Localização)
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
                 // FIM DO AJUSTE PARA EXIBIR MAIS DADOS
                 
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
        } // Fim do loop de vagas

        // 6. Insere o HTML final e configura os listeners
        container.innerHTML = fullHtml;
        // Chama a função que configura o comportamento do acordeão (definida no HTML)
        if (typeof setupAccordionListeners !== 'undefined') {
            setupAccordionListeners(); 
        }
        if (typeof feather !== 'undefined') {
            feather.replace(); // Substitui os ícones feather
        }


    } catch (error) {
        // CORREÇÃO: Tratamento de erro mais explícito
        console.error("ERRO FATAL AO CARREGAR CANDIDATURAS PARA EMPRESA:", error);
        
        let errorMessage = 'Não foi possível carregar as candidaturas devido a um erro de conexão ou permissão. ';
        if (error.code && error.code.includes('failed-precondition')) {
            errorMessage += 'Provavelmente **FALTA UM ÍNDICE COMPOSTO** no Firestore (vagaId + dataCandidatura). Verifique o console.';
        } else if (error.code && error.code.includes('permission-denied')) {
            errorMessage += 'Erro de Permissão (Regras de Segurança). Verifique o console.';
        }
        
        container.innerHTML = `<p class="error-message">**${errorMessage}**</p><p>Detalhes técnicos no console (F12).</p>`; // Mudei para negrito para destacar
    }
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
        } else if (currentPath.includes('EmpresaCandidatos.html')) { // <-- NOME CORRIGIDO
            loadCandidaciesForCompany();
        }
        // Adicione outras páginas protegidas aqui

    } else {
        // Redireciona para o login se não houver usuário. 
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

// =================================================================
// LÓGICA DO FORMULÁRIO CRIAR VAGA
// =================================================================
const setupCreateJobForm = () => {
    const createJobForm = document.getElementById('create-job-form');
    if (createJobForm) {
        createJobForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Re-checa se o usuário está setado antes de enviar 
            if (!currentUser) { 
                console.error("Erro: Usuário não autenticado no momento da submissão.");
                return; 
            }

            const vagaData = {
                titulo: document.getElementById('titulo').value,
                descricao: document.getElementById('descricao').value,
                requisitos: document.getElementById('requisitos').value,
                cargaHoraria: document.getElementById('cargaHoraria').value,
                empresaId: currentUser.uid, // Usa o UID do usuário autenticado
                status: 'Vaga Ativa', // Novo campo para rastrear o status
                criadaEm: firebase.firestore.FieldValue.serverTimestamp()
            };

            const submitButton = createJobForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Publicando...';

            db.collection('vagas').add(vagaData)
                .then(() => {
                    console.log('Vaga criada com sucesso! Redirecionando...');
                    createJobForm.reset();
                    window.location.href = 'MinhasVagas.html';
                })
                .catch(error => {
                    // O erro de permissão (se existir) é capturado aqui
                    console.error("Erro ao criar a vaga: ", error); 
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
            // CORRIGIDO: Removido o confirm() nativo. 
            // Em produção, implemente um modal/caixa de diálogo personalizado aqui.
            console.warn(`[Atenção] Tentativa de excluir vaga: ${vagaId}. Esta ação deve ter um modal de confirmação.`);
            
            // Temporariamente, faz a exclusão direta (A SER SUBSTITUÍDO POR UM MODAL CUSTOMIZADO)
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
                    console.log('Vaga atualizada com sucesso! ✅');
                    editModal.style.display = 'none';
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
        cancelEditBtn.addEventListener('click', () => { editModal.style.display = 'none'; });
    }
    if (editModal) {
          editModal.addEventListener('click', (e) => {
              if (e.target.id === 'edit-modal') { editModal.style.display = 'none'; }
          });
    }
};
