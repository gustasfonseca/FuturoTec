// js/empresa.js

document.addEventListener('DOMContentLoaded', () => {
    // Lógica compartilhada entre todas as páginas da empresa
    const auth = firebase.auth();
    let idToken = null;
    const logoutBtn = document.querySelector('.logout-btn');

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            idToken = await user.getIdToken();
            console.log('Usuário autenticado:', user.uid);
        } else {
            // Se não estiver autenticado, redireciona para a página de login
            window.location.href = 'login.html';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'login.html';
            }).catch((error) => {
                console.error('Erro ao fazer logout:', error);
                alert('Erro ao sair. Tente novamente.');
            });
        });
    }

    // --- LÓGICA ESPECÍFICA PARA CADA PÁGINA ---

    // Lógica para a página de Criar Vaga
    if (window.location.pathname.includes('criar-vaga.html')) {
        const createJobForm = document.getElementById('create-job-form');

        if (createJobForm) {
            createJobForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!idToken) {
                    alert('Erro de autenticação. Por favor, faça login novamente.');
                    return;
                }

                const vagaData = {
                    titulo: document.getElementById('titulo').value,
                    descricao: document.getElementById('descricao').value,
                    requisitos: document.getElementById('requisitos').value,
                    cargaHoraria: document.getElementById('cargaHoraria').value
                };

                try {
                    const response = await fetch('http://localhost:8080/vagas', { // Ajuste a URL se necessário
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify(vagaData)
                    });

                    const result = await response.json();

                    if (response.ok) {
                        alert('Vaga criada com sucesso!');
                        createJobForm.reset();
                        // Opcional: redirecionar para a página de Minhas Vagas após a criação
                        window.location.href = 'minhas-vagas.html'; 
                    } else {
                        alert(`Erro ao criar a vaga: ${result.erro}`);
                    }
                } catch (error) {
                    console.error('Erro na requisição:', error);
                    alert('Não foi possível conectar ao servidor.');
                }
            });
        }
    }
    
    // Você pode adicionar outras lógicas aqui, por exemplo,
    // if (window.location.pathname.includes('minhas-vagas.html')) { ... }
    
});