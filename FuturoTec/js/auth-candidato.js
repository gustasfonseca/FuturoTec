// js/auth-candidato.js - Versão Final com Cadastro, Login e Perfil (incluindo Curso)

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyA8Q9cKB4oVmFM6ilHK_70h8JDvgsOQhLY",
    authDomain: "futurotec-e3a69.firebaseapp.com",
    projectId: "futurotec-e3a69",
    storageBucket: "futurotec-e3a69.appspot.com",
    messagingSenderId: "234233783827",
    appId: "1:234233783827:web:bf9376dee78d8924ef01e6",
    measurementId: "G-C7EEMP1146"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- PONTO DE ENTRADA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. LÓGICA DE AUTOCOMPLETE DO CURSO ---
    const inputCurso = document.getElementById('curso-candidato');
    const inputCursoId = document.getElementById('curso-id-candidato');
    const sugestoesCurso = document.getElementById('sugestoes-curso');

    // Função para buscar e exibir sugestões
    const buscarCursos = async (termo) => {
        if (!sugestoesCurso) return; // Sai se não estiver na página de cadastro
        
        sugestoesCurso.innerHTML = ''; 
        if (termo.length < 3) return; 

        try {
            // Busca todos os cursos (idealmente otimizar com busca indexada)
            const snapshot = await db.collection('cursos').get();
            const cursos = [];
            snapshot.forEach(doc => {
                cursos.push({ id: doc.id, nome: doc.data().nome });
            });

            // Filtra no JS para simular o autocomplete
            const termoLowerCase = termo.toLowerCase();
            const resultadosFiltrados = cursos.filter(curso => 
                curso.nome.toLowerCase().includes(termoLowerCase)
            ).slice(0, 5); // Limita a 5 resultados

            if (resultadosFiltrados.length === 0) {
                const item = document.createElement('div');
                item.textContent = "Nenhum curso encontrado.";
                sugestoesCurso.appendChild(item);
                return;
            }

            resultadosFiltrados.forEach(curso => {
                const item = document.createElement('div');
                item.classList.add('autocomplete-item'); // Usa a classe CSS unificada
                item.textContent = curso.nome;
                item.dataset.id = curso.id;
                
                item.addEventListener('click', () => {
                    inputCurso.value = curso.nome;
                    inputCursoId.value = curso.id; // Salva o ID real
                    sugestoesCurso.innerHTML = ''; // Limpa a lista
                });
                sugestoesCurso.appendChild(item);
            });

        } catch (error) {
            console.error("Erro ao buscar cursos:", error);
            const item = document.createElement('div');
            item.textContent = "Erro ao carregar cursos. Verifique as regras do Firestore.";
            sugestoesCurso.appendChild(item);
        }
    };

    // Evento de digitação com Debounce
    let debounceTimer;
    if (inputCurso) {
        inputCurso.addEventListener('input', () => {
            inputCursoId.value = ''; // Limpa o ID se o usuário digitar novamente
            
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                buscarCursos(inputCurso.value.trim());
            }, 300); 
        });
    }

    // Evento para esconder as sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (inputCurso && sugestoesCurso && !inputCurso.contains(e.target) && !sugestoesCurso.contains(e.target)) {
            sugestoesCurso.innerHTML = '';
        }
    });


    // --- 2. LÓGICA DE CADASTRO DO CANDIDATO (ATUALIZADA) ---
    const formCandidato = document.getElementById('form-candidato');
    if (formCandidato) {
        formCandidato.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-candidato').value;
            const senha = document.getElementById('senha-candidato').value;
            const confirmarSenha = document.getElementById('confirmar-senha-candidato').value;
            const nome = document.getElementById('nome-candidato').value;
            const telefone = document.getElementById('telefone-candidato').value;
            const dataNascimento = document.getElementById('data-nascimento-candidato').value;
            
            // COLETA DO CURSO
            const cursoId = document.getElementById('curso-id-candidato').value;
            const cursoNome = document.getElementById('curso-candidato').value;

            // VALIDAÇÕES
            if (!cursoId) {
                alert("Por favor, selecione um curso válido da lista de sugestões.");
                return;
            }
            if (senha !== confirmarSenha) {
                alert("As senhas não coincidem.");
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
                const user = userCredential.user;

                const perfilData = {
                    role: 'aluno',
                    nome: nome,
                    telefone: telefone,
                    dataNascimento: dataNascimento,
                    email: email,
                    // DADOS DO CURSO SALVOS
                    cursoId: cursoId, 
                    cursoNome: cursoNome,
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('usuarios').doc(user.uid).set(perfilData);

                alert("Cadastro de Candidato realizado com sucesso!");
                window.location.href = 'InicialAluno.html';
            } catch (error) {
                console.error("Erro no cadastro:", error);
                alert(`Erro ao cadastrar: ${error.message}`);
            }
        });
    }

    // --- 3. LÓGICA DE LOGIN (EXISTENTE) ---
    const formLoginCandidato = document.getElementById('form-login-candidato');
    if (formLoginCandidato) {
        formLoginCandidato.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-login-candidato').value;
            const senha = document.getElementById('senha-login-candidato').value;

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, senha);
                const user = userCredential.user;
                const userDoc = await db.collection('usuarios').doc(user.uid).get();
                const userData = userDoc.data();

                if (userData && userData.role === 'aluno') {
                    window.location.href = 'InicialAluno.html';
                } else {
                    alert("Acesso negado. Este login é apenas para candidatos.");
                    auth.signOut();
                }
            } catch (error) {
                console.error("Erro no login:", error);
                alert(`Erro ao fazer login: ${error.message}`);
            }
        });
    }


    // --- 4. LÓGICA DA PÁGINA DE PERFIL (ATUALIZADA PARA O CURSO) ---
    const formPerfil = document.getElementById('profile-form');
    if (formPerfil) {

        // Função para carregar os dados do usuário no formulário
        const carregarDadosDoUsuario = async (userId) => {
            try {
                const doc = await db.collection('usuarios').doc(userId).get();
                if (!doc.exists) { return; }

                const data = doc.data();
                
                // Carrega os dados de cabeçalho
                document.getElementById('user-name').textContent = data.nome || '';
                document.getElementById('user-email').textContent = data.email || '';
                
                // Carrega os dados editáveis/não-editáveis do formulário
                document.getElementById('email').value = data.email || '';
                document.getElementById('nome-completo').value = data.nome || '';
                document.getElementById('celular').value = data.telefone || '';
                document.getElementById('nascimento').value = data.dataNascimento || '';
                
                // >>> CARREGA O NOME DO CURSO <<<
                document.getElementById('curso-aluno').value = data.cursoNome || 'Não informado'; 

            } catch (error) {
                console.error("Erro ao carregar dados:", error);
            }
        };

        // Função para salvar os dados do perfil (mantida)
        const salvarDadosDoPerfil = async (userId) => {
            const dadosParaSalvar = {
                // Salva apenas os dados essenciais editáveis
                nome: document.getElementById('nome-completo').value,
                telefone: document.getElementById('celular').value,
                dataNascimento: document.getElementById('nascimento').value,
                dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('usuarios').doc(userId).set(dadosParaSalvar, { merge: true });
                alert("Alterações salvas com sucesso!");
                document.getElementById('user-name').textContent = dadosParaSalvar.nome;
            } catch (error) {
                console.error("Erro ao salvar:", error);
                alert(`Erro ao salvar: ${error.message}`);
            }
        };

        // Verifica o estado da autenticação para a página de perfil
        auth.onAuthStateChanged(user => {
            if (user) {
                carregarDadosDoUsuario(user.uid);
                formPerfil.addEventListener('submit', (e) => {
                    e.preventDefault();
                    salvarDadosDoPerfil(user.uid);
                });
            } else {
                alert("Você precisa estar logado para acessar esta página.");
                window.location.href = 'login-candidato.html'; 
            }
        });
    }

});
