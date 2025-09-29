// js/empresa.js - VERSÃO COMPLETA E FINAL

const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let allCourses = []; // Lista completa de cursos (como "Design gráfico")
let selectedCourses = []; // Array de cursos {id, nome} para a vaga sendo criada/editada

const logoutBtn = document.querySelector('.logout-btn');

// Variável para controlar a instância do autocomplete de edição/criação
let autocompleteControls = {}; 

// =================================================================
// 1. GESTÃO DOS CURSOS (Lógica de Múltipla Seleção e Tags)
// =================================================================

/**
 * Carrega todos os cursos do Firestore.
 */
const loadAllCoursesFromFirestore = async () => {
    try {
        const snapshot = await db.collection('cursos').get();
        allCourses = snapshot.docs.map(doc => ({
            id: doc.id,
            nome: doc.data().nome
        }));
    } catch (error) {
        console.error("Erro ao carregar os cursos do Firestore:", error);
    }
};

/**
 * Configura o campo de autocomplete para múltiplos cursos.
 * Retorna um objeto com a função 'render' para atualizar as tags.
 */
const setupCourseAutocomplete = (inputID, suggestionsID, selectedContainerID) => {
    const cursoInput = document.getElementById(inputID);
    const sugestoesContainer = document.getElementById(suggestionsID);
    const selectedContainer = document.getElementById(selectedContainerID);

    if (!cursoInput || !sugestoesContainer || !selectedContainer) {
        return { render: () => {} };
    }

    // Função que renderiza visualmente as tags (chips) dos cursos selecionados
    const renderSelectedCourses = () => {
        selectedContainer.innerHTML = '';
        if (selectedCourses.length === 0) {
            selectedContainer.innerHTML = '<span class="info-tag">Nenhum curso selecionado.</span>';
            // Validação no input, baseada no array global
            cursoInput.setCustomValidity('É obrigatório selecionar pelo menos um curso.');
        } else {
            cursoInput.setCustomValidity('');
        }

        selectedCourses.forEach(course => {
            const tag = document.createElement('span');
            tag.className = 'course-tag';
            tag.innerHTML = `${course.nome} <span class="remove-tag" data-id="${course.id}">&times;</span>`;
            selectedContainer.appendChild(tag);
        });

        selectedContainer.querySelectorAll('.remove-tag').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const idToRemove = e.target.getAttribute('data-id');
                selectedCourses = selectedCourses.filter(c => c.id !== idToRemove);
                renderSelectedCourses(); // Atualiza a lista visual
            });
        });
    };
    
    renderSelectedCourses(); 

    const showSuggestions = (filtro) => {
        sugestoesContainer.innerHTML = ''; 
        const value = filtro.trim();
        
        if (value.length < 2) return; 

        const selectedIds = selectedCourses.map(c => c.id);
        let filteredCourses = allCourses.filter(course =>
            course.nome.toLowerCase().includes(value.toLowerCase()) && !selectedIds.includes(course.id)
        );
        
        if (filteredCourses.length === 0) {
            sugestoesContainer.innerHTML = '<div class="autocomplete-item no-results">Nenhum curso encontrado</div>';
            return;
        }

        filteredCourses.slice(0, 5).forEach(course => { 
            const item = document.createElement('div');
            item.className = 'autocomplete-item'; 
            item.textContent = course.nome;
            item.setAttribute('data-id', course.id);
            item.addEventListener('mousedown', (e) => {
                e.preventDefault(); 
                
                selectedCourses.push({ id: course.id, nome: course.nome });
                
                renderSelectedCourses(); 
                
                cursoInput.value = ''; 
                sugestoesContainer.innerHTML = ''; 
                cursoInput.focus(); 
            });
            sugestoesContainer.appendChild(item);
        });
    };

    cursoInput.addEventListener('input', () => {
        showSuggestions(cursoInput.value);
    });
    
    cursoInput.addEventListener('blur', () => {
        setTimeout(() => {
            sugestoesContainer.innerHTML = '';
        }, 200);
    });

    return { render: renderSelectedCourses };
};

// =================================================================
// 2. FUNÇÕES DE CARREGAMENTO E EDIÇÃO DE VAGAS
// =================================================================

/**
 * Carrega as vagas da empresa atual e exibe os cards com botões de ação.
 */
