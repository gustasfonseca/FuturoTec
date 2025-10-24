// auth-empresa.js

// =======================================================
// === CONFIGURAÇÃO INICIAL DO FIREBASE ===
// =======================================================
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

// ATENÇÃO: Removido 'const' e 'let' para que as variáveis sejam GLOBAIS
// e acessíveis por 'empresa.js'
auth = firebase.auth();
db = firebase.firestore();

storage = null;
if (typeof firebase.storage === 'function') {
    storage = firebase.storage();
}

// =======================================================
// === CORREÇÃO DE PERSISTÊNCIA DE SESSÃO ===
// Garante que o estado de login permaneça mesmo após fechar a aba/navegador.
// Isso resolve o problema de ter que logar novamente.
// =======================================================
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log("Persistência do Firebase Auth definida para LOCAL.");
    })
    .catch((error) => {
        console.error("Erro ao definir persistência do Firebase Auth:", error);
    });

// =======================================================
// === FUNÇÃO DE VALIDAÇÃO DE SENHA FORTE ===
// =======================================================
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
// === FUNÇÃO DE ATUALIZAÇÃO DA INTERFACE DE VALIDAÇÃO ===
// =======================================================
function updatePasswordValidationUI(password) {
    // Usamos o ID específico para a lista de validação da empresa
    const list = document.getElementById('password-validation-list-empresa');
    if (!list) return;

    const checks = {
        'val-length-empresa': password.length >= 8,
        'val-uppercase-empresa': /[A-Z]/.test(password),
        'val-lowercase-empresa': /[a-z]/.test(password),
        'val-number-empresa': /\d/.test(password),
        'val-special-empresa': /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    for (const [id, isValid] of Object.entries(checks)) {
        const item = document.getElementById(id);
        if (item) {
            item.classList.toggle('valid', isValid);
            item.classList.toggle('invalid', !isValid);
            const icon = item.querySelector('.icon-status');
            if (icon) {
                // Atualiza o atributo do ícone
                icon.setAttribute('data-feather', isValid ? 'check-circle' : 'x-circle');
            }
        }
    }
    // Reaplicar os ícones do Feather para que as mudanças sejam visíveis
    if (typeof feather !== 'undefined' && feather.replace) {
        feather.replace();
    }
}


// =======================================================
// === FUNÇÕES DE AUTENTICAÇÃO ===
// =======================================================

async function loginComGoogleEmpresa() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        // A persistência já foi definida globalmente, mas mantemos aqui por segurança, 
        // caso esta função seja chamada antes da inicialização global.
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); 
        
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        const userRef = db.collection('usuarios').doc(user.uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userSnap.exists) {
            await auth.signOut();
            throw new Error("Conta não encontrada. Por favor, cadastre-se usando o formulário de e-mail/senha primeiro.");
        } else if (userData.role !== 'empresa') {
            await auth.signOut();
            throw new Error(`Acesso negado. Esta conta está registrada como ${userData.role}. Use o login correto.`);
        }

        return user;

    } catch (error) {
        console.error("Erro no login com o Google:", error);

        const errorMessage = error.message.includes("Conta não encontrada") ?
            error.message :
            error.message.includes("Acesso negado") ?
            error.message :
            `Erro ao fazer login com o Google. Tente novamente. Detalhe: ${error.message}`;

        alert(errorMessage);
        throw error;
    }
}

async function recuperarSenhaEmpresa() {
    const email = prompt("Por favor, digite seu e-mail de Empresa para redefinir a senha:");

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
            errorMessage = "Não encontramos uma conta para este e-mail.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "O formato do e-mail é inválido.";
        }

        alert(`❌ Erro: ${errorMessage}`);
    }
}

