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

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =======================================================
// === FUNÇÃO DE LOGIN COM O GOOGLE (CORRIGIDA) ===
// Garante que a conta já exista e tenha o role 'empresa'
// =======================================================

async function loginComGoogleEmpresa() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        // 1. Inicia o pop-up de login e autentica o usuário no Firebase Auth
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        console.log("Login do Google bem-sucedido no Auth:", user);

        // 2. Verifica o perfil na sua coleção 'usuarios' do Firestore
        const userRef = db.collection('usuarios').doc(user.uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userSnap.exists) {
            // SE O DOCUMENTO NO FIRESTORE NÃO EXISTE: BLOQUEAR LOGIN!
            await auth.signOut();
            throw new Error("Conta não encontrada. Por favor, cadastre-se usando o formulário de e-mail/senha primeiro.");

        } else if (userData.role !== 'empresa') {
            // Bloqueia se o role não for 'empresa'
            await auth.signOut();
            throw new Error(`Acesso negado. Esta conta está registrada como ${userData.role}. Use o login correto.`);
        }

        console.log("Perfil de empresa existente no Firestore. Login permitido.");
        return user;

    } catch (error) {
        // Trata o erro de pop-up, conta não encontrada ou role incorreto
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

    // Lógica de Cadastro (CORRIGIDA para deslogar)
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

                // CORREÇÃO: Desloga após o cadastro para forçar o login
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

    // MANIPULADOR DE EVENTOS PARA O BOTÃO DO GOOGLE (NOVO)
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
});
