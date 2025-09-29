// js/aluno.js

const auth = firebase.auth();
const db = firebase.firestore();
let currentCandidate = null;

// =================================================================
// FUNÇÃO PRINCIPAL: CARREGAR VAGAS
// =================================================================

const loadAvailableJobs = () => {
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer) return;

    vagasContainer.innerHTML = '<p>Buscando vagas...</p>';

    // Permite que qualquer usuário logado leia as vagas (graças à correção nas Regras de Segurança)
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
          
          setupCandidacyListeners(); // Configura os botões após carregar as vagas
      })
      .catch(error => {
          console.error("Erro ao buscar vagas: ", error);
          vagasContainer.innerHTML = '<p class="error-message">Erro ao carregar as vagas.</p>';
      });
};

// =================================================================
// FUNÇÃO: PROCESSAR CANDIDATURA
// =================================================================

const setupCandidacyListeners = () => {
    document.querySelectorAll('.candidatar-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const vagaId = e.target.dataset.vagaId;
            if (!currentCandidate) {
                return alert('Você precisa estar logado para se candidatar!');
            }
            
            // Iniciar o processo de candidatura
            handleCandidacy(vagaId, e.target);
        });
    });
};

const handleCandidacy = async (vagaId, button) => {
    button.disabled = true;
    button.textContent = 'Candidatando...';

    try {
        // 1. Obter detalhes da vaga (para pegar o empresaId e nome)
        const vagaDoc = await db.collection('vagas').doc(vagaId).get();
        if (!vagaDoc.exists) {
            alert('Vaga não encontrada!');
            return;
        }
        const vaga = vagaDoc.data();

        // 2. Verificar se o aluno já se candidatou (opcional, mas recomendado)
        const existingCandidacy = await db.collection('candidaturas')
            .where('alunoId', '==', currentCandidate.uid)
            .where('vagaId', '==', vagaId)
            .get();
            
        if (!existingCandidacy.empty) {
            alert('Você já se candidatou para esta vaga.');
            button.textContent = 'Já Candidatado';
            return;
        }

        // 3. Criar o documento de candidatura
        const candidacyData = {
            vagaId: vagaId,
            alunoId: currentCandidate.uid,
            empresaId: vaga.empresaId, // Chave para a empresa rastrear
            dataCandidatura: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'Pendente' // Novo campo para rastrear status
        };

        await db.collection('candidaturas').add(candidacyData);
        
        alert('Candidatura enviada com sucesso! 🎉');
        button.textContent = 'Candidatura Enviada';

    } catch (error) {
        console.error("Erro ao processar candidatura:", error);
        alert('Ocorreu um erro ao enviar sua candidatura. Verifique as regras de segurança!');
        button.disabled = false;
        button.textContent = 'Candidatar-se';
    }
};

// =================================================================
// PONTO PRINCIPAL: AUTENTICAÇÃO DO ALUNO
// =================================================================

auth.onAuthStateChanged((user) => {
    // ATENÇÃO: Se o aluno tiver uma role diferente da empresa, este IF deve verificar a ROLE.
    // Por exemplo: if (user && user.role === 'aluno') { ... }
    
    if (user) {
        currentCandidate = user;
        
        // Verifica a página atual
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('VagasAluno.html')) {
            loadAvailableJobs();
        }
        // Adicione outras páginas do aluno aqui (ex: MinhasCandidaturas.html)

    } else {
        // Redireciona para o login do aluno se não houver usuário
        window.location.href = 'login-candidato.html'; 
    }
});