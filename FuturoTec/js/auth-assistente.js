// auth-assistente.js - VERSÃO CORRIGIDA SEM showAlert

// CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyA8Q9cKB4oVmFM6ilHK_70h8JDvgsOQhLY",
    authDomain: "futurotec-e3a69.firebaseapp.com",
    projectId: "futurotec-e3a69",
    storageBucket: "futurotec-e3a69.firebasestorage.app",
    messagingSenderId: "234233783827",
    appId: "1:234233783827:web:bf9376dee78d8924ef01e6",
    measurementId: "G-C7EEMP1146"
};

// INICIALIZAÇÃO DO FIREBASE
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// VARIÁVEIS GLOBAIS
let allEtecs = [];

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
    const list = document.getElementById('password-validation-list');
    if (!list) return;

    const checks = {
        'val-length': password.length >= 8,
        'val-uppercase': /[A-Z]/.test(password),
        'val-lowercase': /[a-z]/.test(password),
        'val-number': /\d/.test(password),
        'val-special': /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    for (const [id, isValid] of Object.entries(checks)) {
        const item = document.getElementById(id);
        if (item) {
            item.classList.toggle('valid', isValid);
            item.classList.toggle('invalid', !isValid);
            const icon = item.querySelector('.icon-status');
            if (icon) {
                icon.setAttribute('data-feather', isValid ? 'check-circle' : 'x-circle');
            }
        }
    }
    // Reaplicar os ícones do Feather
    if (typeof feather !== 'undefined' && feather.replace) {
        feather.replace();
    }
}

// =======================================================
// === FUNÇÃO DE EXCLUSÃO DE CONTA (Assistente Técnico) ===
// =======================================================
async function excluirContaAssistente(user) {
    if (!user) {
        alert("Erro: Nenhum assistente logado.");
        return;
    }
    const userId = user.uid;
    const userEmail = user.email;
    const confirmacaoEmail = prompt(`ATENÇÃO: A exclusão da conta do assistente técnico é PERMANENTE.\n\nPara confirmar a exclusão, digite seu EMAIL (${userEmail}) no campo abaixo:`);
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
        console.log("[Exclusão Assistente] Reautenticação bem-sucedida.");
        console.log("[Exclusão Assistente] Excluindo perfil do assistente...");
        await db.collection('usuarios').doc(userId).delete();
        console.log("[Exclusão Assistente] Perfil do assistente excluído.");
        await user.delete();
        console.log("[Exclusão Assistente] Usuário excluído do Firebase Auth. E-mail liberado.");
        
        alert("Sua conta de assistente técnico foi excluída permanentemente. Você será redirecionado.");
        window.location.href = 'login-assistente.html';
    } catch (error) {
        console.error("Erro ao excluir a conta do assistente técnico:", error);
        let errorMessage = "Ocorreu um erro ao tentar excluir sua conta.";
        if (error.code === 'auth/wrong-password') {
            errorMessage = "Senha incorreta. A exclusão da conta foi cancelada.";
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = "Erro de Segurança: Você precisa ter feito login *recentemente* (saia e entre novamente) e tente excluir a conta em seguida.";
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuário não encontrado. Possível problema de autenticação.";
        } else if (error.code === 'permission-denied') {
            errorMessage = "Erro de Permissão: Verifique as regras de segurança do Firestore (Coleção 'usuarios').";
        }
        alert(errorMessage);
    }
}

// =======================================================
// === FUNÇÃO DE LOGIN COM O GOOGLE ===
// =======================================================
async function loginComGoogleAssistente() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        console.log("Login do Google bem-sucedido no Auth:", user);
        const userRef = db.collection('usuarios').doc(user.uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data();
        if (!userSnap.exists) {
            await auth.signOut();
            throw new Error("Conta não encontrada. Por favor, cadastre-se usando o formulário de e-mail/senha primeiro.");
        } else if (userData.role !== 'assistente_tecnico') {
            await auth.signOut();
            throw new Error(`Acesso negado. Esta conta está registrada como ${userData.role}. Use o login correto.`);
        }
        console.log("Perfil de Assistente Técnico existente no Firestore. Login permitido.");
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

// =======================================================
// === FUNÇÃO DE RECUPERAÇÃO DE SENHA ===
// =======================================================
async function recuperarSenhaAssistente() {
    const email = prompt("Por favor, digite seu e-mail de Assistente Técnico para redefinir a senha:");
    if (!email) {
        alert("Operação cancelada ou e-mail não fornecido.");
        return;
    }
    try {
        await auth.sendPasswordResetEmail(email);
        alert(`E-mail de redefinição de senha enviado para ${email}. Verifique sua caixa de entrada e a pasta de Spam!`);
    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição:", error);
        let errorMessage = "Erro ao solicitar a redefinição de senha. Verifique se o e-mail está correto e tente novamente.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "Não encontramos uma conta para este e-mail.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "O formato do e-mail é inválido.";
        }
        alert(errorMessage);
    }
}

// =======================================================
// === FUNÇÕES AUXILIARES ===
// =======================================================
async function fetchAllEtecs() {
    try {
        const snapshot = await db.collection('etecs').get();
        allEtecs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log("Dados de todas as Etecs carregados.");
    } catch (error) {
        console.error("Erro ao carregar dados das Etecs:", error);
        alert("Erro ao carregar lista de ETECs. Verifique as Regras do Firestore.");
    }
}

// =======================================================
// === LÓGICA PRINCIPAL - LOGIN DO ASSISTENTE ===
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    const formLoginAssistente = document.getElementById('form-login-assistente');
    
    if (formLoginAssistente) {
        formLoginAssistente.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email-login-assistente').value;
            const senha = document.getElementById('senha-login-assistente').value;
            const submitBtn = formLoginAssistente.querySelector('.submit-btn');
            
            // Estado de loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Entrando...';
            
            try {
                console.log("Tentando login...");
                const userCredential = await auth.signInWithEmailAndPassword(email, senha);
                const user = userCredential.user;
                
                console.log("Login bem-sucedido, verificando role...");
                const userDoc = await db.collection('usuarios').doc(user.uid).get();
                
                if (userDoc.exists() && userDoc.data().role === 'assistente_tecnico') {
                    alert('Login realizado com sucesso!');
                    window.location.href = 'InicialAssistente.html';
                } else {
                    await auth.signOut();
                    alert('Acesso negado. Este login é apenas para assistentes.');
                }
                
            } catch (error) {
                console.error("Erro no login:", error);
                
                let errorMessage = "Erro ao fazer login. Verifique seus dados.";
                if (error.code === 'auth/user-not-found') {
                    errorMessage = "E-mail não encontrado.";
                } else if (error.code === 'auth/wrong-password') {
                    errorMessage = "Senha incorreta.";
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = "E-mail inválido.";
                }
                
                alert(errorMessage);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar';
            }
        });
    }

    // Botão Google
    const btnGoogleLogin = document.getElementById('btn-google-login-assistente');
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const user = await loginComGoogleAssistente();
                if (user) {
                    alert('Login com Google realizado!');
                    window.location.href = 'InicialAssistente.html';
                }
            } catch (error) {
                // Erro já tratado na função
            }
        });
    }

    // Esqueci senha
    const btnEsqueciSenha = document.getElementById('btn-esqueci-senha-assistente');
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener('click', (e) => {
            e.preventDefault();
            recuperarSenhaAssistente();
        });
    }

    // Mostrar/esconder senha
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
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        });
    });
});
