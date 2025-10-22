// js/aluno.js

const auth = firebase.auth();
const db = firebase.firestore();
let currentCandidate = null;

// Armazenar todas as vagas com nomes de empresa para filtrar localmente
let allVagasData = []; 

// =================================================================
// FUNÇÃO AUXILIAR PARA BUSCAR O NOME DA EMPRESA
// =================================================================
const getCompanyName = async (empresaId) => {
    if (!empresaId) return 'Empresa não informada';
    try {
        const empresaDoc = await db.collection('usuarios').doc(empresaId).get();
        if (empresaDoc.exists) {
            // Incluímos o nome em minúsculas para facilitar a pesquisa local
            const nome = empresaDoc.data().nome || 'Empresa Desconhecida (Nome Ausente)';
            return {
                nomeCompleto: nome, 
                nomeLowerCase: nome.toLowerCase()
            };
        }
        return {
            nomeCompleto: 'Empresa Não Encontrada', 
            nomeLowerCase: 'empresa não encontrada'
        };
    } catch (error) {
        console.error("Erro ao buscar nome da empresa:", empresaId, error);
        return {
            nomeCompleto: 'Erro ao Carregar Nome da Empresa', 
            nomeLowerCase: 'erro ao carregar nome da empresa'
        };
    }
};


// =================================================================
// NOVO: FUNÇÃO PARA EXCLUIR CANDIDATURA (Desistir ou Limpar Vaga Excluída)
// POSICIONADA AQUI PARA EVITAR O ReferenceError
// =================================================================
const handleCandidacyDeletion = async (candidacyId, cardElement) => {
    if (!currentCandidate) {
        alert('Você precisa estar logado para realizar esta ação!');
        return;
    }

    if (!confirm('Tem certeza que deseja desistir desta candidatura? Esta ação é irreversível e irá removê-la da lista de candidatos da empresa.')) {
        return;
    }

    // Desabilita o card para evitar múltiplos cliques
    cardElement.style.opacity = 0.5;
    cardElement.style.pointerEvents = 'none';

    try {
        // 1. Apaga o documento de candidatura no Firestore
        await db.collection('candidaturas').doc(candidacyId).delete();

        // 2. Remove o card da interface após o sucesso
        cardElement.remove();
        alert('Candidatura removida com sucesso! 🎉');
        
        // Opcional: Verifica se não restou nenhuma candidatura
        const candidaturasContainer = document.getElementById('candidaturas-container');
        if (candidaturasContainer && candidaturasContainer.children.length === 0) {
            candidaturasContainer.innerHTML = '<p class="info-message">Você ainda não se candidatou a nenhuma vaga.</p>';
        }

    } catch (error) {
        console.error("Erro ao excluir candidatura:", error);
        alert('Erro ao excluir a candidatura. Tente novamente.');
        // Reativa o card em caso de erro
        cardElement.style.opacity = 1;
        cardElement.style.pointerEvents = 'auto';
    }
};


// =================================================================
// FUNÇÃO PARA RENDERIZAR VAGAS (COM DESCRIÇÃO DA VAGA)
// =================================================================
const renderJobs = (vagasToRender) => {
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer) return;

    if (vagasToRender.length === 0) {
        vagasContainer.innerHTML = '<p class="info-message" style="color: white;">Nenhuma vaga encontrada com os filtros/pesquisa atuais.</p>';
        return;
    }

    const allJobCardsHtml = vagasToRender.map(item => {
        const vaga = item.vaga;
        const vagaId = item.vagaId;
        const nomeEmpresa = item.nomeEmpresaCompleto;
        
        // Tratamento do campo 'cursosRequeridos' (mantido)
        let cursosData = vaga.cursosRequeridos; 
        let cursosDisplay = 'Não informado'; 

        if (cursosData) {
            let tempDisplay;
            
            if (Array.isArray(cursosData)) {
                tempDisplay = cursosData.join(', ').trim(); 
            } else if (typeof cursosData === 'string') {
                tempDisplay = cursosData.trim();
            }

            if (tempDisplay && tempDisplay !== '') {
                cursosDisplay = tempDisplay;
            }
        }
        
        // Monta o HTML do cartão de vaga
        return `
            <article class="vaga-card">
                <div class="vaga-info">
                    <h3>${vaga.titulo || 'Título não informado'}</h3>
                    <p class="empresa">Empresa: ${nomeEmpresa}</p>
                    
                    <p class="detalhes">Descrição: ${vaga.descricao || 'Descrição não informada'}</p>
                    
                    <p class="detalhes">Curso: ${cursosDisplay}</p>
                    <p class="detalhes">Carga Horária: ${vaga.cargaHoraria || 'Não informada'}</p>
                    <p class="detalhes">Requisitos: ${vaga.requisitos || 'Não informado'}</p>
                </div>
                <div class="vaga-action">
                    <a href="#" class="btn-candidatar" data-vaga-id="${vagaId}">Candidatar-se</a>
                </div>
            </article>
        `;
    });

    vagasContainer.innerHTML = allJobCardsHtml.join('');
    setupCandidacyListeners();
}