async function excluirContaEmpresa(user) {
    if (!user) {
        alert("Erro: Nenhuma empresa logada.");
        return;
    }

    const userId = user.uid;
    const userEmail = user.email;

    const confirmacaoEmail = prompt(`ATENÇÃO: A exclusão da conta da empresa é PERMANENTE. Você perderá todos os dados (perfil, vagas e candidaturas associadas).\n\nPara confirmar a exclusão, digite seu EMAIL (${userEmail}) no campo abaixo:`);

    if (confirmacaoEmail !== userEmail) {
        alert("E-mail digitado incorretamente ou operação cancelada.");
        return;
    }

    const confirmacaoSenha = prompt("Por favor, digite sua SENHA (do site) para confirmar a exclusão. (REQUERIDO PELO FIREBASE):");
    if (!confirmacaoSenha) {
        alert("Exclusão cancelada. É necessário informar a senha.");
        return;
    }

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(userEmail, confirmacaoSenha);
        await user.reauthenticateWithCredential(credential);
        console.log("[Exclusão Empresa] Reautenticação bem-sucedida.");

        const vagasSnapshot = await db.collection('vagas')
            .where('empresaId', '==', userId)
            .get();

        const batch = db.batch();

        for (const doc of vagasSnapshot.docs) {
            const vagaId = doc.id;

            const candidaturasSnapshot = await db.collection('candidaturas')
                .where('vagaId', '==', vagaId)
                .get();

            candidaturasSnapshot.docs.forEach(candidaturaDoc => {
                batch.delete(candidaturaDoc.ref);
            });

            batch.delete(doc.ref);
        }
        await batch.commit();
        console.log(`[Exclusão Empresa] ${vagasSnapshot.size} vagas e suas candidaturas relacionadas excluídas.`);

        await db.collection('usuarios').doc(userId).delete();
        console.log("[Exclusão Empresa] Perfil da empresa excluído.");

        await user.delete();
        console.log("[Exclusão Empresa] Usuário excluído do Firebase Auth. E-mail liberado.");

        alert("✅ Sua conta de empresa foi excluída permanentemente. Você será redirecionado.");
        window.location.href = 'login-empresa.html';

    } catch (error) {
        console.error("Erro ao excluir a conta da empresa:", error);

        let errorMessage = "Ocorreu um erro ao tentar excluir sua conta.";

        if (error.code === 'auth/wrong-password') {
            errorMessage = "Senha incorreta. A exclusão da conta foi cancelada.";
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = "Erro de Segurança: Você precisa ter feito login *recentemente* (saia e entre novamente) e tente excluir a conta em seguida.";
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuário não encontrado. Possível problema de autenticação.";
        }

        alert(`❌ ${errorMessage} (Detalhes técnicos no console)`);
    }
}


