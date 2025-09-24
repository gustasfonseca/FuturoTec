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

// Variável para armazenar todas as Etecs
let allEtecs = [];

// Função para buscar todas as Etecs uma única vez
async function fetchAllEtecs() {
    try {
        const snapshot = await db.collection('etecs').get();
        allEtecs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Dados de todas as Etecs carregados.");
    } catch (error) {
        console.error("Erro ao carregar dados das Etecs:", error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Carrega todos os dados das Etecs no início da página
    await fetchAllEtecs();

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

    // Lógica de preenchimento automático da Etec
    const inputEtec = document.getElementById('nome-etec');
    const etecResultsContainer = document.getElementById('etec-results');
    const enderecoEtecInput = document.getElementById('endereco-etec');

    if (inputEtec) {
        inputEtec.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();

            if (query.length < 2) {
                etecResultsContainer.innerHTML = '';
                enderecoEtecInput.value = '';
                return;
            }

            // Filtra os dados no cliente
            const filteredEtecs = allEtecs.filter(etec => 
                etec.nome.toLowerCase().includes(query) || etec.cod.includes(query)
            );

            etecResultsContainer.innerHTML = '';
            
            if (filteredEtecs.length > 0) {
                filteredEtecs.forEach(etecData => {
                    const etecItem = document.createElement('div');
                    etecItem.classList.add('etec-result-item');
                    // ALTERAÇÃO AQUI: Adiciona o código da Etec antes do nome
                    etecItem.innerHTML = `
                        <h4>${etecData.cod} - ${etecData.nome}</h4>
                        <p>${etecData.endereco}</p>
                    `;

                    etecItem.addEventListener('click', () => {
                        inputEtec.value = etecData.nome;
                        enderecoEtecInput.value = etecData.endereco;
                        etecResultsContainer.innerHTML = '';
                    });
                    
                    etecResultsContainer.appendChild(etecItem);
                });
            }
        });
    }

    // Lógica de Cadastro
    const formAssistente = document.getElementById('form-assistente');
    if (formAssistente) {
        formAssistente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-assistente').value;
            const senha = document.getElementById('senha-assistente').value;
            const confirmarSenha = document.getElementById('confirmar-senha-assistente').value;
            const nome = document.getElementById('nome-assistente').value;
            const nomeEtec = document.getElementById('nome-etec').value;
            const emailEtec = document.getElementById('email-etec').value;

            if (senha !== confirmarSenha) {
                alert("As senhas não coincidem.");
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
                const user = userCredential.user;

                let etecId = null;
                const etecFound = allEtecs.find(etec => etec.nome === nomeEtec || etec.cod === nomeEtec);
                if (etecFound) {
                    etecId = etecFound.id;
                }

                const perfilData = {
                    role: 'assistente_tecnico',
                    nome: nome,
                    email: email,
                    email_etec: emailEtec,
                    etec_id: etecId,
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('usuarios').doc(user.uid).set(perfilData);

                alert("Cadastro de Assistente realizado com sucesso!");
                window.location.href = 'InicialAssistente.html'; 
            } catch (error) {
                console.error("Erro no cadastro:", error);
                alert(`Erro ao cadastrar: ${error.message}`);
            }
        });
    }

    // Lógica de Login (sem alterações)
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
                    window.location.href = 'InicialAssistente.html';
                } else {
                    alert("Acesso negado. Este login é apenas para assistentes.");
                    auth.signOut();
                }
            } catch (error) {
                console.error("Erro no login:", error);
                alert(`Erro ao fazer login: ${error.message}`);
            }
        });
    }
});
