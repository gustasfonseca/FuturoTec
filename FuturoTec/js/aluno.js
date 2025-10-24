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

        // **********************************************************
        // *** MODIFICAÇÃO CHAVE: Renderiza Status e Botão ***
        // **********************************************************
        const isVagaAtiva = vaga.status === 'Vaga Ativa';

        let buttonHtml;
        let statusTagHtml;

        if (isVagaAtiva) {
            buttonHtml = `<a href="#" class="btn-candidatar" data-vaga-id="${vagaId}">Candidatar-se</a>`;
            statusTagHtml = '<span class="status-tag active" style="color: #28a745; border: 1px solid #28a745; padding: 3px 6px; border-radius: 4px; font-size: 0.8em; margin-left: 10px;">Vaga Ativa</span>';
        } else {
            // Vaga Finalizada, Encerrada, etc.
            const statusDisplay = vaga.status || 'Vaga Finalizada';
            buttonHtml = `<a href="#" class="btn-candidatar disabled" data-vaga-id="${vagaId}" style="background-color: #aaa; pointer-events: none;">${statusDisplay}</a>`;
            statusTagHtml = `<span class="status-tag inactive" style="color: #dc3545; border: 1px solid #dc3545; padding: 3px 6px; border-radius: 4px; font-size: 0.8em; margin-left: 10px;">${statusDisplay}</span>`;
        }
        // **********************************************************

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

        return `
            <article class="vaga-card">
                <div class="vaga-info">
                    <h3>${vaga.titulo || 'Título não informado'} ${statusTagHtml}</h3>
                    <p class="empresa">Empresa: ${nomeEmpresa}</p>
                    <p class="detalhes">Descrição: ${vaga.descricao || 'Descrição não informada'}</p>
                    <p class="detalhes">Curso: ${cursosDisplay}</p>
                    <p class="detalhes">Carga Horária: ${vaga.cargaHoraria || 'Não informada'}</p>
                    <p class="detalhes">Requisitos: ${vaga.requisitos || 'Não informado'}</p>
                    <p class="detalhes">Período: ${vaga.periodo || 'Não informado'}</p>
                </div>
                <div class="vaga-action">
                    ${buttonHtml}
                </div>
            </article>
        `;
    });

    vagasContainer.innerHTML = allJobCardsHtml.join('');
    setupCandidacyListeners();
}

// =================================================================
// FUNÇÃO: REALIZAR FILTRO E PESQUISA LOCAL
// =================================================================
const filterAndSearchJobs = () => {
    const filtroCurso = document.getElementById('filtroCurso').value.toLowerCase().trim();
    const pesquisaVaga = document.getElementById('pesquisaVaga').value.toLowerCase().trim();

    // NOTA: Agora, allVagasData pode conter vagas ativas e finalizadas
    let filteredJobs = allVagasData;

    if (filtroCurso) {
        filteredJobs = filteredJobs.filter(item => {
            const cursos = item.vaga.cursosRequeridos;
            if (!cursos) return false;

            if (Array.isArray(cursos)) {
                return cursos.some(dbCourse => dbCourse.toLowerCase().trim().includes(filtroCurso));
            } else if (typeof cursos === 'string') {
                return cursos.toLowerCase().trim().includes(filtroCurso);
            }
            return false;
        });
    }

    if (pesquisaVaga) {
        filteredJobs = filteredJobs.filter(item => {
            const tituloVaga = item.vaga.titulo ? item.vaga.titulo.toLowerCase() : '';
            const nomeEmpresa = item.nomeEmpresaLowerCase;
            return tituloVaga.includes(pesquisaVaga) || nomeEmpresa.includes(pesquisaVaga);
        });
    }

    // Opcional: Filtra para mostrar APENAS vagas ativas e finalizadas, ignorando vagas sem status
    filteredJobs = filteredJobs.filter(item => item.vaga.status);

    renderJobs(filteredJobs);
};

// =================================================================
// FUNÇÃO PRINCIPAL: CARREGAR TODAS AS VAGAS
// =================================================================
const loadAvailableJobs = async () => {
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer) return;

    vagasContainer.innerHTML = '<p style="color: white; text-align: center;">Buscando vagas...</p>';
    allVagasData = [];

    try {
        // **********************************************************
        // *** MODIFICAÇÃO CHAVE: Remove filtro de status para ver Finalizadas ***
        // **********************************************************
        // Se a empresa usar 'status: Finalizada', a vaga aparecerá com o status correto no renderJobs
        const snapshot = await db.collection('vagas').orderBy('criadaEm', 'desc').get();

        if (snapshot.empty) {
            vagasContainer.innerHTML = '<p class="info-message" style="color: white;">Nenhuma vaga disponível no momento.</p>';
            return;
        }

        const jobsWithCompanyNamesPromises = snapshot.docs.map(async doc => {
            const vaga = doc.data();
            const vagaId = doc.id;
            const nomeEmpresaInfo = await getCompanyName(vaga.empresaId);
            return {
                vagaId,
                vaga: { ...vaga, status: vaga.status || 'Vaga Ativa' }, // Garante que a vaga tenha um status padrão se ausente
                nomeEmpresaCompleto: nomeEmpresaInfo.nomeCompleto,
                nomeEmpresaLowerCase: nomeEmpresaInfo.nomeLowerCase,
            };
        });

        allVagasData = await Promise.all(jobsWithCompanyNamesPromises);
        renderJobs(allVagasData);

    } catch (error) {
        console.error("Erro ao buscar vagas: ", error);
        vagasContainer.innerHTML = '<p class="error-message" style="color: white;">Erro ao carregar as vagas.</p>';
    };
};

