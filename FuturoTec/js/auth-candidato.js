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

    // Lógica para mostrar/esconder senha
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
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('usuarios').doc(user.uid).set(perfilData);

                alert("Cadastro de Candidato realizado com sucesso!");
                window.location.href = 'InicialAluno.html'; 
            } catch (error) {
                console.error("Erro no cadastro:", error);
                alert(`Erro ao cadastrar: ${error.message}`);
            }
        });
    }

    // Lógica de Login
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
});
