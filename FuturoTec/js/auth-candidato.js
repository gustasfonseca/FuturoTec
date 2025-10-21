// auth-candidato.js

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

const API_BASE_URL = 'http://localhost:8080'; 

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =======================================================
// === VALIDAÇÃO DE FORÇA DA SENHA E LÓGICA VISUAL ===
// =======================================================

// Função base de validação (usada no submit e na lógica visual)
function isPasswordStrong(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
        return { valid: false, message: 'A senha deve ter no mínimo 8 caracteres.' };
    }
    if (!hasUpperCase) {
        return { valid: false, message: 'A senha deve conter pelo menos uma letra maiúscula.' };
    }
    if (!hasLowerCase) {
        return { valid: false, message: 'A senha deve conter pelo menos uma letra minúscula.' };
    }
    if (!hasNumbers) {
        return { valid: false, message: 'A senha deve conter pelo menos um número.' };
    }
    if (!hasSpecialChars) {
        return { valid: false, message: 'A senha deve conter pelo menos um caractere especial (ex: !@#$).' };
    }

    return { valid: true, message: '' };
}


// =======================================================
// === FUNÇÕES DE AUTENTICAÇÃO E FIRESTORE ===
// =======================================================

async function deslogarCandidato() {
    try {
        await auth.signOut();
        console.log("Usuário deslogado com sucesso.");
        window.location.href = 'login-candidato.html'; 
    } catch (error) {
        console.error("Erro ao deslogar:", error);
        alert("Ocorreu um erro ao tentar sair da conta. Tente novamente.");
    }
}

async function loginComGoogleCandidato() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        const userRef = db.collection('usuarios').doc(user.uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            await auth.signOut();
            throw new Error("Conta não encontrada. Use o cadastro por e-mail/senha ou crie uma conta primeiro.");

        } else if (userSnap.data().role !== 'aluno') {
            await auth.signOut();
            throw new Error("Acesso negado. Este login é apenas para Candidatos/Alunos.");
        }

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

