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
// === FUNÇÃO DE EXCLUSÃO DE CONTA (Assistente Técnico) ===
// =======================================================

async function excluirContaAssistente(user) {
    if (!user) {
        alert("Erro: Nenhum assistente logado.");
        return;
    }

    const userId = user.uid;
    const userEmail = user.email;

    // 1. Confirmação de Segurança (Digitando o E-mail)
    const confirmacaoEmail = prompt(`ATENÇÃO: A exclusão da conta do assistente técnico é PERMANENTE.

Para confirmar a exclusão, digite seu EMAIL (${userEmail}) no campo abaixo:`);

    if (confirmacaoEmail !== userEmail) {
        alert("E-mail digitado incorretamente ou operação cancelada.");
        return;
    }

    // 2. Confirmação de Segurança (Digitando a Senha do site para Reautenticação)
    const confirmacaoSenha = prompt("Por favor, digite sua SENHA (do site) para confirmar a exclusão. (REQUERIDO PELO FIREBASE):");
    if (!confirmacaoSenha) {
        alert("Exclusão cancelada. É necessário informar a senha.");
        return;
    }

    try {
        // PASSO A: RE-AUTENTICAÇÃO (CRÍTICO PARA SEGURANÇA)
        const credential = firebase.auth.EmailAuthProvider.credential(userEmail, confirmacaoSenha);
        await user.reauthenticateWithCredential(credential);
        console.log("[Exclusão Assistente] Reautenticação bem-sucedida.");

        // PASSO B: EXCLUIR DADOS DO PERFIL (Coleção 'usuarios')
        // Se este perfil estiver associado a outros documentos, eles também devem ser excluídos
        // mas aqui estamos deletando apenas o perfil principal.
        console.log("[Exclusão Assistente] Excluindo perfil do assistente...");
        await db.collection('usuarios').doc(userId).delete();
        console.log("[Exclusão Assistente] Perfil do assistente excluído.");

        // PASSO C: EXCLUIR O USUÁRIO DO FIREBASE AUTH
        await user.delete();
        console.log("[Exclusão Assistente] Usuário excluído do Firebase Auth. E-mail liberado.");

        alert("✅ Sua conta de assistente técnico foi excluída permanentemente. Você será redirecionado.");
        window.location.href = 'login-assistente.html'; 

    } catch (error) {
        console.error("Erro ao excluir a conta do assistente técnico:", error);
        
        let errorMessage = "Ocorreu um erro ao tentar excluir sua conta.";
        
        if (error.code === 'auth/wrong-password') {
             errorMessage = "Senha incorreta. A exclusão da conta foi cancelada.";
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = "Erro de Segurança: Você precisa ter feito login *recentemente* (saia e entre novamente) e tente excluir a conta em seguida.";
        } else if (error.code === 'auth/user-not-found') {
             errorMessage = "Usuário não encontrado. Possível problema de autenticação.";
        } else if (error.code === 'permission-denied') {
             errorMessage = "Erro de Permissão: Verifique as regras de segurança do Firestore (Coleção 'usuarios').";
        }
        
        alert(`❌ ${errorMessage} (Detalhes técnicos no console)`);
    }
}


// =======================================================
// === FUNÇÃO DE LOGIN COM O GOOGLE (MANTIDA) ===
// =======================================================

async function loginComGoogleAssistente() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        console.log("Login do Google bem-sucedido no Auth:", user);

        const userRef = db.collection('usuarios').doc(user.uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userSnap.exists) {
            await auth.signOut();
            throw new Error("Conta não encontrada. Por favor, cadastre-se usando o formulário de e-mail/senha primeiro.");

        } else if (userData.role !== 'assistente_tecnico') {
            await auth.signOut();
            throw new Error(`Acesso negado. Esta conta está registrada como ${userData.role}. Use o login correto.`);
        }

        console.log("Perfil de Assistente Técnico existente no Firestore. Login permitido.");
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
// === FUNÇÃO DE RECUPERAÇÃO DE SENHA (MANTIDA) ===
// =======================================================

