// auth-empresa.js

// Certifique-se de incluir a biblioteca do Firebase (firebase-app, firebase-auth, firebase-firestore, firebase-storage) 
// no seu HTML antes deste script, ou usar imports do SDK v9 (se for o caso).

// =================================================================
// CONFIGURAÇÕES NECESSÁRIAS PARA O ALERT MANAGER
// =================================================================
import { showAlert } from './alert-manager.js';

// =======================================================
// === CONFIGURAÇÃO INICIAL DO FIREBASE ===
// =======================================================
const firebaseConfig = {
    // ATENÇÃO: Substitua os placeholders abaixo pelas suas chaves reais
    apiKey: "AIzaSyA8Q9cKB4oVmFM6ilHK_70h8JDvgsOQhLY",
    authDomain: "futurotec-e3a69.firebaseapp.com",
    projectId: "futurotec-e3a69",
    storageBucket: "futurotec-e3a69.firebasestorage.app",
    messagingSenderId: "234233783827",
    appId: "1:234233783827:web:bf9376dee78d8924ef01e6",
    measurementId: "G-C7EEMP1146"
};

// Inicializa o Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// CORREÇÃO APLICADA AQUI: Usando 'export const' e 'export let'
// para que outras partes do código (como empresa.js) possam importar estas instâncias
export const auth = firebase.auth();
export const db = firebase.firestore();

// Inicializa o Storage (verificação para evitar erro se não for usado/importado)
export let storage = null;
if (typeof firebase.storage === 'function') {
    storage = firebase.storage();
}

// =======================================================
// === CORREÇÃO DE PERSISTÊNCIA DE SESSÃO (CHAVE DO PROBLEMA RESOLVIDO) ===
// Garante que o estado de login permaneça no Local Storage
// (mesmo após fechar a aba/navegador)
// =======================================================
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log("Persistência do Firebase Auth definida para LOCAL (sessão mantida).");
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
// (Depende de elementos HTML com IDs específicos e Feather Icons)
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

/**
 * Realiza o login via Google e verifica se a conta existe e é do tipo 'empresa'.
 * @returns {Promise<firebase.User>} O objeto User autenticado.
 */
async function loginComGoogleEmpresa() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        // Garantindo persistência local (embora já configurado globalmente)
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

        // SUBSTITUIÇÃO DO ALERT
        showAlert(errorMessage, 'error');
        throw error;
    }
}

/**
 * Envia um e-mail de redefinição de senha para o e-mail fornecido.
 */
async function recuperarSenhaEmpresa() {
    // O prompt continua sendo a melhor forma para captura de input neste contexto
    const email = prompt("Por favor, digite seu e-mail de Empresa para redefinir a senha:");

    if (!email) {
        // SUBSTITUIÇÃO DO ALERT
        showAlert("Operação cancelada ou e-mail não fornecido.", 'info');
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);

        // SUBSTITUIÇÃO DO ALERT
        showAlert(`E-mail de redefinição de senha enviado para ${email}. Verifique sua caixa de entrada e a pasta de Spam!`, 'success');

    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição:", error);

        let errorMessage = "Erro ao solicitar a redefinição de senha. Verifique se o e-mail está correto e tente novamente.";

        if (error.code === 'auth/user-not-found') {
            errorMessage = "Não encontramos uma conta para este e-mail.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "O formato do e-mail é inválido.";
        }

        // SUBSTITUIÇÃO DO ALERT
        showAlert(`Erro: ${errorMessage}`, 'error');
    }
}

