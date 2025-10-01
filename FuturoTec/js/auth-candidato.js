// js/auth-candidato.js 

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyA8Q9cKB4oVmFM6ilHK_70h8JDvgsOQhLY",
    authDomain: "futurotec-e3a69.firebaseapp.com",
    projectId: "futurotec-e3a69",
    storageBucket: "futurotec-e3a69.firebasestorage.app",
    messagingSenderId: "234233783827",
    appId: "1:234233783827:web:bf9376dee78d8924ef01e6",
    measurementId: "G-C7EEMP1146"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =======================================================
// === FUNÇÃO DE LOGIN COM O GOOGLE (CORRIGIDA) ===
// =======================================================

async function loginComGoogleCandidato() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        const result = await auth.signInWithPopup(provider);

        const user = result.user;

        console.log("Login do Google bem-sucedido no Auth:", user);

        const userRef = db.collection('usuarios').doc(user.uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            // SE O DOCUMENTO NO FIRESTORE NÃO EXISTE: BLOQUEAR LOGIN!

            // 1. Desloga o usuário (para garantir que ele não fique logado no Firebase Auth)
            await auth.signOut();

            // 2. Lança um erro personalizado
            throw new Error("Conta não encontrada. Use o cadastro por e-mail/senha ou crie uma conta primeiro.");

        } else if (userSnap.data().role !== 'aluno') {
            // Lógica de segurança existente: bloqueia se o role for diferente
            await auth.signOut();
            throw new Error("Acesso negado. Este login é apenas para Candidatos/Alunos.");
        }

        console.log("Perfil existente no Firestore. Login permitido.");
        return user;

    } catch (error) {
        // Trata o erro de pop-up e o erro de conta não encontrada/role
        console.error("Erro no login com o Google:", error);

        const errorMessage = error.message.includes("Conta não encontrada")
            ? error.message
            : `Erro ao fazer login com o Google. Tente novamente ou use e-mail/senha. Detalhe: ${error.message}`;

        alert(errorMessage);
        throw error;
    }
}


// --- PONTO DE ENTRADA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. LÓGICA DE AUTOCOMPLETE DO CURSO ---
    const inputCurso = document.getElementById('curso-candidato');
    const inputCursoId = document.getElementById('curso-id-candidato');
    const sugestoesCurso = document.getElementById('sugestoes-curso');

    const buscarCursos = async (termo) => {
        if (!sugestoesCurso) return;

        sugestoesCurso.innerHTML = '';
        if (termo.length < 3) return;

        try {
            const snapshot = await db.collection('cursos').get();
            const cursos = [];
            snapshot.forEach(doc => {
                cursos.push({ id: doc.id, nome: doc.data().nome });
            });

            const termoLowerCase = termo.toLowerCase();
            const resultadosFiltrados = cursos.filter(curso =>
                curso.nome.toLowerCase().includes(termoLowerCase)
            ).slice(0, 5);

            if (resultadosFiltrados.length === 0) {
                const item = document.createElement('div');
                item.textContent = "Nenhum curso encontrado.";
                sugestoesCurso.appendChild(item);
                return;
            }

            resultadosFiltrados.forEach(curso => {
                const item = document.createElement('div');
                item.classList.add('autocomplete-item');
                item.textContent = curso.nome;
                item.dataset.id = curso.id;

                item.addEventListener('click', () => {
                    inputCurso.value = curso.nome;
                    inputCursoId.value = curso.id;
                    sugestoesCurso.innerHTML = '';
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

    let debounceTimer;
    if (inputCurso) {
        inputCurso.addEventListener('input', () => {
            inputCursoId.value = '';

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                buscarCursos(inputCurso.value.trim());
            }, 300);
        });
    }

    document.addEventListener('click', (e) => {
        if (inputCurso && sugestoesCurso && !inputCurso.contains(e.target) && !sugestoesCurso.contains(e.target)) {
            sugestoesCurso.innerHTML = '';
        }
    });


    // --- 2. LÓGICA DE CADASTRO DO CANDIDATO (DESLOGA APÓS SUCESSO) ---
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
                    cursoId: cursoId,
                    cursoNome: cursoNome,
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('usuarios').doc(user.uid).set(perfilData);

                // CORREÇÃO ANTERIOR: Desloga após o cadastro para forçar o login
                await auth.signOut();

                alert("Cadastro de Candidato realizado com sucesso! Por favor, faça login.");
                window.location.href = 'login-candidato.html';
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

    // --- MANIPULADOR DE EVENTOS PARA O BOTÃO DO GOOGLE ---
    const btnGoogleLogin = document.getElementById('btn-google-login');
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const user = await loginComGoogleCandidato();
                if (user) {
                    console.log("Login com Google concluído. Redirecionando...");
                    window.location.href = 'InicialAluno.html';
                }
            } catch (error) {
                // Erro já tratado na função
            }
        });
    }


    // --- 4. LÓGICA DA PÁGINA DE PERFIL ---
    const formPerfil = document.getElementById('profile-form');
    if (formPerfil) {

        const carregarDadosDoUsuario = async (userId) => {
            try {
                const doc = await db.collection('usuarios').doc(userId).get();
                if (!doc.exists) { return; }

                const data = doc.data();

                document.getElementById('user-name').textContent = data.nome || '';
                document.getElementById('user-email').textContent = data.email || '';
                document.getElementById('email').value = data.email || '';
                document.getElementById('nome-completo').value = data.nome || '';
                document.getElementById('celular').value = data.telefone || '';
                document.getElementById('nascimento').value = data.dataNascimento || '';
                document.getElementById('curso-aluno').value = data.cursoNome || 'Não informado';

            } catch (error) {
                console.error("Erro ao carregar dados:", error);
            }
        };

        const salvarDadosDoPerfil = async (userId) => {
            const dadosParaSalvar = {
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
