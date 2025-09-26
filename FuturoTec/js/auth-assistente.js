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

// --- FUNÇÕES AUXILIARES ---

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

// Função para carregar e exibir os dados na página de perfil
async function preencherDadosDoPerfil() {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // --- USUÁRIO ESTÁ LOGADO ---
            const uid = user.uid;
            try {
                const userDoc = await db.collection('usuarios').doc(uid).get();

                if (userDoc.exists) {
                    const userData = userDoc.data();

                    document.getElementById('user-name').textContent = userData.nome;
                    document.getElementById('user-email').textContent = userData.email;
                    document.getElementById('nome-completo').value = userData.nome;
                    document.getElementById('email').value = userData.email;

                    if (userData.etec_id) {
                        const etecEncontrada = allEtecs.find(etec => etec.id === userData.etec_id);
                        const nomeEtec = etecEncontrada ? `${etecEncontrada.cod} - ${etecEncontrada.nome}` : "ETEC não encontrada";
                        document.getElementById('user-etec-name').textContent = etecEncontrada ? etecEncontrada.nome : "ETEC não encontrada";
                        document.getElementById('nome-etec').value = nomeEtec;
                    } else {
                        document.getElementById('user-etec-name').textContent = "Nenhuma ETEC associada";
                        document.getElementById('nome-etec').value = "Nenhuma ETEC associada";
                    }
                } else {
                    alert("Erro: não foi possível encontrar seus dados.");
                }
            } catch (error) {
                console.error("Erro ao buscar dados do perfil:", error);
                alert("Ocorreu um erro ao carregar seu perfil.");
            }
        } else {
            // --- USUÁRIO NÃO ESTÁ LOGADO ---
            console.log("Nenhum usuário logado. Redirecionando para a página de login.");
            window.location.href = 'login-assistente.html';
        }
    });
}


// --- LÓGICA PRINCIPAL EXECUTADA QUANDO A PÁGINA CARREGA ---

document.addEventListener('DOMContentLoaded', async () => {
    // Carrega os dados das Etecs (necessário para todas as páginas)
    await fetchAllEtecs();

    // --- LÓGICA ESPECÍFICA PARA CADA PÁGINA ---

    // Lógica da PÁGINA DE PERFIL
    if (document.getElementById('profile-form-assistente')) {
        console.log("Página de perfil detectada. Carregando dados...");
        preencherDadosDoPerfil(); // Carrega os dados do usuário

        // Adiciona a funcionalidade de salvar alterações
        const formPerfil = document.getElementById('profile-form-assistente');
        formPerfil.addEventListener('submit', async (e) => {
            e.preventDefault();
            const botaoSalvar = formPerfil.querySelector('.save-button');
            botaoSalvar.disabled = true;
            botaoSalvar.textContent = 'Salvando...';

            try {
                const user = auth.currentUser;
                if (!user) {
                    alert('Sua sessão expirou. Faça login novamente.');
                    return window.location.href = 'login-assistente.html';
                }

                const novoNome = document.getElementById('nome-completo').value;
                if (!novoNome.trim()) {
                    return alert('O nome completo não pode ficar em branco.');
                }

                const userDocRef = db.collection('usuarios').doc(user.uid);
                await userDocRef.update({ nome: novoNome });

                document.getElementById('user-name').textContent = novoNome;
                alert('Dados atualizados com sucesso!');
            } catch (error) {
                console.error("Erro ao atualizar os dados do perfil:", error);
                alert("Não foi possível atualizar seus dados. Tente novamente.");
            } finally {
                botaoSalvar.disabled = false;
                botaoSalvar.textContent = 'Salvar Alterações';
            }
        });
    }

    // Lógica da PÁGINA DE CADASTRO
    if (document.getElementById('form-assistente')) {
        const formCadastro = document.getElementById('form-assistente');
        const inputEtec = document.getElementById('nome-etec');
        const etecResultsContainer = document.getElementById('etec-results');

        if (inputEtec) {
            inputEtec.addEventListener('input', (e) => {
                const query = e.target.value.trim().toLowerCase();
                etecResultsContainer.innerHTML = '';
                if (query.length < 2) return;

                const filteredEtecs = allEtecs.filter(etec =>
                    etec.nome.toLowerCase().includes(query) || etec.cod.includes(query)
                );

                filteredEtecs.forEach(etecData => {
                    const etecItem = document.createElement('div');
                    etecItem.classList.add('etec-result-item');
                    etecItem.innerHTML = `<h4>${etecData.cod} - ${etecData.nome}</h4><p>${etecData.endereco}</p>`;
                    etecItem.addEventListener('click', () => {
                        inputEtec.value = etecData.nome;
                        const enderecoInput = document.getElementById('endereco-etec');
                        if (enderecoInput) enderecoInput.value = etecData.endereco;
                        etecResultsContainer.innerHTML = '';
                    });
                    etecResultsContainer.appendChild(etecItem);
                });
            });
        }

        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-assistente').value;
            const senha = document.getElementById('senha-assistente').value;
            const confirmarSenha = document.getElementById('confirmar-senha-assistente').value;
            const nome = document.getElementById('nome-assistente').value;
            const nomeEtec = document.getElementById('nome-etec').value;
            const emailEtec = document.getElementById('email-etec').value;

            if (senha !== confirmarSenha) return alert("As senhas não coincidem.");

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
                const etecFound = allEtecs.find(etec => etec.nome === nomeEtec || etec.cod === nomeEtec);

                await db.collection('usuarios').doc(userCredential.user.uid).set({
                    role: 'assistente_tecnico',
                    nome: nome,
                    email: email,
                    email_etec: emailEtec,
                    etec_id: etecFound ? etecFound.id : null,
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                });

                alert("Cadastro realizado com sucesso!");
                window.location.href = 'InicialAssistente.html';
            } catch (error) {
                console.error("Erro no cadastro:", error);
                alert(`Erro ao cadastrar: ${error.message}`);
            }
        });
    }

    // Lógica da PÁGINA DE LOGIN
    const formLoginAssistente = document.getElementById('form-login-assistente');
    if (formLoginAssistente) {
        formLoginAssistente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-login-assistente').value;
            const senha = document.getElementById('senha-login-assistente').value;

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, senha);
                const userDoc = await db.collection('usuarios').doc(userCredential.user.uid).get();
                if (userDoc.exists() && userDoc.data().role === 'assistente_tecnico') {
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

    // Lógica genérica para todas as páginas (mostrar/esconder senha)
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
            feather.replace();
        });
    });
});