// =================================================================
// FUNÇÃO: REALIZAR FILTRO E PESQUISA LOCAL (CORRIGIDA E ROBUSTA)
// =================================================================
const filterAndSearchJobs = () => {
    // Normaliza o filtro do curso (para minúsculo e sem espaços)
    const filtroCurso = document.getElementById('filtroCurso').value.toLowerCase().trim();
    // Normaliza a pesquisa de texto
    const pesquisaVaga = document.getElementById('pesquisaVaga').value.toLowerCase().trim();

    let filteredJobs = allVagasData;

    // 1. FILTRO POR CURSO
    if (filtroCurso) {
        filteredJobs = filteredJobs.filter(item => {
            const cursos = item.vaga.cursosRequeridos; 
            if (!cursos) {
                return false; 
            }
            
            if (Array.isArray(cursos)) {
                // Usa .some() para verificar se PELO MENOS UM curso no array
                // (após normalização) inclui o texto do filtro.
                return cursos.some(dbCourse => 
                    dbCourse.toLowerCase().trim().includes(filtroCurso)
                );
            } else if (typeof cursos === 'string') {
                // Se for string, verifica se a string normalizada inclui o filtro.
                return cursos.toLowerCase().trim().includes(filtroCurso);
            }
            return false;
        });
    }

    // 2. PESQUISA POR NOME DA VAGA OU EMPRESA (Local)
    if (pesquisaVaga) {
        filteredJobs = filteredJobs.filter(item => {
            const tituloVaga = item.vaga.titulo ? item.vaga.titulo.toLowerCase() : '';
            const nomeEmpresa = item.nomeEmpresaLowerCase;

            // Mantém a lógica de pesquisa de texto
            return tituloVaga.includes(pesquisaVaga) || nomeEmpresa.includes(pesquisaVaga);
        });
    }

    // 3. RENDERIZA OS RESULTADOS FILTRADOS
    renderJobs(filteredJobs);
};


// =================================================================
// FUNÇÃO PRINCIPAL: CARREGAR TODAS AS VAGAS (Para cache local)
// =================================================================

const loadAvailableJobs = async () => {
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer) return;

    vagasContainer.innerHTML = '<p style="color: white; text-align: center;">Buscando vagas...</p>';
    allVagasData = []; // Limpa o cache anterior

    try {
        // Busca todas as vagas do Firestore
        const snapshot = await db.collection('vagas')
            .orderBy('criadaEm', 'desc')
            .get(); 

        if (snapshot.empty) {
            vagasContainer.innerHTML = '<p class="info-message" style="color: white;">Nenhuma vaga disponível no momento.</p>';
            return;
        }

        // 1. Cria um array de Promises para buscar o nome da empresa para cada vaga
        const jobsWithCompanyNamesPromises = snapshot.docs.map(async doc => {
            const vaga = doc.data();
            const vagaId = doc.id;

            // 2. Chama a função auxiliar e AGUARDA o resultado do nome da empresa
            const nomeEmpresaInfo = await getCompanyName(vaga.empresaId);

            // 3. Retorna o objeto completo da vaga para o cache local
            return {
                vagaId,
                vaga,
                nomeEmpresaCompleto: nomeEmpresaInfo.nomeCompleto,
                nomeEmpresaLowerCase: nomeEmpresaInfo.nomeLowerCase,
            };
        });

        // 4. AGUARDA que todas as promises sejam resolvidas 
        allVagasData = await Promise.all(jobsWithCompanyNamesPromises);

        // 5. RENDERIZA TODAS AS VAGAS NA CARGA INICIAL (sem filtros)
        renderJobs(allVagasData);

    } catch(error) {
        console.error("Erro ao buscar vagas: ", error);
        vagasContainer.innerHTML = '<p class="error-message" style="color: white;">Erro ao carregar as vagas.</p>';
    };
};


