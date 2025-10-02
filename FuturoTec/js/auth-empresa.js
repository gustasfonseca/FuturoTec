// auth-empresa.js

// COLOQUE SUAS CREDENCIAIS DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "AIzaSyA8Q9cKB4oVmFM6ilHK_70h8JDvgsOQhLY",
    authDomain: "futurotec-e3a69.firebaseapp.com",
    projectId: "futurotec-e3a69",
    storageBucket: "futurotec-e3a69.firebasestorage.app",
    messagingSenderId: "234233783827",
    appId: "1:234233783827:web:bf9376dee78d8924ef01e6",
    measurementId: "G-C7EEMP1146"
};

// Inicializa o Firebase e define as variáveis globais
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); // Variável global essencial para a recuperação de senha
const db = firebase.firestore();

// =======================================================
// === FUNÇÃO DE LOGIN COM O GOOGLE ===
// =======================================================

async function loginComGoogleEmpresa() {
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

        const errorMessage = error.message.includes("Conta não encontrada")
            ? error.message
            : error.message.includes("Acesso negado")
                ? error.message
                : `Erro ao fazer login com o Google. Tente novamente. Detalhe: ${error.message}`;

        alert(errorMessage);
        throw error;
    }
}

// =======================================================
// === FUNÇÃO DE RECUPERAÇÃO DE SENHA PARA EMPRESA (IMPLEMENTAÇÃO) ===
// =======================================================

async function recuperarSenhaEmpresa() {
    // 1. Pede o email do usuário (a mensagem no prompt está correta para Empresa)
    const email = prompt("Por favor, digite seu e-mail de Empresa para redefinir a senha:");

    // 2. Verifica se o usuário digitou algo
    if (!email) {
        alert("Operação cancelada ou e-mail não fornecido.");
        return;
    }

    try {
        // 3. Envia o e-mail de redefinição de senha USANDO O OBJETO 'auth' GLOBAL
        await auth.sendPasswordResetEmail(email);

        alert(`✅ E-mail de redefinição de senha enviado para ${email}. Verifique sua caixa de entrada e a pasta de Spam!`);

    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição:", error);

        // Mensagens de erro amigáveis baseadas no código do Firebase
        let errorMessage = "Erro ao solicitar a redefinição de senha. Verifique se o e-mail está correto e tente novamente.";
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = "Não encontramos uma conta para este e-mail.";
        } else if (error.code === 'auth/invalid-email') {
             errorMessage = "O formato do e-mail é inválido.";
        }

        alert(`❌ Erro: ${errorMessage}`);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // Lógica de exibir/esconder senha (mantida)
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const icon = toggle.querySelector('i');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.setAttribute('data-feather', 'eye-off');
            } else {
                passwordInput.type = 'password';
                icon.setAttribute('data-feather', 'eye');
            }
            feather.replace();
        });
    });

    // Lógica de Cadastro (mantida)
    const formEmpresa = document.getElementById('form-empresa');
    if (formEmpresa) {
        formEmpresa.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-empresa').value;
            const senha = document.getElementById('senha-empresa').value;
            const confirmarSenha = document.getElementById('confirmar-senha-empresa').value;
            const nome = document.getElementById('nome-empresa').value;
            const cnpj = document.getElementById('cnpj-empresa').value;

            if (senha !== confirmarSenha) {
                alert("As senhas não coincidem.");
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
                const user = userCredential.user;

                const perfilData = {
                    role: 'empresa',
                    nome: nome,
                    cnpj: cnpj,
                    email: email,
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('usuarios').doc(user.uid).set(perfilData);

                await auth.signOut();

                alert("Cadastro de Empresa realizado com sucesso! Por favor, faça login.");
                window.location.href = 'login-empresa.html';
            } catch (error) {
                console.error("Erro no cadastro:", error);
                alert(`Erro ao cadastrar: ${error.message}`);
            }
        });
    }

    // Lógica de Login (mantida)
    const formLoginEmpresa = document.getElementById('form-login-empresa');
    if (formLoginEmpresa) {
        formLoginEmpresa.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-login-empresa').value;
            const senha = document.getElementById('senha-login-empresa').value;

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, senha);
                const user = userCredential.user;

                const userDoc = await db.collection('usuarios').doc(user.uid).get();
                const userData = userDoc.data();

                if (userData && userData.role === 'empresa') {
                    window.location.href = 'InicialEmpresa.html';
                } else {
                    alert("Acesso negado. Este login é apenas para empresas.");
                    auth.signOut();
                }
            } catch (error) {
                console.error("Erro no login:", error);
                alert(`Erro ao fazer login: ${error.message}`);
            }
        });
    }

    // MANIPULADOR DE EVENTOS PARA O BOTÃO DO GOOGLE (mantido)
    const btnGoogleLogin = document.getElementById('btn-google-login-empresa');
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const user = await loginComGoogleEmpresa();
                if (user) {
                    console.log("Login com Google concluído. Redirecionando...");
                    window.location.href = 'InicialEmpresa.html';
                }
            } catch (error) {
                // Erro já tratado na função
            }
        });
    }
    
    // === CONEXÃO DO BOTÃO DE RECUPERAÇÃO DE SENHA (CRÍTICO) ===
    const btnEsqueciSenha = document.getElementById('btn-esqueci-senha-empresa');
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener('click', (e) => {
            e.preventDefault(); // Impede que o link recarregue a página
            recuperarSenhaEmpresa(); // Chama a função implementada acima
        });
    }
});