// =================================================================
// EVENT LISTENER PARA FILTROS
// =================================================================
const setupFilterListeners = () => {
    const aplicarFiltrosButton = document.getElementById('aplicarFiltros');
    if (aplicarFiltrosButton) {
        aplicarFiltrosButton.addEventListener('click', filterAndSearchJobs);
    }
}

// =================================================================
// FUNÇÃO: CARREGAR MINHAS CANDIDATURAS
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

        const promises = candidaciesSnapshot.docs.map(async (doc) => {
            const candidatura = doc.data();
            const vagaDoc = await db.collection('vagas').doc(candidatura.vagaId).get();
            let vagaData = { titulo: 'Vaga Excluída ou Expirada', empresaId: null, status: 'Vaga Desconhecida' };

            if (vagaDoc.exists) {
                vagaData = vagaDoc.data();
                // Garante que o status da vaga seja carregado
                vagaData.status = vagaData.status || 'Vaga Ativa';
            }

            const nomeEmpresaInfo = await getCompanyName(vagaData.empresaId);
            return {
                ...candidatura,
                vaga: {
                    ...vagaData,
                    empresaNome: nomeEmpresaInfo.nomeCompleto
                }
            };
        });

        const candidaciesDetails = await Promise.all(promises);
        candidaturasContainer.innerHTML = '';

        candidaciesDetails.forEach(item => {
            const vaga = item.vaga;

            // **********************************************************
            // *** MODIFICAÇÃO CHAVE: Exibe Status da Candidatura e da Vaga ***
            // **********************************************************
            let displayStatus = item.status || 'Pendente';
            let statusClass = 'status-default';

            if (vaga.status !== 'Vaga Ativa') {
                // Se a vaga foi encerrada pela empresa
                displayStatus = vaga.status === 'Finalizada' ? 'Vaga Finalizada' : 'Vaga Encerrada';
                statusClass = 'status-closed';
            } else if (item.status === 'Pendente') {
                statusClass = 'status-pending';
            } else if (item.status === 'Entrevista') {
                statusClass = 'status-interview';
            } else if (item.status === 'Contratado') {
                statusClass = 'status-hired';
            }
            // **********************************************************

            const card = document.createElement('article');
            card.className = 'vaga-card';

            card.innerHTML = `
                <div class="vaga-info">
                    <h3>${vaga.titulo}</h3>
                    <p class="empresa">Empresa: ${vaga.empresaNome}</p>
                    <p class="detalhes">Candidatado em: ${item.dataCandidatura ? new Date(item.dataCandidatura.toDate()).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div class="vaga-action status-display ${statusClass}">
                    <span>Status</span>
                    <strong>${displayStatus}</strong>
                </div>
            `;
            candidaturasContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar candidaturas:", error);
        candidaturasContainer.innerHTML = '<p class="error-message">Não foi possível carregar suas candidaturas.</p>';
    }
};

// =================================================================
// SETUP CANDIDACY BUTTONS
// =================================================================
const setupCandidacyListeners = () => {
    document.querySelectorAll('.btn-candidatar').forEach(button => {
        // Ignora botões já desabilitados
        if (button.classList.contains('disabled') || button.textContent === 'Vaga Finalizada') return;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            const vagaId = e.target.dataset.vagaId;
            if (!currentCandidate) return alert('Você precisa estar logado para se candidatar!');
            handleCandidacy(vagaId, e.target);
        });
    });
};

const handleCandidacy = async (vagaId, button) => {
    button.style.pointerEvents = 'none';
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

        // **********************************************************
        // *** MODIFICAÇÃO CHAVE: Verifica Status Final antes de candidatar ***
        // **********************************************************
        if (vaga.status !== 'Vaga Ativa') {
            alert('Esta vaga não está mais aceitando candidaturas. Status: ' + (vaga.status || 'Vaga Finalizada'));
            button.textContent = vaga.status || 'Vaga Finalizada';
            button.style.pointerEvents = 'none'; // Impede novas tentativas
            return;
        }
        // **********************************************************

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
// AUTENTICAÇÃO E ROTEAMENTO
// =================================================================
auth.onAuthStateChanged((user) => {
    if (user) {
        currentCandidate = user;

        const logoutButton = document.querySelector('.logout-btn');
        if (logoutButton && !logoutButton.dataset.listenerAttached) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                auth.signOut().then(() => {
                    window.location.href = 'index.html';
                });
            });
            logoutButton.dataset.listenerAttached = 'true';
        }

        const currentPath = window.location.pathname;

        if (currentPath.includes('VagasAluno.html')) {
            loadAvailableJobs().then(setupFilterListeners);
        }

        if (currentPath.includes('minhasCandidaturas.html')) {
            loadMyCandidacies();
        }

    } else {
        const protectedPaths = ['VagasAluno.html', 'minhasCandidaturas.html', 'PerfilAluno.html'];
        const currentPath = window.location.pathname.split('/').pop();
        if (protectedPaths.includes(currentPath)) window.location.href = 'index.html';
    }
});