// =================================================================
// NOVO: Adiciona o Event Listener para os Filtros
// =================================================================

const setupFilterListeners = () => {
    const aplicarFiltrosButton = document.getElementById('aplicarFiltros');
    if (aplicarFiltrosButton) {
        // Usamos 'click' no botão para disparar a função
        aplicarFiltrosButton.addEventListener('click', filterAndSearchJobs);
    }
}

// =================================================================
// FUNÇÃO: CARREGAR MINHAS CANDIDATURAS (ATUALIZADA)
// =================================================================

const loadMyCandidacies = async () => {
    const candidaturasContainer = document.getElementById('candidaturas-container');
    if (!candidaturasContainer) return;

    candidaturasContainer.innerHTML = '<p class="info-message">Carregando suas candidaturas...</p>';

    if (!currentCandidate) {
        candidaturasContainer.innerHTML = '<p class="error-message">Erro: Usuário não autenticado.</p>';
        return;
    }

    try {
        const candidaciesSnapshot = await db.collection('candidaturas')
            .where('alunoId', '==', currentCandidate.uid)
            .orderBy('dataCandidatura', 'desc')
            .get();

        if (candidaciesSnapshot.empty) {
            candidaturasContainer.innerHTML = '<p class="info-message">Você ainda não se candidatou a nenhuma vaga.</p>';
            return;
        }

        // Usamos Promise.all para carregar todas as vagas em paralelo (mais rápido)
        const promises = candidaciesSnapshot.docs.map(async (doc) => {
            const candidatura = doc.data();
            const candidaturaId = doc.id; // Pegando o ID da candidatura!
            
            const vagaDoc = await db.collection('vagas').doc(candidatura.vagaId).get();

            // Usamos null se a vaga não existe
            let vagaData = null; 

            if (vagaDoc.exists) {
                vagaData = vagaDoc.data();
            }

            // Se a vaga não existe, retornamos null para o filtro
            if (!vagaData) {
                return null; 
            }

            // BUSCA O NOME DA EMPRESA AQUI TAMBÉM
            const nomeEmpresaInfo = await getCompanyName(vagaData.empresaId);

            return { 
                ...candidatura, 
                candidaturaId: candidaturaId, // Inclui o ID da candidatura no objeto
                vaga: { 
                    ...vagaData, 
                    empresaNome: nomeEmpresaInfo.nomeCompleto 
                } 
            };
        });

        const candidaciesDetailsWithNulls = await Promise.all(promises);

        // MODIFICAÇÃO CHAVE 1: Filtra as vagas que retornaram null (Vagas Excluídas/Expiradas)
        const candidaciesDetails = candidaciesDetailsWithNulls.filter(item => item !== null);

        candidaturasContainer.innerHTML = '';

        if (candidaciesDetails.length === 0) {
            candidaturasContainer.innerHTML = '<p class="info-message">Você ainda não se candidatou a nenhuma vaga ou todas as vagas pendentes foram excluídas.</p>';
            return;
        }


        candidaciesDetails.forEach(item => {
            const vaga = item.vaga;
            const candidaturaId = item.candidaturaId; // Pega o ID da candidatura
            
            // FIX ADICIONAL: Tratamento do status para estilização futura (opcional, mas recomendado)
            const statusClass = item.status === 'Pendente' ? 'status-pending' 
                                 : item.status === 'Entrevista' ? 'status-interview' 
                                 : item.status === 'Contratado' ? 'status-hired' : 'status-default';

            const card = document.createElement('article');
            card.className = 'vaga-card';
            card.dataset.candidacyId = candidaturaId; // Adiciona o ID da candidatura ao card

            card.innerHTML = `
                <div class="vaga-info">
                    <h3>${vaga.titulo}</h3>
                    <p class="empresa">Empresa: ${vaga.empresaNome}</p>
                    <p class="detalhes">Candidatado em: ${item.dataCandidatura ? new Date(item.dataCandidatura.toDate()).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div class="vaga-action status-display ${statusClass}">
                    <span>Status</span>
                    <strong>${item.status || 'Pendente'}</strong>
                    <button class="btn-desistir" data-candidacy-id="${candidaturaId}">Desistir/Excluir</button>
                </div>
            `;
            candidaturasContainer.appendChild(card);
            
            // Adiciona o listener de evento ao novo botão
            // ATENÇÃO: É aqui que a função handleCandidacyDeletion é chamada
            card.querySelector('.btn-desistir').addEventListener('click', (e) => {
                e.preventDefault();
                const cardElement = e.target.closest('.vaga-card');
                handleCandidacyDeletion(candidaturaId, cardElement);
            });
        });

    } catch (error) {
        console.error("Erro ao carregar candidaturas:", error);
        candidaturasContainer.innerHTML = '<p class="error-message">Não foi possível carregar suas candidaturas.</p>';
    }
};