async function excluirContaEmpresa(user) {
    if (!user) {
        // SUBSTITUIÇÃO DO ALERT
        showAlert("Erro: Nenhuma empresa logada.", 'error');
        return;
    }

    const userId = user.uid;
    const userEmail = user.email;

    // O prompt continua sendo a melhor forma para validação de exclusão
    const confirmacaoEmail = prompt(`ATENÇÃO: A exclusão da conta da empresa é PERMANENTE. Você perderá todos os dados (perfil, vagas e candidaturas associadas).\n\nPara confirmar a exclusão, digite seu EMAIL (${userEmail}) no campo abaixo:`);

    if (confirmacaoEmail !== userEmail) {
        // SUBSTITUIÇÃO DO ALERT
        showAlert("E-mail digitado incorretamente ou operação cancelada.", 'info');
        return;
    }

    // A REAUTENTICAÇÃO ABAIXO É O QUE RESOLVE O PROBLEMA DE SEGURANÇA.
    // O prompt continua sendo a melhor forma para validação de segurança
    const confirmacaoSenha = prompt("Por favor, digite sua SENHA (do site) para confirmar a exclusão. (REQUERIDO PELO FIREBASE):");
    if (!confirmacaoSenha) {
        // SUBSTITUIÇÃO DO ALERT
        showAlert("Exclusão cancelada. É necessário informar a senha.", 'info');
        return;
    }

    try {
        // Tenta reautenticar o usuário
        const credential = firebase.auth.EmailAuthProvider.credential(userEmail, confirmacaoSenha);
        await user.reauthenticateWithCredential(credential);
        console.log("[Exclusão Empresa] Reautenticação bem-sucedida. Prosseguindo com a exclusão...");

        // 1. Deleta Vagas e Candidaturas (em Batch)
        const vagasSnapshot = await db.collection('vagas')
            .where('empresaId', '==', userId)
            .get();

        const batch = db.batch();

        for (const doc of vagasSnapshot.docs) {
            const vagaId = doc.id;

            // Busca e adiciona candidaturas para exclusão
            const candidaturasSnapshot = await db.collection('candidaturas')
                .where('vagaId', '==', vagaId)
                .get();

            candidaturasSnapshot.docs.forEach(candidaturaDoc => {
                batch.delete(candidaturaDoc.ref);
            });

            // Adiciona a vaga para exclusão
            batch.delete(doc.ref);
        }
        await batch.commit();
        console.log(`[Exclusão Empresa] ${vagasSnapshot.size} vagas e suas candidaturas relacionadas excluídas.`);

        // 2. Deleta o documento do Firestore
        await db.collection('usuarios').doc(userId).delete();
        console.log("[Exclusão Empresa] Perfil da empresa excluído.");

        // 3. Deleta o usuário do Firebase Auth
        await user.delete();
        console.log("[Exclusão Empresa] Usuário excluído do Firebase Auth. E-mail liberado.");

        // SUBSTITUIÇÃO DO ALERT
        showAlert("Sua conta de empresa foi excluída permanentemente. Você será redirecionado.", 'success');
        window.location.href = 'login-empresa.html';

    } catch (error) {
        console.error("Erro ao excluir a conta da empresa:", error);

        let errorMessage = "Ocorreu um erro ao tentar excluir sua conta.";

        if (error.code === 'auth/wrong-password') {
            errorMessage = "Senha incorreta. A exclusão da conta foi cancelada.";
        } else if (error.code === 'auth/requires-recent-login') {
            // Este caso só deve ocorrer se a reautenticação falhar por algum motivo,
            // mas é um bom backup.
            errorMessage = "Erro de Segurança: Você precisa ter feito login *recentemente* (saia e entre novamente) e tente excluir a conta em seguida.";
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuário não encontrado. Possível problema de autenticação.";
        }

        // SUBSTITUIÇÃO DO ALERT
        showAlert(`${errorMessage} (Detalhes técnicos no console)`, 'error');
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

    // Garante que os ícones iniciais estejam renderizados (se feather estiver disponível)
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
                    // Usa a referência global do firebase para FieldValue
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                });

                // 3. Desloga o usuário e redireciona (boa prática após cadastro)
                await auth.signOut();
                // SUBSTITUIÇÃO DO ALERT
                showAlert("Cadastro de Empresa realizado com sucesso! Por favor, faça login.", 'success');
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
                // Configura persistência local (embora já configurado globalmente)
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); 
                
                const userCredential = await auth.signInWithEmailAndPassword(email, senha);
                const userDoc = await db.collection('usuarios').doc(userCredential.user.uid).get();
                
                btn.textContent = originalText;
                btn.disabled = false;

                if (userDoc.exists && userDoc.data().role === 'empresa') {
                    window.location.href = 'InicialEmpresa.html';
                } else {
                    // SUBSTITUIÇÃO DO ALERT
                    showAlert("Acesso negado. Este login é apenas para empresas.", 'error');
                    auth.signOut(); // Desloga o usuário com role errada
                }
            } catch (error) {
                console.error("Erro no login da Empresa:", error);
                
                let errorMessage = "Erro ao fazer login. Verifique seu e-mail e senha.";

                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                     errorMessage = "E-mail ou senha incorretos.";
                }

                // SUBSTITUIÇÃO DO ALERT
                showAlert(`Erro: ${errorMessage}`, 'error');
                
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
    
    // 6. CONEXÃO DO BOTÃO DE EXCLUIR CONTA
    const btnExcluirConta = document.getElementById('btn-excluir-conta-empresa');
    if (btnExcluirConta) {
        btnExcluirConta.addEventListener('click', () => {
            if (auth.currentUser) {
                // O excluirContaEmpresa usa prompt, o que é aceitável para segurança.
                excluirContaEmpresa(auth.currentUser);
            } else {
                showAlert("Você precisa estar logado para excluir a conta.", 'warning');
            }
        });
    }
    
    // 7. LÓGICA DE DESLOGAR (Se existir um botão com este ID)
    const btnDeslogar = document.getElementById("btn-deslogar");
    if (btnDeslogar) {
        btnDeslogar.addEventListener("click", function () {
            // SUBSTITUIÇÃO DO CONFIRM
            showAlert("Tem certeza que deseja sair da sua conta de Empresa?", 'warning', true) // 'true' para confirmar
                .then(confirmed => {
                    if (confirmed) {
                        logoutEmpresa().catch((error) => {
                             // Erro tratado dentro do logoutEmpresa ou propagado
                             showAlert("Erro ao deslogar. Tente novamente.", 'error');
                        });
                    }
                });
        });
    }
});


