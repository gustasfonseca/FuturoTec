// js/auth-candidato.js - VERSÃO SIMPLIFICADA

// --- CONFIGURAÇÃO DO FIREBASE (EXISTENTE) ---
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

    // --- LÓGICA DE CADASTRO (EXISTENTE E SEM ALTERAÇÕES) ---
    const formCandidato = document.getElementById('form-candidato');
    if (formCandidato) {
        // ... (seu código de cadastro continua aqui, sem alterações)
        formCandidato.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-candidato').value;
            const senha = document.getElementById('senha-candidato').value;
            const confirmarSenha = document.getElementById('confirmar-senha-candidato').value;
            const nome = document.getElementById('nome-candidato').value;
            const telefone = document.getElementById('telefone-candidato').value;
            const dataNascimento = document.getElementById('data-nascimento-candidato').value;

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

    // --- LÓGICA DE LOGIN (EXISTENTE E SEM ALTERAÇÕES) ---
    const formLoginCandidato = document.getElementById('form-login-candidato');
    if (formLoginCandidato) {
        // ... (seu código de login continua aqui, sem alterações)
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


    // --- LÓGICA SIMPLIFICADA PARA A PÁGINA DE PERFIL ---
    const formPerfil = document.getElementById('profile-form');
    if (formPerfil) {

        // Função para carregar os dados do usuário no formulário
        const carregarDadosDoUsuario = async (userId) => {
            try {
                const doc = await db.collection('usuarios').doc(userId).get();
                if (!doc.exists) { return; }

                const data = doc.data();
                // Carrega apenas os dados essenciais
                document.getElementById('user-name').textContent = data.nome || '';
                document.getElementById('user-email').textContent = data.email || '';
                document.getElementById('email').value = data.email || '';
                document.getElementById('nome-completo').value = data.nome || '';
                document.getElementById('celular').value = data.telefone || '';
                document.getElementById('nascimento').value = data.dataNascimento || '';

            } catch (error) {
                console.error("Erro ao carregar dados:", error);
            }
        };

        // Função para salvar os dados do perfil
        const salvarDadosDoPerfil = async (userId) => {
            const dadosParaSalvar = {
                // Salva apenas os dados essenciais
                nome: document.getElementById('nome-completo').value,
                telefone: document.getElementById('celular').value,
                dataNascimento: document.getElementById('nascimento').value,
                dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('usuarios').doc(userId).set(dadosParaSalvar, { merge: true });
                alert("Alterações salvas com sucesso!");
                // Recarrega o nome no topo da página após salvar
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
                window.location.href = 'login.html'; // Mude para sua página de login
            }
        });
    }

});
