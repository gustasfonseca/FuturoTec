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

document.addEventListener('DOMContentLoaded', () => {
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

    // Lógica de Cadastro
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

                alert("Cadastro de Empresa realizado com sucesso!");
                window.location.href = 'InicialEmpresa.html'; 
            } catch (error) {
                console.error("Erro no cadastro:", error);
                alert(`Erro ao cadastrar: ${error.message}`);
            }
        });
    }

    // Lógica de Login
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
});
