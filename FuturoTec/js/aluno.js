// js/aluno.js

import { showAlert } from './alert-manager.js';

const auth = firebase.auth();
const db = firebase.firestore();
let currentCandidate = null;
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
// FUNÇÃO PARA RENDERIZAR VAGAS
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
        const isVagaAtiva = vaga.status === 'Vaga Ativa';

        const buttonHtml = isVagaAtiva
            ? `<a href="#" class="btn-candidatar" data-vaga-id="${vagaId}">Candidatar-se</a>`
            : `<a href="#" class="btn-candidatar disabled" data-vaga-id="${vagaId}" style="background-color: #aaa; pointer-events: none;">${vaga.status || 'Vaga Finalizada'}</a>`;

        const statusTagHtml = isVagaAtiva
            ? '<span class="status-tag active" style="color: #28a745; border: 1px solid #28a745; padding: 3px 6px; border-radius: 4px; font-size: 0.8em; margin-left: 10px;">Vaga Ativa</span>'
            : `<span class="status-tag inactive" style="color: #dc3545; border: 1px solid #dc3545; padding: 3px 6px; border-radius: 4px; font-size: 0.8em; margin-left: 10px;">${vaga.status || 'Vaga Finalizada'}</span>`;

        const cursosDisplay = vaga.cursosRequeridos
            ? (Array.isArray(vaga.cursosRequeridos) ? vaga.cursosRequeridos.join(', ') : vaga.cursosRequeridos)
            : 'Não informado';

        const localDisplay = vaga.local || 'Não informado'; 

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
                    <p class="detalhes">Local: ${localDisplay}</p>
                </div>
                <div class="vaga-action">
                    ${buttonHtml}
                </div>
            </article>
        `;
    });

    vagasContainer.innerHTML = allJobCardsHtml.join('');
    setupCandidacyListeners();
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
        const snapshot = await db.collection('vagas').orderBy('criadaEm', 'desc').get();

        if (snapshot.empty) {
            vagasContainer.innerHTML = '<p class="info-message" style="color: white;">Nenhuma vaga disponível no momento.</p>';
            return;
        }

        const jobsWithCompanyNamesPromises = snapshot.docs.map(async doc => {
            const vaga = doc.data();
            const vagaId = doc.id;

            // 🔹 Garantir que o campo 'local' sempre exista
            if (!vaga.hasOwnProperty('local') || !vaga.local) {
                vaga.local = 'Não informado';
            }

            const nomeEmpresaInfo = await getCompanyName(vaga.empresaId);
            return {
                vagaId,
                vaga: { ...vaga, status: vaga.status || 'Vaga Ativa' },
                nomeEmpresaCompleto: nomeEmpresaInfo.nomeCompleto,
                nomeEmpresaLowerCase: nomeEmpresaInfo.nomeLowerCase,
            };
        });

        const allVagas = await Promise.all(jobsWithCompanyNamesPromises);

        allVagasData = allVagas.filter(item =>
            item.vaga.status === 'Vaga Ativa' || item.vaga.status === 'Ativa'
        );

        renderJobs(allVagasData);

    } catch (error) {
        console.error("Erro ao buscar vagas: ", error);
        vagasContainer.innerHTML = '<p class="error-message" style="color: white;">Erro ao carregar as vagas.</p>';
    }
};

// =================================================================
// FILTRO E PESQUISA
// =================================================================
const filterAndSearchJobs = () => {
    const filtroCurso = document.getElementById('filtroCurso').value.toLowerCase().trim();
    const pesquisaVaga = document.getElementById('pesquisaVaga').value.toLowerCase().trim();
    let filteredJobs = allVagasData;

    if (filtroCurso) {
        filteredJobs = filteredJobs.filter(item => {
            const cursos = item.vaga.cursosRequeridos;
            if (!cursos) return false;
            if (Array.isArray(cursos))
                return cursos.some(c => c.toLowerCase().includes(filtroCurso));
            else if (typeof cursos === 'string')
                return cursos.toLowerCase().includes(filtroCurso);
            return false;
        });
    }

    if (pesquisaVaga) {
        filteredJobs = filteredJobs.filter(item => {
            const tituloVaga = item.vaga.titulo?.toLowerCase() || '';
            const nomeEmpresa = item.nomeEmpresaLowerCase;
            return tituloVaga.includes(pesquisaVaga) || nomeEmpresa.includes(pesquisaVaga);
        });
    }

    renderJobs(filteredJobs);
};

const setupFilterListeners = () => {
    const aplicarFiltrosButton = document.getElementById('aplicarFiltros');
    if (aplicarFiltrosButton)
        aplicarFiltrosButton.addEventListener('click', filterAndSearchJobs);
};

// =================================================================
// CANDIDATURA
// =================================================================
const setupCandidacyListeners = () => {
    document.querySelectorAll('.btn-candidatar').forEach(button => {
        if (button.classList.contains('disabled') || button.textContent === 'Vaga Finalizada') return;
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            const vagaId = e.target.dataset.vagaId;
            // SUBSTITUIÇÃO DO ALERT
            if (!currentCandidate) return showAlert('Você precisa estar logado para se candidatar!', 'info');
            await handleCandidacy(vagaId, e.target);
        });
    });
};

const handleCandidacy = async (vagaId, button) => {
    button.style.pointerEvents = 'none';
    button.textContent = 'Candidatando...';
    try {
        const vagaDoc = await db.collection('vagas').doc(vagaId).get();
        if (!vagaDoc.exists) {
            // SUBSTITUIÇÃO DO ALERT
            showAlert('Vaga não encontrada!', 'error');
            return;
        }
        const vaga = vagaDoc.data();
        if (vaga.status !== 'Vaga Ativa') {
            // SUBSTITUIÇÃO DO ALERT
            showAlert('Esta vaga não está mais ativa.', 'info');
            button.textContent = 'Vaga Finalizada';
            return;
        }
        const existing = await db.collection('candidaturas')
            .where('alunoId', '==', currentCandidate.uid)
            .where('vagaId', '==', vagaId).get();
        if (!existing.empty) {
            // SUBSTITUIÇÃO DO ALERT
            showAlert('Você já se candidatou para esta vaga.', 'info');
            button.textContent = 'Já Candidatado';
            return;
        }
        await db.collection('candidaturas').add({
            vagaId,
            alunoId: currentCandidate.uid,
            empresaId: vaga.empresaId,
            dataCandidatura: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'Pendente'
        });
        
        // SUBSTITUIÇÃO DO ALERT
        showAlert('Candidatura enviada com sucesso!', 'success');
        button.textContent = 'Candidatura Enviada';
    } catch (e) {
        console.error(e);
        // SUBSTITUIÇÃO DO ALERT
        showAlert('Erro ao enviar candidatura.', 'error');
    } finally {
        button.style.pointerEvents = 'auto';
    }
};

// =================================================================
// AUTENTICAÇÃO
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

        const path = window.location.pathname;
        if (path.includes('VagasAluno.html')) loadAvailableJobs().then(setupFilterListeners);
        if (path.includes('minhasCandidaturas.html')) loadMyCandidacies?.();
    } else {
        const protectedPaths = ['VagasAluno.html', 'minhasCandidaturas.html', 'PerfilAluno.html'];
        const currentPage = window.location.pathname.split('/').pop();
        if (protectedPaths.includes(currentPage)) window.location.href = 'index.html';
    }
});