async function recuperarSenhaAssistente() {
    // 1. Pede o email do usuário
    const email = prompt("Por favor, digite seu e-mail de Assistente Técnico para redefinir a senha:");

    if (!email) {
        alert("Operação cancelada ou e-mail não fornecido.");
        return;
    }

    try {
        // 2. Envia o e-mail de redefinição de senha usando o objeto 'auth'
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


// --- FUNÇÕES AUXILIARES E LÓGICA DE DOM (MANTIDAS/AJUSTADAS) ---

async function fetchAllEtecs() {
    try {
        const snapshot = await db.collection('etecs').get();
        allEtecs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Dados de todas as Etecs carregados.");
    } catch (error) {
        console.error("Erro ao carregar dados das Etecs:", error);
        alert("Erro ao carregar lista de ETECs. Verifique as Regras do Firestore.");
    }
}

async function preencherDadosDoPerfil() {
    // Usa onAuthStateChanged para garantir que o usuário está carregado
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const uid = user.uid;
            try {
                const userDoc = await db.collection('usuarios').doc(uid).get();

                if (userDoc.exists) {
                    const userData = userDoc.data();

                    document.getElementById('user-name').textContent = userData.nome || 'Assistente Técnico';
                    document.getElementById('user-email').textContent = userData.email || 'N/A';
                    document.getElementById('nome-completo').value = userData.nome || '';
                    document.getElementById('email').value = userData.email || '';

                    if (userData.etec_id) {
                        const etecEncontrada = allEtecs.find(etec => etec.id === userData.etec_id);
                        const nomeEtec = etecEncontrada ? `${etecEncontrada.cod} - ${etecEncontrada.nome}` : "ETEC não encontrada";
                        document.getElementById('user-etec-name').textContent = etecEncontrada ? etecEncontrada.nome : "ETEC não encontrada";
                        document.getElementById('nome-etec').value = nomeEtec;
                    } else {
                        document.getElementById('user-etec-name').textContent = "Nenhuma ETEC associada";
                        document.getElementById('nome-etec').value = "Nenhuma ETEC associada";
                    }
                    
                    // Conecta o botão de exclusão de conta
                    const btnExcluirConta = document.getElementById('btn-excluir-conta-assistente');
                    if (btnExcluirConta) {
                        btnExcluirConta.addEventListener('click', () => {
                            excluirContaAssistente(user);
                        });
                    }

                } else {
                    alert("Erro: não foi possível encontrar seus dados.");
                }
            } catch (error) {
                console.error("Erro ao buscar dados do perfil:", error);
                alert("Ocorreu um erro ao carregar seu perfil.");
            }
        } else {
            console.log("Nenhum usuário logado. Redirecionando para a página de login.");
            window.location.href = 'login-assistente.html';
        }
    });
}


// --- LÓGICA PRINCIPAL EXECUTADA QUANDO A PÁGINA CARREGA ---

document.addEventListener('DOMContentLoaded', async () => {
    // Carrega a lista de ETECs (necessário para o autocomplete)
    await fetchAllEtecs();

    // Lógica da PÁGINA DE PERFIL
    if (document.getElementById('profile-form-assistente')) {
        console.log("Página de perfil detectada. Carregando dados...");
        preencherDadosDoPerfil();

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

    // Lógica da PÁGINA DE CADASTRO (MANTIDA)
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
                inputEnderecoEtec.value = ''; // Limpa o endereço ao digitar

                if (query.length < 2) return;

                const filteredEtecs = allEtecs.filter(etec =>
                    etec.nome.toLowerCase().includes(query) || etec.cod.includes(query)
                );

                filteredEtecs.forEach(etecData => {
                    const etecItem = document.createElement('div');
                    etecItem.classList.add('etec-result-item');
                    etecItem.innerHTML = `<h4>${etecData.cod} - ${etecData.nome}</h4><p>${etecData.endereco}</p>`;
                    etecItem.addEventListener('click', () => {
                        inputEtec.value = `${etecData.cod} - ${etecData.nome}`; 
                        inputEnderecoEtec.value = etecData.endereco;
                        inputEtec.dataset.etecId = etecData.id; 
                        etecResultsContainer.innerHTML = ''; // Esconde os resultados
                    });
                    etecResultsContainer.appendChild(etecItem);
                });
            });
        }

        // Esconde o autocomplete ao clicar fora (COM CORREÇÃO DE ERRO)
        document.addEventListener('click', (e) => {
            if (!e.target || !(e.target instanceof Element)) { 
                return;
            }

            if (inputEtec && etecResultsContainer) {
                if (!inputEtec.contains(e.target) && !etecResultsContainer.contains(e.target)) {
                    etecResultsContainer.innerHTML = '';
                }
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
            const etecId = inputEtec.dataset.etecId; 

            if (senha !== confirmarSenha) return alert("As senhas não coincidem.");
            if (!etecId) return alert("Selecione a ETEC na lista de sugestões.");

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);

                const etecFound = allEtecs.find(etec => etec.id === etecId);

                await db.collection('usuarios').doc(userCredential.user.uid).set({
                    role: 'assistente_tecnico',
                    nome: nome,
                    email: email,
                    etec_id: etecId, 
                    etec_nome: etecFound ? etecFound.nome : nomeEtec, 
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                });

                await auth.signOut();

                alert("Cadastro realizado com sucesso! Por favor, faça login.");
                window.location.href = 'login-assistente.html';
            } catch (error) {
                console.error("Erro no cadastro:", error);
                alert(`Erro ao cadastrar: ${error.message}`);
            }
        });
    }

    // Lógica da PÁGINA DE LOGIN (MANTIDA)
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

    // MANIPULADOR DE EVENTOS PARA O BOTÃO DO GOOGLE (MANTIDO)
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

    // Lógica genérica para todas as páginas (mostrar/esconder senha) (MANTIDA)
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

    // === CONEXÃO DO BOTÃO DE RECUPERAÇÃO DE SENHA (MANTIDA) ===
    const btnEsqueciSenha = document.getElementById('btn-esqueci-senha-assistente');
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener('click', (e) => {
            e.preventDefault(); 
            recuperarSenhaAssistente(); 
        });
    }
});