const loadCompanyJobs = () => {
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer || !currentUser) return;

    vagasContainer.innerHTML = '<p>Carregando suas vagas...</p>';

    // Esta consulta agora funcionará corretamente com o índice ATIVADO
    db.collection('vagas')
      .where('empresaId', '==', currentUser.uid)
      .orderBy('criadaEm', 'desc')
      .get()
      .then(snapshot => {
          vagasContainer.innerHTML = ''; 
          if (snapshot.empty) {
              vagasContainer.innerHTML = '<p class="info-message">Você ainda não publicou nenhuma vaga. <a href="CriarVagaEmpresa.html">Crie sua primeira vaga aqui.</a></p>';
              return;
          }
          snapshot.forEach(doc => {
              const vaga = doc.data();
              const vagaId = doc.id;
              
              const cursosNomes = vaga.cursosRequeridos 
                ? vaga.cursosRequeridos.map(c => c.nome).join(', ') 
                : 'Não especificado';
              
              const vagaCard = document.createElement('div');
              vagaCard.className = 'vaga-card';
              vagaCard.innerHTML = `
                  <h3 class="job-title">${vaga.titulo}</h3>
                  <p class="job-course">Cursos: ${cursosNomes}</p>
                  <p class="job-description">${vaga.descricao.substring(0, 100)}...</p> 
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
              vagasContainer.appendChild(vagaCard);
          });
          if (typeof feather !== 'undefined') {
              feather.replace(); 
          }
          setupJobActions(); 
      })
      .catch(error => {
          // Linha 183 no arquivo JS completo (pode variar ligeiramente)
          console.error("Erro ao buscar vagas: ", error); 
          vagasContainer.innerHTML = '<p class="error-message">Ocorreu um erro ao carregar suas vagas. Verifique o console para mais detalhes.</p>';
      });
};

/**
 * Configura os listeners para os botões de Editar e Excluir.
 */
const setupJobActions = () => {
    const vagasContainer = document.getElementById('vagas-container');
    const editModal = document.getElementById('edit-modal');
    
    if (!vagasContainer) return; 

    // Inicializa o autocomplete de edição apenas uma vez
    if (!autocompleteControls.edit) {
        autocompleteControls.edit = setupCourseAutocomplete('edit-curso-vaga', 'edit-sugestoes-curso-vaga', 'edit-cursos-selecionados');
        setupEditFormSubmission();
    }
    
    // Listener para os cliques nos botões de Editar/Excluir
    vagasContainer.addEventListener('click', (e) => {
        const targetButton = e.target.closest('.action-button');
        if (!targetButton) return;
        const vagaId = targetButton.dataset.id;

        // AÇÃO DE EXCLUIR
        if (targetButton.classList.contains('delete-btn')) {
            if (confirm('Tem certeza de que deseja excluir esta vaga? Esta ação é irreversível.')) {
                db.collection('vagas').doc(vagaId).delete()
                    .then(() => {
                        alert('Vaga excluída com sucesso! 🗑️');
                        loadCompanyJobs();
                    })
                    .catch(error => {
                        console.error("Erro ao excluir vaga: ", error);
                        alert('Falha ao excluir a vaga.');
                    });
            }
        }
        
        // AÇÃO DE EDITAR (ABRIR MODAL)
        if (targetButton.classList.contains('edit-btn') && editModal) {
            
            db.collection('vagas').doc(vagaId).get().then(doc => {
                if (doc.exists) {
                    const vaga = doc.data();
                    
                    // 1. Preenche os campos de texto
                    document.getElementById('edit-vaga-id').value = vagaId;
                    document.getElementById('edit-titulo').value = vaga.titulo;
                    document.getElementById('edit-descricao').value = vaga.descricao;
                    document.getElementById('edit-requisitos').value = vaga.requisitos;
                    document.getElementById('edit-cargaHoraria').value = vaga.cargaHoraria;

                    // 2. Carrega o array de múltiplos cursos para edição
                    // JSON.parse(JSON.stringify) cria uma cópia profunda
                    selectedCourses = JSON.parse(JSON.stringify(vaga.cursosRequeridos || [])); 
                    
                    // 3. Renderiza as tags no modal
                    autocompleteControls.edit.render(); 

                    // 4. Exibe o modal
                    editModal.style.display = 'flex'; 
                }
            }).catch(error => {
                 console.error("Erro ao carregar vaga para edição: ", error);
                 alert('Não foi possível carregar os dados da vaga para edição.');
            });
        }
    });

    // Lógica para fechar o modal
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            editModal.style.display = 'none';
        });
    }

    // Fechar modal ao clicar fora
    window.addEventListener('click', (event) => {
        if (event.target === editModal) {
            editModal.style.display = 'none';
        }
    });
};

/**
 * Configura o listener para a submissão do formulário de edição.
 */
const setupEditFormSubmission = () => {
    const editForm = document.getElementById('edit-job-form');
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const vagaId = document.getElementById('edit-vaga-id').value;
            const cursoInput = document.getElementById('edit-curso-vaga');

            // 1. VALIDAÇÃO: Garante que pelo menos um curso foi selecionado
            if (selectedCourses.length === 0) {
                cursoInput.setCustomValidity('É obrigatório selecionar pelo menos um curso da lista.');
                cursoInput.reportValidity();
                return;
            } else {
                cursoInput.setCustomValidity(''); 
            }

            // 2. Prepara os dados para atualização (incluindo o array de cursos)
            const cursosParaSalvar = selectedCourses.map(c => ({
                id: c.id,
                nome: c.nome
            }));

            const vagaUpdateData = {
                titulo: document.getElementById('edit-titulo').value,
                descricao: document.getElementById('edit-descricao').value,
                requisitos: document.getElementById('edit-requisitos').value,
                cargaHoraria: document.getElementById('edit-cargaHoraria').value,
                cursosRequeridos: cursosParaSalvar, // Salva o array atualizado
                dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            };

            const submitButton = editForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';

            // 3. Envia a atualização para o Firestore
            db.collection('vagas').doc(vagaId).update(vagaUpdateData)
                .then(() => {
                    alert('Vaga atualizada com sucesso!');
                    document.getElementById('edit-modal').style.display = 'none';
                    loadCompanyJobs(); // Recarrega a lista para mostrar a alteração
                })
                .catch(error => {
                    console.error("Erro ao atualizar a vaga: ", error);
                    alert('Falha ao atualizar a vaga. Verifique as permissões.');
                })
                .finally(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Salvar Alterações';
                });
        });
    }
};

// =================================================================
// 3. LÓGICA DO FORMULÁRIO CRIAR VAGA (Em CriarVagaEmpresa.html)
// =================================================================
// Mantive o código de Criação aqui, caso seu CriarVagaEmpresa.html use
// o mesmo arquivo JS para o formulário.

const setupCreateJobForm = () => {
    selectedCourses = []; 
    autocompleteControls.create = setupCourseAutocomplete('curso-vaga', 'sugestoes-curso-vaga', 'cursos-selecionados'); 

    const createJobForm = document.getElementById('create-job-form');
    if (createJobForm) {
        createJobForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (!currentUser) { 
                return alert('Erro de autenticação. Tente recarregar a página.'); 
            }

            const cursoInput = document.getElementById('curso-vaga');
            if (selectedCourses.length === 0) {
                cursoInput.setCustomValidity('É obrigatório selecionar pelo menos um curso da lista.');
                cursoInput.reportValidity(); 
                return;
            } else {
                cursoInput.setCustomValidity(''); 
            }

            const cursosParaSalvar = selectedCourses.map(c => ({
                id: c.id,
                nome: c.nome
            }));

            const vagaData = {
                titulo: document.getElementById('titulo').value,
                descricao: document.getElementById('descricao').value,
                requisitos: document.getElementById('requisitos').value,
                cargaHoraria: document.getElementById('cargaHoraria').value,
                cursosRequeridos: cursosParaSalvar, 
                empresaId: currentUser.uid, 
                criadaEm: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'aberta'
            };

            const submitButton = createJobForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Publicando...';

            db.collection('vagas').add(vagaData)
                .then(() => {
                    alert(`Vaga "${vagaData.titulo}" criada com sucesso!`);
                    createJobForm.reset();
                    selectedCourses = [];
                    autocompleteControls.create.render(); 
                    window.location.href = 'MinhasVagas.html';
                })
                .catch(error => {
                    console.error("Erro ao criar a vaga: ", error); 
                    alert('Falha ao criar a vaga.');
                })
                .finally(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Publicar Vaga';
                });
        });
    }
}

// =================================================================
// 4. INICIALIZAÇÃO E AUTENTICAÇÃO
// =================================================================

loadAllCoursesFromFirestore();

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        console.log('Usuário autenticado:', currentUser.uid); // Linha 407/410 da sua imagem

        const currentPath = window.location.pathname;
        
        if (currentPath.includes('MinhasVagas.html')) {
            loadCompanyJobs(); 
        } else if (currentPath.includes('CriarVagaEmpresa.html')) {
            setupCreateJobForm();
        }

    } else {
        // Redireciona para o login se não estiver autenticado
        window.location.href = 'login-empresa.html'; 
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