// =======================================================
// === LÓGICA DE DOM PRINCIPAL ===
// =======================================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. FUNCIONALIDADE MOSTRAR/ESCONDER SENHA (Unificada para todos os .password-toggle)
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
            if (typeof feather !== 'undefined' && feather.replace) {
                feather.replace();
            }
        });
    });

    // Garante que os ícones iniciais estejam renderizados
    if (typeof feather !== 'undefined') feather.replace();

    // 2. LÓGICA DE CADASTRO (Implementação Completa)
    const formEmpresa = document.getElementById('form-empresa');
    if (formEmpresa) {
        const inputSenhaEmpresa = document.getElementById('senha-empresa');
        const errorMessageDiv = document.getElementById('form-error-message-empresa');
        
        // Listener para ATUALIZAÇÃO DA VALIDAÇÃO EM TEMPO REAL
        if (inputSenhaEmpresa) {
            inputSenhaEmpresa.addEventListener('keyup', (e) => {
                updatePasswordValidationUI(e.target.value);
            });
        }

        // LÓGICA DE SUBMISSÃO DO CADASTRO
        formEmpresa.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMessageDiv.textContent = ''; // Limpa erros anteriores

            const email = document.getElementById('email-empresa').value;
            const senha = document.getElementById('senha-empresa').value;
            const confirmarSenha = document.getElementById('confirmar-senha-empresa').value;
            const nomeEmpresa = document.getElementById('nome-empresa').value;
            const cnpj = document.getElementById('cnpj-empresa').value;

            // VALIDAÇÕES
            if (senha !== confirmarSenha) {
                errorMessageDiv.textContent = "As senhas não coincidem.";
                return;
            }
            if (cnpj.length !== 14 || isNaN(cnpj)) {
                errorMessageDiv.textContent = "O CNPJ deve ter 14 dígitos e conter somente números.";
                return;
            }
            
            // VALIDAÇÃO DE SENHA FORTE
            const passwordCheck = isPasswordStrong(senha);
            if (!passwordCheck.valid) {
                errorMessageDiv.textContent = passwordCheck.message;
                return; 
            }

            // Efeito visual no botão
            const btn = document.querySelector('.submit-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Criando Conta...';
            btn.disabled = true;

            try {
                // 1. Cria o usuário no Firebase Auth
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);

                // 2. Cria o documento no Firestore com a role 'empresa'
                await db.collection('usuarios').doc(userCredential.user.uid).set({
                    role: 'empresa',
                    nome: nomeEmpresa,
                    email: email,
                    cnpj: cnpj,
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                });

                // 3. Desloga o usuário e redireciona
                await auth.signOut();
                alert("✅ Cadastro de Empresa realizado com sucesso! Por favor, faça login.");
                window.location.href = 'login-empresa.html';

            } catch (error) {
                console.error("Erro no cadastro da Empresa:", error);
                let msg = error.message;
                if (error.code === 'auth/email-already-in-use') {
                    msg = "Este e-mail já está em uso por outra conta.";
                }
                errorMessageDiv.textContent = `❌ Erro ao cadastrar: ${msg}`;
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }


    // 3. LÓGICA DE LOGIN 
    const formLoginEmpresa = document.getElementById('form-login-empresa');
    if (formLoginEmpresa) {
        formLoginEmpresa.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-login-empresa').value;
            const senha = document.getElementById('senha-login-empresa').value;
            const btn = document.querySelector('.submit-btn');
            const originalText = btn.textContent;
            
            btn.textContent = 'Aguarde...';
            btn.disabled = true;

            try {
                // A persistência já foi definida globalmente, mas mantemos aqui por segurança.
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); 
                
                const userCredential = await auth.signInWithEmailAndPassword(email, senha);
                const userDoc = await db.collection('usuarios').doc(userCredential.user.uid).get();
                
                btn.textContent = originalText;
                btn.disabled = false;

                if (userDoc.exists && userDoc.data().role === 'empresa') {
                    window.location.href = 'InicialEmpresa.html';
                } else {
                    alert("Acesso negado. Este login é apenas para empresas.");
                    auth.signOut();
                }
            } catch (error) {
                console.error("Erro no login da Empresa:", error);
                alert(`Erro ao fazer login: ${error.message}`);
                
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // 4. MANIPULADOR DE EVENTOS PARA o BOTÃO DO GOOGLE 
    const btnGoogleLogin = document.getElementById('btn-google-login-empresa');
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const user = await loginComGoogleEmpresa();
                if (user) {
                    window.location.href = 'InicialEmpresa.html';
                }
            } catch (error) {
                // Erro já tratado na função
            }
        });
    }

    // 5. CONEXÃO DO BOTÃO DE RECUPERAÇÃO DE SENHA 
    const btnEsqueciSenha = document.getElementById('btn-esqueci-senha-empresa');
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener('click', (e) => {
            e.preventDefault();
            recuperarSenhaEmpresa();
        });
    }
    
    // 6. LÓGICA DE DESLOGAR (Se existir um botão com este ID)
    const btnDeslogar = document.getElementById("btn-deslogar");
    if (btnDeslogar) {
        btnDeslogar.addEventListener("click", function () {
            if (confirm("Tem certeza que deseja sair da sua conta de Empresa?")) {
                // Usa a variável global 'auth'
                auth.signOut().then(() => {
                    window.location.href = "login-empresa.html";
                }).catch((error) => {
                    console.error("Erro ao deslogar:", error);
                    alert("Erro ao deslogar. Tente novamente.");
                });
            }
        });
    }
});
