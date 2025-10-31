// js/aluno.js

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
        vagasContainer.innerHTML = '<p class="info-message" style="color: white; text-align: center; padding: 40px;">Nenhuma vaga encontrada com os filtros/pesquisa atuais.</p>';
        return;
    }

    const allJobCardsHtml = vagasToRender.map(item => {
        const vaga = item.vaga;
        const vagaId = item.vagaId;
        const nomeEmpresa = item.nomeEmpresaCompleto;
        const isVagaAtiva = vaga.status === 'Vaga Ativa' || vaga.status === 'Ativa';

        // Badge PCD
        const pcdBadge = vaga.pcd ? '<span class="pcd-badge">Vaga PCD</span>' : '';

        const buttonHtml = isVagaAtiva
            ? `<a href="#" class="btn-candidatar" data-vaga-id="${vagaId}">Candidatar-se</a>`
            : `<a href="#" class="btn-candidatar disabled" data-vaga-id="${vagaId}" style="background-color: #aaa; pointer-events: none;">${vaga.status || 'Vaga Finalizada'}</a>`;

        const statusTagHtml = isVagaAtiva
            ? '<span class="status-tag active">Vaga Ativa</span>'
            : `<span class="status-tag inactive">${vaga.status || 'Vaga Finalizada'}</span>`;

        const cursosDisplay = vaga.cursosRequeridos
            ? (Array.isArray(vaga.cursosRequeridos) ? vaga.cursosRequeridos.join(', ') : vaga.cursosRequeridos)
            : 'Não informado';

        const localDisplay = vaga.local || 'Não informado'; 
        const periodoDisplay = vaga.periodo || 'Não informado';

        return `
            <article class="vaga-card">
                <div class="vaga-info">
                    <h3>${vaga.titulo || 'Título não informado'} ${statusTagHtml} ${pcdBadge}</h3>
                    <p class="empresa">Empresa: ${nomeEmpresa}</p>
                    <p class="detalhes">Descrição: ${vaga.descricao || 'Descrição não informada'}</p>
                    <p class="detalhes">Curso: ${cursosDisplay}</p>
                    <p class="detalhes">Carga Horária: ${vaga.cargaHoraria || 'Não informada'}</p>
                    <p class="detalhes">Requisitos: ${vaga.requisitos || 'Não informado'}</p>
                    <p class="detalhes"><strong>Período:</strong> ${periodoDisplay}</p>
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
        const snapshot = await db.collection('vagas')
            .where('status', '==', 'Vaga Ativa') 
            .orderBy('titulo') 
            .get();

        if (snapshot.empty) {
            vagasContainer.innerHTML = '<p class="info-message" style="color: white; text-align: center; padding: 40px;">Nenhuma vaga disponível no momento.</p>';
            return;
        }

        const jobsWithCompanyNamesPromises = snapshot.docs.map(async doc => {
            const vaga = doc.data();
            const vagaId = doc.id;

            // Garantir valores padrão
            if (!vaga.hasOwnProperty('local') || !vaga.local) {
                vaga.local = 'Não informado';
            }
            if (!vaga.hasOwnProperty('periodo') || !vaga.periodo) {
                vaga.periodo = 'Não informado';
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
        vagasContainer.innerHTML = '<p class="error-message" style="color: white; text-align: center; padding: 40px;">Erro ao carregar as vagas. Verifique suas regras de segurança do Firestore e os índices necessários.</p>';
    }
};

// =================================================================
// FILTRO E PESQUISA (CORRIGIDO)
// =================================================================
const filterAndSearchJobs = () => {
    const filtroCurso = document.getElementById('filtroCurso').value.toLowerCase().trim();
    const pesquisaVaga = document.getElementById('pesquisaVaga').value.toLowerCase().trim();
    
    console.log('Aplicando filtros:', { filtroCurso, pesquisaVaga }); // Debug
    
    let filteredJobs = allVagasData;

    // Filtro por curso - CORREÇÃO: busca exata no array de cursos
    if (filtroCurso) {
        filteredJobs = filteredJobs.filter(item => {
            const cursos = item.vaga.cursosRequeridos;
            if (!cursos) return false;
            
            if (Array.isArray(cursos)) {
                // Verifica se algum curso do array contém o filtro
                return cursos.some(c => c.toLowerCase().includes(filtroCurso));
            } else if (typeof cursos === 'string') {
                return cursos.toLowerCase().includes(filtroCurso);
            }
            return false;
        });
    }

    // Filtro por pesquisa (vaga/empresa) - CORREÇÃO: busca mais abrangente
    if (pesquisaVaga) {
        filteredJobs = filteredJobs.filter(item => {
            const tituloVaga = item.vaga.titulo?.toLowerCase() || '';
            const nomeEmpresa = item.nomeEmpresaLowerCase;
            const descricaoVaga = item.vaga.descricao?.toLowerCase() || '';
            
            return tituloVaga.includes(pesquisaVaga) || 
                   nomeEmpresa.includes(pesquisaVaga) ||
                   descricaoVaga.includes(pesquisaVaga);
        });
    }

    console.log('Vagas filtradas:', filteredJobs.length); // Debug
    renderJobs(filteredJobs);
};

const setupFilterListeners = () => {
    const aplicarFiltrosButton = document.getElementById('aplicarFiltros');
    if (aplicarFiltrosButton) {
        aplicarFiltrosButton.addEventListener('click', filterAndSearchJobs);
        console.log('Listener do botão aplicado'); // Debug
    }

    // Adicionar eventos para aplicar filtros automaticamente
    const filtroCurso = document.getElementById('filtroCurso');
    const pesquisaVaga = document.getElementById('pesquisaVaga');
    
    if (filtroCurso) {
        filtroCurso.addEventListener('change', filterAndSearchJobs);
    }
    
    if (pesquisaVaga) {
        pesquisaVaga.addEventListener('input', filterAndSearchJobs);
    }
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
            if (!currentCandidate) return alert('Você precisa estar logado para se candidatar!');
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
            alert('Vaga não encontrada!');
            return;
        }
        const vaga = vagaDoc.data();
        if (vaga.status !== 'Vaga Ativa') {
            alert('Esta vaga não está mais ativa.');
            button.textContent = 'Vaga Finalizada';
            return;
        }
        const existing = await db.collection('candidaturas')
            .where('alunoId', '==', currentCandidate.uid)
            .where('vagaId', '==', vagaId).get();
        if (!existing.empty) {
            alert('Você já se candidatou para esta vaga.');
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
        alert('Candidatura enviada com sucesso!');
        button.textContent = 'Candidatura Enviada';
    } catch (e) {
        console.error(e);
        alert('Erro ao enviar candidatura.');
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
        if (path.includes('VagasAluno.html')) {
            loadAvailableJobs().then(() => {
                setupFilterListeners();
                console.log('Filtros configurados'); // Debug
            });
        }
        
    } else {
        const protectedPaths = ['VagasAluno.html', 'minhasCandidaturas.html', 'PerfilAluno.html'];
        const currentPage = window.location.pathname.split('/').pop();
        if (protectedPaths.includes(currentPage)) window.location.href = 'index.html';
    }
});
