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

// A API_BASE_URL NÃO SERÁ MAIS USADA PARA EXCLUIR A CONTA, 
// MAS A MANTEMOS PARA O CASO DE OUTRAS FUNÇÕES A USAREM.
const API_BASE_URL = 'http://localhost:8080'; 


// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =======================================================
// === FUNÇÃO DE LOGIN COM O GOOGLE ===
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
            await auth.signOut();
            throw new Error("Conta não encontrada. Use o cadastro por e-mail/senha ou crie uma conta primeiro.");

        } else if (userSnap.data().role !== 'aluno') {
            await auth.signOut();
            throw new Error("Acesso negado. Este login é apenas para Candidatos/Alunos.");
        }

        console.log("Perfil existente no Firestore. Login permitido.");
        return user;

    } catch (error) {
        console.error("Erro no login com o Google:", error);

        const errorMessage = error.message.includes("Conta não encontrada")
            ? error.message
            : `Erro ao fazer login com o Google. Tente novamente ou use e-mail/senha. Detalhe: ${error.message}`;

        alert(errorMessage);
        throw error;
    }
}

// =======================================================
// === FUNÇÃO DE RECUPERAÇÃO DE SENHA ===
// =======================================================

async function recuperarSenhaCandidato() {
    const email = prompt("Por favor, digite seu e-mail de Candidato/Aluno para redefinir a senha:");

    if (!email) {
        alert("Operação cancelada ou e-mail não fornecido.");
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);

        alert(`✅ E-mail de redefinição de senha enviado para ${email}. Verifique sua caixa de entrada e a pasta de Spam!`);

    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição:", error);

        let errorMessage = "Erro ao solicitar a redefinição de senha. Verifique se o e-mail está correto e tente novamente.";
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = "Não encontramos uma conta para este e-mail. Verifique se digitou corretamente.";
        } else if (error.code === 'auth/invalid-email') {
             errorMessage = "O formato do e-mail é inválido.";
        }

        alert(`❌ Erro: ${errorMessage}`);
    }
}

// =======================================================
// === FUNÇÃO DE EXCLUSÃO DE CONTA (FIREBASE AUTH CORRIGIDA) ===
// ESTA VERSÃO CORRIGE OS ERROS DE API/AUTH/CORS E GARANTE A EXCLUSÃO
// =======================================================

async function excluirContaCandidato(user) {
    if (!user) {
        alert("Erro: Nenhum usuário logado.");
        return;
    }
    
    const userId = user.uid;
    const userEmail = user.email;

    // 1. Confirmação de Segurança (Digitando o E-mail)
    const confirmacaoEmail = prompt(`ATENÇÃO: A exclusão da conta é PERMANENTE. Você perderá todos os dados (perfil, candidaturas).

Para confirmar a exclusão, digite seu EMAIL (${userEmail}) no campo abaixo:`);

    if (confirmacaoEmail !== userEmail) {
        alert("E-mail digitado incorretamente ou operação cancelada.");
        return;
    }
    
    // 2. Confirmação de Segurança (Digitando a Senha para Reautenticação)
    const confirmacaoSenha = prompt("Por favor, digite sua SENHA para confirmar a exclusão. (REQUERIDO PELO FIREBASE):");
    if (!confirmacaoSenha) {
        alert("Exclusão cancelada. É necessário informar a senha.");
        return;
    }


    try {
        // PASSO CRÍTICO A: RE-AUTENTICAÇÃO
        // Necessário para operações sensíveis como exclusão da conta.
        const credential = firebase.auth.EmailAuthProvider.credential(userEmail, confirmacaoSenha);
        await user.reauthenticateWithCredential(credential);
        console.log("[Exclusão] Reautenticação bem-sucedida.");

        // PASSO CRÍTICO B: EXCLUIR DADOS NO FIRESTORE (Candidaturas)
        console.log("[Exclusão] Excluindo candidaturas do aluno...");
        const candidaturasSnapshot = await db.collection('candidaturas')
            .where('alunoId', '==', userId)
            .get();
        
        const batch = db.batch();
        candidaturasSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`[Exclusão] ${candidaturasSnapshot.size} candidaturas excluídas.`);

        // PASSO CRÍTICO C: EXCLUIR DADOS DO PERFIL (Coleção 'usuarios')
        console.log("[Exclusão] Excluindo perfil do aluno...");
        await db.collection('usuarios').doc(userId).delete();
        console.log("[Exclusão] Perfil do aluno excluído.");

        // PASSO CRÍTICO D: EXCLUIR O USUÁRIO DO FIREBASE AUTH (LIBERA O E-MAIL)
        await user.delete();
        console.log("[Exclusão] Usuário excluído do Firebase Auth. E-mail liberado.");

        alert("✅ Sua conta foi excluída permanentemente. Sentiremos sua falta.");
        window.location.href = 'login-candidato.html'; // Redireciona para o login

    } catch (error) {
        console.error("Erro ao excluir a conta:", error);
        
        let errorMessage = "Ocorreu um erro ao tentar excluir sua conta.";

        if (error.code === 'auth/wrong-password' || error.message.includes('password')) {
             errorMessage = "Senha incorreta. A exclusão da conta foi cancelada.";
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = "Erro de Segurança: Você precisa ter feito login *recentemente*. Por favor, saia e entre novamente, e tente excluir a conta em seguida.";
        }
        alert(`❌ ${errorMessage} (Detalhes técnicos no console)`);
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

                // Desloga após o cadastro para forçar o login
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
    
    // --- LÓGICA DE RECUPERAÇÃO DE SENHA (CONECTANDO O LINK) ---
    const btnEsqueciSenha = document.getElementById('btn-esqueci-senha');
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener('click', (e) => {
            e.preventDefault(); // Impede que o link recarregue a página
            recuperarSenhaCandidato();
        });
    }

    // --- 4. LÓGICA DA PÁGINA DE PERFIL ---
    const formPerfil = document.getElementById('profile-form');
    if (formPerfil) {
        // Conexão do botão de exclusão
        const btnExcluirConta = document.getElementById('btn-excluir-conta');

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
                
                // PONTO CHAVE: CONEXÃO DA FUNÇÃO DE EXCLUSÃO
                if (btnExcluirConta) {
                    btnExcluirConta.addEventListener('click', () => {
                        excluirContaCandidato(user); 
                    });
                }

            } else {
                alert("Você precisa estar logado para acessar esta página.");
                window.location.href = 'login-candidato.html';
            }
        });
    }
});
