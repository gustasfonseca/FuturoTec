// auth-assistente.js

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
// === FUNÇÃO DE LOGIN COM O GOOGLE (CORRIGIDA) ===
// Garante que a conta já exista e tenha o role 'assistente_tecnico'
// =======================================================

async function loginComGoogleAssistente() {
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

        } else if (userData.role !== 'assistente_tecnico') {
            // Bloqueia se o role não for 'assistente_tecnico'
            await auth.signOut();
            throw new Error(`Acesso negado. Esta conta está registrada como ${userData.role}. Use o login correto.`);
        }

        console.log("Perfil de Assistente Técnico existente no Firestore. Login permitido.");
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


// --- FUNÇÕES AUXILIARES ---

// Função para buscar todas as Etecs uma única vez
async function fetchAllEtecs() {
    try {
        // A busca é pública, mas em caso de falha de regras do Firestore, ela falhará aqui.
        const snapshot = await db.collection('etecs').get();
        allEtecs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Dados de todas as Etecs carregados.");
    } catch (error) {
        console.error("Erro ao carregar dados das Etecs:", error);
        // Exibe um erro crítico para o usuário se as Etecs não puderem ser carregadas
        alert("Erro ao carregar lista de ETECs. Verifique as Regras do Firestore.");
    }
}

// Função para carregar e exibir os dados na página de perfil
async function preencherDadosDoPerfil() {
    // Esta função é específica para páginas que exigem login (como Perfil)
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
    // Carrega os dados das Etecs (necessário para todas as páginas que usam o autocomplete, incluindo cadastro)
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

    // Lógica da PÁGINA DE CADASTRO (Corrigida e separada da lógica de autenticação de perfil)
    if (document.getElementById('form-assistente')) {
        const formCadastro = document.getElementById('form-assistente');
        const inputEtec = document.getElementById('nome-etec');
        const etecResultsContainer = document.getElementById('etec-results');
        const inputEnderecoEtec = document.getElementById('endereco-etec');

        // LÓGICA DE AUTOCOMPLETE DA ETEC
        if (inputEtec) {
            inputEtec.addEventListener('input', (e) => {
                const query = e.target.value.trim().toLowerCase();
                etecResultsContainer.innerHTML = '';
                // Limpa o endereço ao começar a digitar
                inputEnderecoEtec.value = '';

                if (query.length < 2) return;

                const filteredEtecs = allEtecs.filter(etec =>
                    // Procura pelo nome OU código
                    etec.nome.toLowerCase().includes(query) || etec.cod.includes(query)
                );

                filteredEtecs.forEach(etecData => {
                    const etecItem = document.createElement('div');
                    etecItem.classList.add('etec-result-item');
                    etecItem.innerHTML = `<h4>${etecData.cod} - ${etecData.nome}</h4><p>${etecData.endereco}</p>`;
                    etecItem.addEventListener('click', () => {
                        inputEtec.value = `${etecData.cod} - ${etecData.nome}`; // Exibe Código e Nome
                        inputEnderecoEtec.value = etecData.endereco;
                        inputEtec.dataset.etecId = etecData.id; // Armazena o ID
                        etecResultsContainer.innerHTML = '';
                    });
                    etecResultsContainer.appendChild(etecItem);
                });
            });
        }

        // Esconde o autocomplete ao clicar fora
        document.addEventListener('click', (e) => {
            if (inputEtec && etecResultsContainer && !inputEtec.contains(e.target) && !etecResultsContainer.contains(e.target)) {
                etecResultsContainer.innerHTML = '';
            }
        });


        // LÓGICA DE SUBMISSÃO DO CADASTRO
        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-assistente').value;
            const senha = document.getElementById('senha-assistente').value;
            const confirmarSenha = document.getElementById('confirmar-senha-assistente').value;
            const nome = document.getElementById('nome-assistente').value;
            const nomeEtec = document.getElementById('nome-etec').value;
            const emailEtec = document.getElementById('email-etec').value;
            const etecId = inputEtec.dataset.etecId; // Pega o ID armazenado no dataset

            if (senha !== confirmarSenha) return alert("As senhas não coincidem.");
            if (!etecId) return alert("Selecione a ETEC na lista de sugestões.");

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);

                // Busca a ETEC apenas para confirmar os dados, embora o ID já tenha sido pego
                const etecFound = allEtecs.find(etec => etec.id === etecId);

                await db.collection('usuarios').doc(userCredential.user.uid).set({
                    role: 'assistente_tecnico',
                    nome: nome,
                    email: email,
                    email_etec: emailEtec,
                    etec_id: etecId, // Usa o ID garantido
                    etec_nome: etecFound ? etecFound.nome : nomeEtec, // Armazena o nome da ETEC também
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                });

                // DESLOGA APÓS O CADASTRO PARA FORÇAR O LOGIN
                await auth.signOut();

                alert("Cadastro realizado com sucesso! Por favor, faça login.");
                window.location.href = 'login-assistente.html';
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
                if (userDoc.exists && userDoc.data().role === 'assistente_tecnico') {
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

    // MANIPULADOR DE EVENTOS PARA O BOTÃO DO GOOGLE
    const btnGoogleLogin = document.getElementById('btn-google-login-assistente');
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const user = await loginComGoogleAssistente();
                if (user) {
                    console.log("Login com Google concluído. Redirecionando...");
                    window.location.href = 'InicialAssistente.html';
                }
            } catch (error) {
                // Erro já tratado na função
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
            // Verifica se feather-icons está carregado antes de chamar replace
            if (typeof feather !== 'undefined' && feather.replace) {
                feather.replace();
            }
        });
    });
});