// ... (o restante do seu aluno.js: setupCandidacyListeners, handleCandidacy) ...
const setupCandidacyListeners = () => {
    // ALTERAÇÃO AQUI: O seletor agora busca pela classe .btn-candidatar
    document.querySelectorAll('.btn-candidatar').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Impede o link de navegar
            const vagaId = e.target.dataset.vagaId;
            if (!currentCandidate) {
                return alert('Você precisa estar logado para se candidatar!');
            }
            handleCandidacy(vagaId, e.target);
        });
    });
};

const handleCandidacy = async (vagaId, button) => {
    button.style.pointerEvents = 'none'; // Desabilita o clique no link
    button.textContent = 'Candidatando...';

    try {
        const vagaDoc = await db.collection('vagas').doc(vagaId).get();
        if (!vagaDoc.exists) {
            alert('Vaga não encontrada!');
            button.style.pointerEvents = 'auto';
            button.textContent = 'Candidatar-se';
            return;
        }
        const vaga = vagaDoc.data();

        const existingCandidacy = await db.collection('candidaturas')
            .where('alunoId', '==', currentCandidate.uid)
            .where('vagaId', '==', vagaId)
            .get();

        if (!existingCandidacy.empty) {
            alert('Você já se candidatou para esta vaga.');
            button.textContent = 'Já Candidatado';
            return;
        }

        const candidacyData = {
            vagaId: vagaId,
            alunoId: currentCandidate.uid,
            empresaId: vaga.empresaId,
            dataCandidatura: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'Pendente'
        };

        await db.collection('candidaturas').add(candidacyData);

        alert('Candidatura enviada com sucesso! 🎉');
        button.textContent = 'Candidatura Enviada';

    } catch (error) {
        console.error("Erro ao processar candidatura:", error);
        alert('Ocorreu um erro ao enviar sua candidatura.');
        button.style.pointerEvents = 'auto';
        button.textContent = 'Candidatar-se';
    }
};

// =================================================================
// PONTO PRINCIPAL: AUTENTICAÇÃO E ROTEAMENTO (ADICIONANDO setupFilterListeners)
// =================================================================

auth.onAuthStateChanged((user) => {
    if (user) {
        currentCandidate = user;

        const logoutButton = document.querySelector('.logout-btn');
        if (logoutButton) {
            // Previne adicionar múltiplos listeners se o script rodar mais de uma vez
            if (!logoutButton.dataset.listenerAttached) {
                logoutButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    auth.signOut().then(() => {
                        window.location.href = 'index.html';
                    });
                });
                logoutButton.dataset.listenerAttached = 'true';
            }
        }

        const currentPath = window.location.pathname;

        if (currentPath.includes('VagasAluno.html')) {
            // Inicializa a função de carregamento e, se bem-sucedida, o listener de filtros
            loadAvailableJobs().then(setupFilterListeners); 
        }

        if (currentPath.includes('minhasCandidaturas.html')) {
            loadMyCandidacies();
        }

    } else {
        // Protegendo as páginas internas
        const protectedPaths = ['VagasAluno.html', 'minhasCandidaturas.html', 'PerfilAluno.html'];
        const currentPath = window.location.pathname.split('/').pop();

        if (protectedPaths.includes(currentPath)) {
            window.location.href = 'index.html';
        }
    }
});