// =======================================================
// === VERIFICAÇÃO DE ESTADO DE AUTENTICAÇÃO E REDIRECIONAMENTO (CORRIGIDO) ===
// =======================================================
auth.onAuthStateChanged(async (user) => {
    // Obtém o caminho da página atual e define as flags de páginas públicas
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('login-empresa.html');
    const isSignupPage = path.endsWith('cadastro-empresa.html');
    const isPublicPage = isLoginPage || isSignupPage || path.endsWith('index.html');

    // Verifica se o usuário NÃO ESTÁ logado
    if (!user) {
        // Redireciona APENAS se a página atual não for pública (login, cadastro, index)
        if (!isPublicPage) {
            console.log("Usuário deslogado. Redirecionando para login-empresa.html...");
            // Oculta tudo para evitar piscar de conteúdo
            document.body.style.display = 'none';
            window.location.href = 'login-empresa.html';
        } else {
             // Se estiver em uma página pública (login/cadastro/index) e deslogado, exibe
             document.body.style.display = ''; 
        }
    } else {
        // Usuário logado: Garante que é uma empresa
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        const role = userDoc.exists ? userDoc.data().role : null;

        if (role !== 'empresa') {
            await auth.signOut();
            console.error("Tentativa de acesso não autorizado! Redirecionando...");
            
            // SUBSTITUIÇÃO DO ALERT
            showAlert("Acesso não autorizado. Sua conta não é do tipo Empresa.", 'error');
            
            // Exibe a página de login/cadastro
            if (isPublicPage) {
                document.body.style.display = '';
            }
            window.location.href = 'login-empresa.html';
        } else if (!userDoc.exists) {
            // Conta não encontrada no Firestore, força logout
            await auth.signOut();
            window.location.href = 'login-empresa.html';
        } else {
            // Usuário logado e é uma empresa:

            if (isLoginPage || isSignupPage) {
                // SE ESTIVER LOGADO E NAS PÁGINAS DE LOGIN/CADASTRO: REDIRECIONA PARA INICIAL
                console.log("Usuário logado tentando acessar login/cadastro. Redirecionando para InicialEmpresa.html...");
                document.body.style.display = 'none'; // Esconde antes de redirecionar
                window.location.href = 'InicialEmpresa.html';
            }
            
            // SE ESTIVER EM QUALQUER OUTRA PÁGINA (PERFIL, INICIAL, VAGAS): EXIBE
            // ISSO RESOLVE O LOOP. Se estiver no perfil, ele exibe.
            document.body.style.display = ''; 
        }
    }
});

// =================================================================
// FUNÇÃO DE LOGOUT EXPORTADA (Para uso no PerfilEmpresa) 
// =================================================================
export async function logoutEmpresa() {
    try {
        await auth.signOut();
        // Não é necessário redirecionar aqui, pois o onAuthStateChanged fará isso
    } catch (error) {
        console.error("Erro ao deslogar:", error);
        // Usa o showAlert importado
        showAlert("Erro ao deslogar. Tente novamente.", 'error'); 
        throw error; // Propaga o erro
    }
}
