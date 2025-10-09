// js/aluno.js

const auth = firebase.auth();
const db = firebase.firestore();
let currentCandidate = null;

// =================================================================
// FUNÇÃO PRINCIPAL: CARREGAR VAGAS (ATUALIZADA)
// =================================================================

const loadAvailableJobs = () => {
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer) return;

    vagasContainer.innerHTML = '<p style="color: white; text-align: center;">Buscando vagas...</p>';

    db.collection('vagas')
      .orderBy('criadaEm', 'desc')
      .get()
      .then(snapshot => {
          vagasContainer.innerHTML = '';
          if (snapshot.empty) {
              vagasContainer.innerHTML = '<p class="info-message" style="color: white;">Nenhuma vaga disponível no momento.</p>';
              return;
          }

          snapshot.forEach(doc => {
              const vaga = doc.data();
              const vagaId = doc.id;
              
              // ALTERAÇÃO AQUI: Mudamos de 'div' para 'article' e a classe para 'vaga-card'
              const vagaCard = document.createElement('article');
              vagaCard.className = 'vaga-card'; 
              
              // ALTERAÇÃO AQUI: A estrutura HTML interna agora corresponde ao nosso CSS
              vagaCard.innerHTML = `
                <div class="vaga-info">
                    <h3>${vaga.titulo || 'Título não informado'}</h3>
                    <p class="empresa">${vaga.empresaNome || 'Empresa não informada'}</p>
                    <p class="detalhes">Carga Horária: ${vaga.cargaHoraria || 'Não informada'}</p>
                    <p class="detalhes">Requisitos: ${(vaga.requisitos || '').substring(0, 80)}...</p>
                </div>
                <div class="vaga-action">
                    <a href="#" class="btn-candidatar" data-vaga-id="${vagaId}">Candidatar-se</a>
                </div>
              `;
              vagasContainer.appendChild(vagaCard);
          });
          
          setupCandidacyListeners();
      })
      .catch(error => {
          console.error("Erro ao buscar vagas: ", error);
          vagasContainer.innerHTML = '<p class="error-message" style="color: white;">Erro ao carregar as vagas.</p>';
      });
};

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
            const vagaDoc = await db.collection('vagas').doc(candidatura.vagaId).get();
            if (vagaDoc.exists) {
                return { ...candidatura, vaga: vagaDoc.data() };
            }
            return { ...candidatura, vaga: { titulo: 'Vaga Excluída ou Expirada', empresaNome: 'N/A' } };
        });
        
        const candidaciesDetails = await Promise.all(promises);

        candidaturasContainer.innerHTML = '';

        candidaciesDetails.forEach(item => {
            const vaga = item.vaga;
            
            // ALTERAÇÃO AQUI: Usando 'article' e a classe 'vaga-card'
            const card = document.createElement('article');
            card.className = 'vaga-card';
            
            // ALTERAÇÃO AQUI: Estrutura HTML interna refeita para corresponder ao CSS
            card.innerHTML = `
                <div class="vaga-info">
                    <h3>${vaga.titulo}</h3>
                    <p class="empresa">${vaga.empresaNome}</p>
                    <p class="detalhes">Candidatado em: ${item.dataCandidatura ? new Date(item.dataCandidatura.toDate()).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div class="vaga-action status-display">
                    <span>Status</span>
                    <strong>${item.status || 'Pendente'}</strong>
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
// FUNÇÃO: PROCESSAR CANDIDATURA (AJUSTADA)
// =================================================================

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
// PONTO PRINCIPAL: AUTENTICAÇÃO E ROTEAMENTO (SEM ALTERAÇÕES SIGNIFICATIVAS)
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
            loadAvailableJobs();
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
