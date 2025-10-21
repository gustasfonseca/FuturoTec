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

// Define as variáveis globais essenciais
const auth = firebase.auth();
const db = firebase.firestore();

let storage = null;
if (typeof firebase.storage === 'function') {
    storage = firebase.storage();
}

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
// === FUNÇÕES DE AUTENTICAÇÃO (MANTIDAS) ===
// =======================================================

async function loginComGoogleEmpresa() {
    // ... (Sua função loginComGoogleEmpresa permanece inalterada) ...
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
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
    // ... (Sua função recuperarSenhaEmpresa permanece inalterada) ...
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
    // ... (Sua função excluirContaEmpresa permanece inalterada) ...
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
// === LÓGICA DE DOM PRINCIPAL (UNIFICADA) ===
// =======================================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. FUNCIONALIDADE MOSTRAR/ESCONDER SENHA (CORRIGIDA)
    // Busca o ícone da senha
    const passwordToggle = document.querySelector('.password-toggle');
    // Busca o input que o ícone controla (pelo data-target)
    const passwordInput = document.getElementById(passwordToggle ? passwordToggle.dataset.target : null);

    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // Troca o ícone (eye/eye-off)
            if (type === 'password') {
                passwordToggle.innerHTML = '<i data-feather="eye"></i>';
            } else {
                passwordToggle.innerHTML = '<i data-feather="eye-off"></i>';
            }
            
            // Re-renderiza o ícone
            if (typeof feather !== 'undefined') feather.replace(); 
        });
    }

    // Garante que os ícones iniciais estejam renderizados
    if (typeof feather !== 'undefined') feather.replace();

    // 2. LÓGICA DE LOGIN (CORRIGIDA COM EFEITO DE CARREGAMENTO)
    const formLoginEmpresa = document.getElementById('form-login-empresa');
    if (formLoginEmpresa) {
        formLoginEmpresa.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email-login-empresa').value;
            const senha = document.getElementById('senha-login-empresa').value;
            const btn = document.querySelector('.submit-btn');
            const originalText = btn.textContent;
            
            // Efeito de Carregamento
            btn.textContent = 'Aguarde...';
            btn.disabled = true;

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, senha);
                const user = userCredential.user;

                const userDoc = await db.collection('usuarios').doc(user.uid).get();
                const userData = userDoc.data();
                
                // Finaliza o carregamento em caso de sucesso
                btn.textContent = originalText;
                btn.disabled = false;

                if (userData && userData.role === 'empresa') {
                    window.location.href = 'InicialEmpresa.html';
                } else {
                    alert("Acesso negado. Este login é apenas para empresas.");
                    auth.signOut();
                }
            } catch (error) {
                console.error("Erro no login:", error);
                alert(`Erro ao fazer login: ${error.message}`);
                
                // Finaliza o carregamento em caso de falha
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }


    // 3. MANIPULADOR DE EVENTOS PARA O BOTÃO DO GOOGLE
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

    // 4. CONEXÃO DO BOTÃO DE RECUPERAÇÃO DE SENHA
    const btnEsqueciSenha = document.getElementById('btn-esqueci-senha-empresa');
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener('click', (e) => {
            e.preventDefault();
            recuperarSenhaEmpresa();
        });
    }
    
    // 5. LÓGICA DE CADASTRO (Se você usar esse arquivo para cadastro também)
    const formEmpresa = document.getElementById('form-empresa');
    // ... (Sua lógica de cadastro se houver, permanece inalterada aqui) ...
    // ...
    // ...
    
    // 6. LÓGICA DA PÁGINA DE PERFIL (Se você usar esse arquivo para perfil)
    const formPerfilEmpresa = document.getElementById('profile-form-empresa');
    // ... (Sua lógica de perfil se houver, permanece inalterada aqui) ...
    // ...
});
