// js/aluno.js

const auth = firebase.auth();
const db = firebase.firestore();
let currentCandidate = null;

// =================================================================
// FUNÇÃO PRINCIPAL: CARREGAR VAGAS (JÁ EXISTENTE)
// =================================================================

const loadAvailableJobs = () => {
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer) return;

    vagasContainer.innerHTML = '<p>Buscando vagas...</p>';

    db.collection('vagas')
      .orderBy('criadaEm', 'desc') 
      .get()
      .then(snapshot => {
          vagasContainer.innerHTML = ''; 
          if (snapshot.empty) {
              vagasContainer.innerHTML = '<p class="info-message">Nenhuma vaga disponível no momento.</p>';
              return;
          }

          snapshot.forEach(doc => {
              const vaga = doc.data();
              const vagaId = doc.id;
              
              const vagaCard = document.createElement('div');
              vagaCard.className = 'job-card';
              vagaCard.innerHTML = `
                  <h3 class="job-title">${vaga.titulo}</h3>
                  <p class="company-name">${vaga.empresaNome || 'Empresa'}</p>
                  <p class="job-description">${vaga.descricao.substring(0, 150)}...</p>
                  <ul class="job-details">
                    <li>Carga Horária: ${vaga.cargaHoraria}</li>
                    <li>Requisitos: ${vaga.requisitos.substring(0, 80)}...</li>
                  </ul>
                  <button class="candidatar-btn" data-vaga-id="${vagaId}">Candidatar-se</button>
              `;
              vagasContainer.appendChild(vagaCard);
          });
          
          setupCandidacyListeners(); 
      })
      .catch(error => {
          console.error("Erro ao buscar vagas: ", error);
          vagasContainer.innerHTML = '<p class="error-message">Erro ao carregar as vagas.</p>';
      });
};

// =================================================================
// FUNÇÃO: CARREGAR MINHAS CANDIDATURAS (NOVA FUNÇÃO CRUCIAL)
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
        // 1. Buscar as candidaturas do aluno logado
        const candidaciesSnapshot = await db.collection('candidaturas')
            .where('alunoId', '==', currentCandidate.uid)
            .orderBy('dataCandidatura', 'desc')
            .get();

        if (candidaciesSnapshot.empty) {
            candidaturasContainer.innerHTML = '<p class="info-message">Você ainda não se candidatou a nenhuma vaga.</p>';
            return;
        }
        
        const candidaciesDetails = [];
        
        // 2. Iterar sobre cada candidatura e buscar os detalhes da vaga (para exibir)
        for (const doc of candidaciesSnapshot.docs) {
            const candidatura = doc.data();
            const vagaId = candidatura.vagaId;
            
            const vagaDoc = await db.collection('vagas').doc(vagaId).get();
            
            if (vagaDoc.exists) {
                const vaga = vagaDoc.data();
                candidaciesDetails.push({
                    ...candidatura, 
                    vaga: vaga
                });
            } else {
                candidaciesDetails.push({
                    ...candidatura,
                    vaga: { titulo: 'Vaga Excluída ou Expirada', empresaNome: 'N/A' }
                });
            }
        }

        // 3. Renderizar as candidaturas
        candidaturasContainer.innerHTML = ''; 

        candidaciesDetails.forEach(item => {
            const vaga = item.vaga;
            const card = document.createElement('div');
            card.className = 'candidacy-card'; // Use esta classe para estilizar
            card.innerHTML = `
                <h3 class="job-title">${vaga.titulo}</h3>
                <p class="company-name">Empresa: ${vaga.empresaNome || 'Não Informada'}</p>
                <p class="candidacy-status">Status: <strong>${item.status || 'Pendente'}</strong></p>
                <p class="candidacy-date">Candidatado em: ${item.dataCandidatura ? new Date(item.dataCandidatura.toDate()).toLocaleDateString() : 'N/A'}</p>
                <p class="candidacy-info">${vaga.requisitos ? vaga.requisitos.substring(0, 50) + '...' : ''}</p>
            `;
            candidaturasContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar candidaturas:", error);
        candidaturasContainer.innerHTML = '<p class="error-message">Não foi possível carregar suas candidaturas.</p>';
    }
};

// =================================================================
// FUNÇÃO: PROCESSAR CANDIDATURA (JÁ EXISTENTE)
// =================================================================

const setupCandidacyListeners = () => {
    document.querySelectorAll('.candidatar-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const vagaId = e.target.dataset.vagaId;
            if (!currentCandidate) {
                return alert('Você precisa estar logado para se candidatar!');
            }
            handleCandidacy(vagaId, e.target);
        });
    });
};

const handleCandidacy = async (vagaId, button) => {
    button.disabled = true;
    button.textContent = 'Candidatando...';

    try {
        const vagaDoc = await db.collection('vagas').doc(vagaId).get();
        if (!vagaDoc.exists) {
            alert('Vaga não encontrada!');
            button.disabled = false;
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
        button.disabled = false;
        button.textContent = 'Candidatar-se';
    }
};

// =================================================================
// PONTO PRINCIPAL: AUTENTICAÇÃO E ROTEAMENTO
// =================================================================

auth.onAuthStateChanged((user) => {
    if (user) {
        currentCandidate = user;
        
        // Redirecionamento de Logout
        const logoutButton = document.querySelector('.logout-btn');
        if (logoutButton) { // Verifica se o botão existe antes de adicionar o listener
             logoutButton.addEventListener('click', () => {
                 auth.signOut().then(() => {
                    window.location.href = 'login-candidato.html'; 
                 });
            });
        }

        // Verifica a página atual para chamar a função correta
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('VagasAluno.html')) {
            loadAvailableJobs();
        }
        
        if (currentPath.includes('minhasCandidaturas.html')) {
            loadMyCandidacies(); // <--- AGORA ESTÁ CHAMANDO A FUNÇÃO CORRETA!
        }

    } else {
        // Redireciona para o login do aluno se não houver usuário
        window.location.href = 'login-candidato.html'; 
    }
});
