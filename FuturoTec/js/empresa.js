const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null; // Usuário da empresa autenticado
let selectedCourses = []; // Cursos selecionados
let availableCourses = []; // Cursos disponíveis do Firestore

const logoutBtn = document.querySelector('.logout-btn');

// ===========================
// CARREGAR CURSOS DO FIRESTORE
// ===========================
const loadAvailableCourses = async () => {
    try {
        const snapshot = await db.collection('cursos').get();
        availableCourses = snapshot.docs.map(doc => doc.data().nome).filter(nome => nome);
    } catch (error) {
        console.error("Erro ao carregar cursos:", error);
        availableCourses = [];
        alert("Não foi possível carregar cursos. Verifique o console.");
    }
};

// ===========================
// FUNÇÃO PARA RENDERIZAR CURSOS SELECIONADOS
// ===========================
const renderSelectedCourses = () => {
    const container = document.getElementById('cursos-selecionados');
    if (!container) return;
    container.innerHTML = selectedCourses.map(course => `
        <span class="course-tag" data-course="${course}">
            ${course} <i data-feather="x" class="remove-tag" data-course="${course}"></i>
        </span>
    `).join('');
    if (typeof feather !== 'undefined') feather.replace();
};

// ===========================
// AUTOCOMPLETE DE CURSOS
// ===========================
const setupCourseAutocomplete = () => {
    const input = document.getElementById('curso-vaga');
    const suggestionsContainer = document.getElementById('sugestoes-curso-vaga');
    const selectedContainer = document.getElementById('cursos-selecionados');
    if (!input || !suggestionsContainer || !selectedContainer) return;

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        suggestionsContainer.innerHTML = '';
        if (!query) return;

        const filteredCourses = availableCourses.filter(course =>
            course.toLowerCase().includes(query) && !selectedCourses.includes(course)
        );

        if (filteredCourses.length > 0) {
            filteredCourses.forEach(course => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = course;
                item.addEventListener('click', () => {
                    selectedCourses.push(course);
                    renderSelectedCourses();
                    input.value = '';
                    suggestionsContainer.innerHTML = '';
                });
                suggestionsContainer.appendChild(item);
            });
        } else {
            suggestionsContainer.innerHTML = '<div class="autocomplete-item no-results">Nenhum curso encontrado.</div>';
        }
    });

    // Remover curso
    selectedContainer.addEventListener('click', e => {
        const removeBtn = e.target.closest('.remove-tag');
        if (removeBtn) {
            const courseToRemove = removeBtn.dataset.course;
            selectedCourses = selectedCourses.filter(c => c !== courseToRemove);
            renderSelectedCourses();
        }
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-container')) suggestionsContainer.innerHTML = '';
    });
};

// ===========================
// CRIAR VAGA
// ===========================
const setupCreateJobForm = () => {
    const createJobForm = document.getElementById('create-job-form');
    if (!createJobForm) return;

    createJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return alert("Usuário não autenticado.");

        if (selectedCourses.length === 0) return alert("Selecione pelo menos um curso.");

        const vagaData = {
            titulo: document.getElementById('titulo').value,
            descricao: document.getElementById('descricao').value,
            requisitos: document.getElementById('requisitos').value,
            cargaHoraria: document.getElementById('cargaHoraria').value,
            cursosRequeridos: selectedCourses,
            periodo: document.getElementById('periodo').value,
            empresaId: currentUser.uid,
            status: 'Vaga Ativa',
            criadaEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('vagas').add(vagaData);
            createJobForm.reset();
            selectedCourses = [];
            renderSelectedCourses();
            window.location.href = 'MinhasVagas.html';
        } catch (error) {
            console.error("Erro ao criar vaga:", error);
            alert("Erro ao criar vaga. Veja o console.");
        }
    });
};

