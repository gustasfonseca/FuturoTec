// =======================================================
// === CONFIGURAÇÃO INICIAL DO FIREBASE ===
// =======================================================

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

// **Removida:** const API_BASE_URL = 'http://localhost:8080'; (Não será mais usada para exclusão)

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Define as variáveis globais essenciais
const auth = firebase.auth(); 
const db = firebase.firestore();

// Correção para o TypeError: `firebase.storage is not a function`
// Se o SDK foi carregado no HTML, esta linha agora funcionará.
let storage = null;
if (typeof firebase.storage === 'function') {
    storage = firebase.storage();
}


// =======================================================
// === FUNÇÕES DE AUTENTICAÇÃO (MANTIDAS) ===
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

async function recuperarSenhaEmpresa() {
    const email = prompt("Por favor, digite seu e-mail de Empresa para redefinir a senha:");

    if (!email) {
        alert("Operação cancelada ou e-mail não fornecido.");
        return;
    }

    try {
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


// =======================================================
// === FUNÇÃO DE EXCLUSÃO DE CONTA (Empresa) - CORRIGIDA ===
// =======================================================
// Esta função substitui a versão que falhava ao chamar http://localhost:8080/perfil

async function excluirContaEmpresa(user) {
    if (!user) {
        alert("Erro: Nenhuma empresa logada.");
        return;
    }

    const userId = user.uid;
    const userEmail = user.email;

    // 1. Confirmação de Segurança (Digitando o E-mail)
    const confirmacaoEmail = prompt(`ATENÇÃO: A exclusão da conta da empresa é PERMANENTE. Você perderá todos os dados (perfil, vagas e candidaturas associadas).

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
        console.log("[Exclusão Empresa] Reautenticação bem-sucedida.");

        // PASSO B: EXCLUIR DADOS RELACIONADOS (Vagas e Candidaturas)
        // Usamos um 'batch' para garantir que as exclusões sejam atômicas.
        console.log("[Exclusão Empresa] Iniciando exclusão de vagas e candidaturas relacionadas...");
        const vagasSnapshot = await db.collection('vagas')
            .where('empresaId', '==', userId)
            .get();

        const batch = db.batch();
        
        for (const doc of vagasSnapshot.docs) {
            const vagaId = doc.id;
            
            // 1. Excluir candidaturas (registros na coleção 'candidaturas')
            const candidaturasSnapshot = await db.collection('candidaturas')
                .where('vagaId', '==', vagaId)
                .get();
            
            candidaturasSnapshot.docs.forEach(candidaturaDoc => {
                batch.delete(candidaturaDoc.ref);
            });
            
            // 2. Excluir a própria vaga
            batch.delete(doc.ref);
        }
        await batch.commit();
        console.log(`[Exclusão Empresa] ${vagasSnapshot.size} vagas e suas candidaturas relacionadas excluídas.`);
        
        // PASSO C: EXCLUIR DADOS DO PERFIL (Coleção 'usuarios')
        console.log("[Exclusão Empresa] Excluindo perfil da empresa...");
        await db.collection('usuarios').doc(userId).delete();
        console.log("[Exclusão Empresa] Perfil da empresa excluído.");

        // PASSO D: EXCLUIR O USUÁRIO DO FIREBASE AUTH (LIBERA O E-MAIL)
        // Isso impede que o e-mail fique preso, gerando o erro de cadastro
        await user.delete();
        console.log("[Exclusão Empresa] Usuário excluído do Firebase Auth. E-mail liberado.");

        alert("✅ Sua conta de empresa foi excluída permanentemente. Você será redirecionado.");
        window.location.href = 'login-empresa.html'; 

    } catch (error) {
        console.error("Erro ao excluir a conta da empresa:", error);
        
        let errorMessage = "Ocorreu um erro ao tentar excluir sua conta.";
        
        if (error.code === 'auth/wrong-password') {
             errorMessage = "Senha incorreta. A exclusão da conta foi cancelada.";
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = "Erro de Segurança: Você precisa ter feito login *recentemente* (saia e entre novamente) e tente excluir a conta em seguida.";
        } else if (error.code === 'auth/user-not-found') {
             errorMessage = "Usuário não encontrado. Possível problema de autenticação.";
        }
        
        alert(`❌ ${errorMessage} (Detalhes técnicos no console)`);
    }
}


// =======================================================
// === LÓGICA DE DOM (MANTIDA) ===
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    // Lógica de exibir/esconder senha (mantida)
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        const targetId = toggle.getAttribute('data-target');
        const passwordInput = document.getElementById(targetId);
        const icon = toggle.querySelector('i');
        if (passwordInput && icon) { 
            toggle.addEventListener('click', () => {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.setAttribute('data-feather', 'eye-off');
                } else {
                    passwordInput.type = 'password';
                    icon.setAttribute('data-feather', 'eye');
                }
                if (typeof feather !== 'undefined') feather.replace();
            });
        }
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

    // MANIPULADOR DE EVENTOS PARA O BOTÃO DO GOOGLE (PONTO CHAVE)
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
    
    // CONEXÃO DO BOTÃO DE RECUPERAÇÃO DE SENHA (mantido)
    const btnEsqueciSenha = document.getElementById('btn-esqueci-senha-empresa');
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener('click', (e) => {
            e.preventDefault();
            recuperarSenhaEmpresa();
        });
    }
    
    // =======================================================
    // === LÓGICA DA PÁGINA DE PERFIL DA EMPRESA (CARREGAR/SALVAR/EXCLUIR) ===
    // =======================================================
    const formPerfilEmpresa = document.getElementById('profile-form-empresa');
    
    if (formPerfilEmpresa) {
        const btnExcluirConta = document.getElementById('btn-excluir-conta-empresa');

        const carregarDadosDaEmpresa = async (userId) => {
            try {
                const doc = await db.collection('usuarios').doc(userId).get();
                if (!doc.exists) { return; }

                const data = doc.data();

                document.getElementById('user-name').textContent = data.nome || 'Nome da Empresa';
                document.getElementById('user-email').textContent = data.email || '';
                document.getElementById('email').value = data.email || '';
                document.getElementById('nome-empresa').value = data.nome || '';
                document.getElementById('cnpj-empresa').value = data.cnpj || '';

                if (data.logoUrl) {
                    document.getElementById('profile-img').src = data.logoUrl;
                }

            } catch (error) {
                console.error("Erro ao carregar dados:", error);
            }
        };

        const salvarDadosDoPerfil = async (userId) => {
            const dadosParaSalvar = {
                nome: document.getElementById('nome-empresa').value,
                cnpj: document.getElementById('cnpj-empresa').value,
                dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('usuarios').doc(userId).set(dadosParaSalvar, { merge: true });
                alert("Alterações salvas com sucesso!");
                document.getElementById('user-name').textContent = dadosParaSalvar.nome;
            } catch (error) {
                console.error("Erro ao salvar:", error);
                alert(`Erro ao salvar: ${error.message}`);
            }
        };

        auth.onAuthStateChanged(user => {
            if (user) {
                carregarDadosDaEmpresa(user.uid);
                
                formPerfilEmpresa.addEventListener('submit', (e) => {
                    e.preventDefault();
                    salvarDadosDoPerfil(user.uid);
                });
                
                if (btnExcluirConta) {
                    btnExcluirConta.addEventListener('click', () => {
                        excluirContaEmpresa(user); 
                    });
                }

            } else {
                alert("Você precisa estar logado para acessar esta página.");
                window.location.href = 'login-empresa.html';
            }
        });
    }
});
