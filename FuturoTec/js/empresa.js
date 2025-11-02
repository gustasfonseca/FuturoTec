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
        const vagasSnapshot = await db.collection('vagas')
             .where('empresaId', '==', currentUser.uid)
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
                      let aluno = { 
                          nome: 'Aluno Não Encontrado', 
                          email: 'N/A', 
                          telefone: 'N/A', 
                          curso: 'N/A', 
                          cursoNome: 'N/A',
                          area: 'N/A',
                          resumoHabilidades: 'Não informado',
                          experienciasProfissionais: 'Não informado',
                          linkedin: ''
                      };

                      try {
                          if (!candidatura.alunoId) continue;
                          const alunoDoc = await db.collection('usuarios').doc(candidatura.alunoId).get();
                          if (alunoDoc.exists) {
                              const alunoData = alunoDoc.data();
                              aluno = { ...aluno, ...alunoData }; 
                              if (alunoData.cursoNome) aluno.curso = alunoData.cursoNome;
                              else if (alunoData.curso) aluno.curso = alunoData.curso;
                              else if (alunoData.area) aluno.curso = alunoData.area;
                              else aluno.curso = 'Curso não informado';
                              if (aluno.email === 'N/A' && auth.currentUser) aluno.email = auth.currentUser.email;
                          }
                      } catch (e) {
                           console.error("Erro ao buscar perfil do aluno:", candidatura.alunoId, e);
                      }
                      
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
                                    <p class="candidate-contact">
                                         <i data-feather="linkedin" class="icon-small"></i> <strong>LinkedIn:</strong> 
                                         ${aluno.linkedin ? `<a href="${aluno.linkedin}" target="_blank">${aluno.linkedin}</a>` : 'Não informado'}
                                    </p>
                                    <div class="candidate-full-info">
                                        <div class="info-section">
                                            <h5>📝 Resumo de Habilidades</h5>
                                            <p class="info-content">${aluno.resumoHabilidades || 'Não informado'}</p>
                                        </div>
                                        <div class="info-section">
                                            <h5>💼 Experiências Profissionais</h5>
                                            <p class="info-content">${aluno.experienciasProfissionais || 'Não informado'}</p>
                                        </div>
                                    </div>
                                </div>
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
        container.innerHTML = `<p class="error-message">Não foi possível carregar as candidaturas. Verifique o console para detalhes.</p>`; 
    }
};

// =================================================================
// LOGOUT
// =================================================================

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        auth.signOut()
           .then(() => {
               window.location.href = 'login.html';
           })
           .catch(err => console.error("Erro ao fazer logout:", err));
    });
}

// =================================================================
// INICIALIZAÇÃO
// =================================================================

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loadAvailableCourses();
        loadDashboardData(user);
        loadCompanyJobs();
        loadCandidaciesForCompany();
    } else {
        window.location.href = 'login.html';
    }
});