// ===========================
// CARREGAR VAGAS DA EMPRESA
// ===========================
const loadCompanyJobs = async () => {
    const vagasContainer = document.getElementById('vagas-container');
    if (!vagasContainer || !currentUser) return;

    vagasContainer.innerHTML = '<p>Carregando suas vagas...</p>';

    try {
        const snapshot = await db.collection('vagas')
            .where('empresaId', '==', currentUser.uid)
            .orderBy('criadaEm', 'desc')
            .get();

        if (snapshot.empty) {
            vagasContainer.innerHTML = '<p>Você ainda não publicou nenhuma vaga.</p>';
            return;
        }

        vagasContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const vaga = doc.data();
            const vagaId = doc.id;

            const cursos = vaga.cursosRequeridos?.length > 0
                ? `<p>Cursos: ${vaga.cursosRequeridos.join(', ')}</p>` 
                : '<p>Cursos: Não especificado</p>';

            const periodo = vaga.periodo ? `<p>Período: ${vaga.periodo}</p>` : '';

            const vagaCard = document.createElement('div');
            vagaCard.className = 'vaga-card';
            vagaCard.innerHTML = `
                <h3>${vaga.titulo}</h3>
                <p>${vaga.descricao.substring(0, 150)}...</p>
                ${cursos}
                ${periodo}
                <p>Carga Horária: ${vaga.cargaHoraria}</p>
                <div class="actions-vaga">
                    <button class="edit-btn" data-id="${vagaId}"><i data-feather="edit"></i> Editar</button>
                    <button class="delete-btn" data-id="${vagaId}"><i data-feather="trash-2"></i> Excluir</button>
                </div>
            `;
            vagasContainer.appendChild(vagaCard);
        });

        if (typeof feather !== 'undefined') feather.replace();

    } catch (error) {
        console.error("Erro ao carregar vagas:", error);
        vagasContainer.innerHTML = '<p>Erro ao carregar vagas. Veja o console.</p>';
    }
};

// ===========================
// AÇÕES DE EDIÇÃO/EXCLUSÃO
// ===========================
const setupJobActions = () => {
    const vagasContainer = document.getElementById('vagas-container');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-job-form');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    if (!vagasContainer) return;

    vagasContainer.addEventListener('click', async e => {
        const target = e.target.closest('button');
        if (!target) return;
        const vagaId = target.dataset.id;

        // EXCLUIR
        if (target.classList.contains('delete-btn')) {
            if (!confirm("Tem certeza que deseja excluir esta vaga?")) return;
            try {
                await db.collection('vagas').doc(vagaId).delete();
                loadCompanyJobs();
            } catch (error) {
                console.error("Erro ao excluir vaga:", error);
            }
        }

        // EDITAR
        if (target.classList.contains('edit-btn')) {
            const doc = await db.collection('vagas').doc(vagaId).get();
            if (!doc.exists) return alert("Vaga não encontrada.");

            const vaga = doc.data();
            document.getElementById('edit-vaga-id').value = vagaId;
            document.getElementById('edit-titulo').value = vaga.titulo;
            document.getElementById('edit-descricao').value = vaga.descricao;
            document.getElementById('edit-requisitos').value = vaga.requisitos;
            document.getElementById('edit-cargaHoraria').value = vaga.cargaHoraria;

            selectedCourses = vaga.cursosRequeridos ? [...vaga.cursosRequeridos] : [];
            renderSelectedCourses();

            editModal.style.display = 'flex';
        }
    });

    // SALVAR EDIÇÃO
    if (editForm) {
        editForm.addEventListener('submit', async e => {
            e.preventDefault();
            const vagaId = document.getElementById('edit-vaga-id').value;
            if (selectedCourses.length === 0) return alert("Selecione pelo menos um curso.");

            const updatedData = {
                titulo: document.getElementById('edit-titulo').value,
                descricao: document.getElementById('edit-descricao').value,
                requisitos: document.getElementById('edit-requisitos').value,
                cargaHoraria: document.getElementById('edit-cargaHoraria').value,
                cursosRequeridos: selectedCourses,
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('vagas').doc(vagaId).update(updatedData);
                editModal.style.display = 'none';
                selectedCourses = [];
                loadCompanyJobs();
            } catch (error) {
                console.error("Erro ao atualizar vaga:", error);
            }
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            editModal.style.display = 'none';
            selectedCourses = [];
            renderSelectedCourses();
        });
    }

    if (editModal) {
        editModal.addEventListener('click', e => {
            if (e.target.id === 'edit-modal') {
                editModal.style.display = 'none';
                selectedCourses = [];
                renderSelectedCourses();
            }
        });
    }
};

// ===========================
// AUTENTICAÇÃO E FLUXO
// ===========================
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        const path = window.location.pathname;

        if (path.includes('CriarVagaEmpresa.html') || path.includes('MinhasVagas.html')) {
            await loadAvailableCourses();
            setupCourseAutocomplete();
        }

        if (path.includes('CriarVagaEmpresa.html')) setupCreateJobForm();
        if (path.includes('MinhasVagas.html')) {
            loadCompanyJobs();
            setupJobActions();
        }

    } else {
        window.location.href = 'login-empresa.html';
    }
});

// LOGOUT
if (logoutBtn) {
    logoutBtn.addEventListener('click', e => {
        e.preventDefault();
        auth.signOut().then(() => window.location.href = 'login-empresa.html');
    });
}

