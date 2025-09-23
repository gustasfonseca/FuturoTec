// COLOQUE SUAS CREDENCIAIS DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    projectId: "SEU_PROJECT_ID",
    // ... outras chaves
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
    const formAssistente = document.getElementById('form-assistente');
    if (formAssistente) {
        formAssistente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-assistente').value;
            const senha = document.getElementById('senha-assistente').value;
            const confirmarSenha = document.getElementById('confirmar-senha-assistente').value;
            const nome = document.getElementById('nome-assistente').value;
            const etec = document.getElementById('etec-assistente').value;

            if (senha !== confirmarSenha) {
                alert("As senhas não coincidem.");
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
                const user = userCredential.user;

                const perfilData = {
                    role: 'assistente_tecnico',
                    nome: nome,
                    etec: etec,
                    email: email,
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('usuarios').doc(user.uid).set(perfilData);

                alert("Cadastro de Assistente Técnico realizado com sucesso!");
                window.location.href = 'index-assistente.html';
            } catch (error) {
                console.error("Erro no cadastro:", error);
                alert(`Erro ao cadastrar: ${error.message}`);
            }
        });
    }
    
    // Lógica de Login
    const formLoginAssistente = document.getElementById('form-login-assistente');
    if (formLoginAssistente) {
        formLoginAssistente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-login-assistente').value;
            const senha = document.getElementById('senha-login-assistente').value;

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, senha);
                const user = userCredential.user;

                const userDoc = await db.collection('usuarios').doc(user.uid).get();
                const userData = userDoc.data();

                if (userData && userData.role === 'assistente_tecnico') {
                    window.location.href = 'index-assistente.html';
                } else {
                    alert("Acesso negado. Este login é apenas para assistentes técnicos.");
                    auth.signOut();
                }
            } catch (error) {
                console.error("Erro no login:", error);
                alert(`Erro ao fazer login: ${error.message}`);
            }
        });
    }
});