async function excluirContaCandidato(user) {
    if (!user) {
        alert("Erro: Nenhum usuário logado.");
        return;
    }
    
    const userId = user.uid;
    const userEmail = user.email;

    const confirmacaoEmail = prompt(`ATENÇÃO: A exclusão da conta é PERMANENTE. Você perderá todos os dados (perfil, candidaturas).

Para confirmar a exclusão, digite seu EMAIL (${userEmail}) no campo abaixo:`);

    if (confirmacaoEmail !== userEmail) {
        alert("E-mail digitado incorretamente ou operação cancelada.");
        return;
    }
    
    const confirmacaoSenha = prompt("Por favor, digite sua SENHA para confirmar a exclusão. (REQUERIDO PELO FIREBASE):");
    if (!confirmacaoSenha) {
        alert("Exclusão cancelada. É necessário informar a senha.");
        return;
    }


    try {
        const credential = firebase.auth.EmailAuthProvider.credential(userEmail, confirmacaoSenha);
        await user.reauthenticateWithCredential(credential);
        console.log("[Exclusão] Reautenticação bem-sucedida.");

        const candidaturasSnapshot = await db.collection('candidaturas')
            .where('alunoId', '==', userId)
            .get();
        
        const batch = db.batch();
        candidaturasSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`[Exclusão] ${candidaturasSnapshot.size} candidaturas excluídas.`);

        await db.collection('usuarios').doc(userId).delete();
        console.log("[Exclusão] Perfil do aluno excluído.");

        await user.delete();
        console.log("[Exclusão] Usuário excluído do Firebase Auth. E-mail liberado.");

        alert("✅ Sua conta foi excluída permanentemente. Sentiremos sua falta.");
        window.location.href = 'login-candidato.html'; 

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


// =======================================================
// === PONTO DE ENTRADA PRINCIPAL E LÓGICA VISUAL ===
// =======================================================
document.addEventListener('DOMContentLoaded', () => {

    // --- 0. FUNCIONALIDADE MOSTRAR/ESCONDER SENHA (CORREÇÃO INCLUÍDA) ---
    document.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            if (!passwordInput) return;
            
            const icon = toggle.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.setAttribute('data-feather', 'eye-off');
            } else {
                passwordInput.type = 'password';
                icon.setAttribute('data-feather', 'eye');
            }
            // Chama feather.replace() para que o ícone mude
            if (typeof feather !== 'undefined' && feather.replace) {
                feather.replace();
            }
        });
    });


    // --- ELEMENTOS DE VALIDAÇÃO VISUAL ---
    const senhaInput = document.getElementById('senha-candidato');
    const confirmarSenhaInput = document.getElementById('confirmar-senha-candidato');
    const validationList = document.getElementById('password-validation-list');
    const errorMessageDiv = document.getElementById('password-error-message');


    // Função para atualizar o status visual das regras de senha
    function updatePasswordValidation() {
        if (!senhaInput || !validationList) return;

        const password = senhaInput.value;

        // Regras baseadas na função isPasswordStrong
        const checks = [
            { id: 'min-length', valid: password.length >= 8, icon: password.length >= 8 ? 'check' : 'x' },
            { id: 'has-upper', valid: /[A-Z]/.test(password), icon: /[A-Z]/.test(password) ? 'check' : 'x' },
            { id: 'has-lower', valid: /[a-z]/.test(password), icon: /[a-z]/.test(password) ? 'check' : 'x' },
            { id: 'has-number', valid: /\d/.test(password), icon: /\d/.test(password) ? 'check' : 'x' },
            { id: 'has-special', valid: /[!@#$%^&*(),.?":{}|<>]/.test(password), icon: /[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'check' : 'x' }
        ];

        checks.forEach(check => {
            const item = document.getElementById(check.id);
            if (item) {
                // 1. Atualiza a classe para o CSS (verde ou vermelho)
                item.classList.toggle('valid', check.valid);
                item.classList.toggle('invalid', !check.valid);
                
                // 2. Atualiza o ícone do Feather
                const iconElement = item.querySelector('.icon-status');
                if (iconElement) {
                    iconElement.setAttribute('data-feather', check.icon);
                }
            }
        });
        
        // 3. Recarrega os ícones do Feather para mostrar a mudança
        if (typeof feather !== 'undefined' && feather.replace) {
            feather.replace(); 
        }
        
        // Limpa a mensagem de erro principal ao começar a digitar a senha
        if(errorMessageDiv) {
             errorMessageDiv.textContent = '';
        }
    }

    // Conecta a função de validação ao evento 'input'
    if (senhaInput) {
        senhaInput.addEventListener('input', updatePasswordValidation);
    }
    
    // Opcional: Limpa mensagem de erro ao digitar na confirmação
    if (confirmarSenhaInput && errorMessageDiv) {
        confirmarSenhaInput.addEventListener('input', () => {
             errorMessageDiv.textContent = '';
        });
    }

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


    // --- 2. LÓGICA DE CADASTRO COM VALIDAÇÃO (REVISADA) ---
    const formCandidato = document.getElementById('form-candidato');
    if (formCandidato) {
        formCandidato.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Assume que existe um campo de erro no cadastro, se não, use alert
            const cadastroErrorMessageDiv = document.getElementById('form-error-message') || errorMessageDiv;
            if (cadastroErrorMessageDiv) cadastroErrorMessageDiv.textContent = '';

            const email = document.getElementById('email-candidato').value;
            const senha = document.getElementById('senha-candidato').value;
            const confirmarSenha = document.getElementById('confirmar-senha-candidato').value;
            const nome = document.getElementById('nome-candidato').value;
            const telefone = document.getElementById('telefone-candidato').value;
            const dataNascimento = document.getElementById('data-nascimento-candidato').value;
            const cursoId = document.getElementById('curso-id-candidato').value;
            const cursoNome = document.getElementById('curso-candidato').value;

            // 1. Validação de Curso
            if (!cursoId) {
                if (cadastroErrorMessageDiv) cadastroErrorMessageDiv.textContent = "Por favor, selecione um curso válido da lista de sugestões.";
                return;
            }
            
            // 2. Validação de Confirmação de Senha
            if (senha !== confirmarSenha) {
                if (cadastroErrorMessageDiv) cadastroErrorMessageDiv.textContent = "As senhas não coincidem. Por favor, tente novamente.";
                return;
            }
            
            // 3. Validação de Força de Senha (Usando a função)
            const passwordCheck = isPasswordStrong(senha);
            if (!passwordCheck.valid) {
                if (cadastroErrorMessageDiv) cadastroErrorMessageDiv.textContent = passwordCheck.message;
                return;
            }

            // Se todas as validações passaram, inicia o cadastro no Firebase
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

                await auth.signOut();

                alert("Cadastro de Candidato realizado com sucesso! Por favor, faça login.");
                window.location.href = 'login-candidato.html';
            } catch (error) {
                console.error("Erro no cadastro:", error);
                
                let friendlyError = error.message;
                if (error.code === 'auth/email-already-in-use') {
                    friendlyError = "Este e-mail já está em uso. Tente fazer login ou use outro e-mail.";
                }
                
                if (cadastroErrorMessageDiv) cadastroErrorMessageDiv.textContent = `Erro ao cadastrar: ${friendlyError}`;
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
            // Adicione aqui a manipulação de erro de login se houver um div para isso no login-candidato.html

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
            e.preventDefault();
            recuperarSenhaCandidato();
        });
    }

    // --- 4. LÓGICA DA PÁGINA DE PERFIL (CORRIGIDA) ---
    const formPerfil = document.getElementById('profile-form');
    
    if (formPerfil) {
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

        // VARIÁVEL DE CONTROLE PARA EVITAR MÚLTIPLOS DISPAROS DE REDIRECIONAMENTO
        let isAuthChecked = false;
        
        auth.onAuthStateChanged(user => {
            if (isAuthChecked) return;
            isAuthChecked = true;

            if (user) {
                // Usuário logado: Carrega dados e configura botões
                carregarDadosDoUsuario(user.uid);
                
                formPerfil.addEventListener('submit', (e) => {
                    e.preventDefault();
                    salvarDadosDoPerfil(user.uid);
                });
                
                if (btnExcluirConta) {
                    btnExcluirConta.addEventListener('click', () => {
                        excluirContaCandidato(user); 
                    });
                }

            } else {
                // Usuário deslogado: Redireciona
                // Apenas se a URL não for a de login
                if (!window.location.href.includes('login-candidato.html') && !window.location.href.includes('cadastro-candidato.html')) {
                    alert("Você precisa estar logado para acessar esta página.");
                    window.location.href = 'login-candidato.html';
                }
            }
        });
    }
    
    // --- 5. CONEXÃO DA FUNÇÃO DE LOGOUT ---
    const btnDeslogar = document.getElementById('btn-deslogar');
    if (btnDeslogar) {
        btnDeslogar.addEventListener('click', (e) => {
            e.preventDefault(); 
            deslogarCandidato(); // Chama a função de logout
        });
    }
});
