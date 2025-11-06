// =======================================================
// auth-assistente.js - VERSÃO COMPLETA E UNIFICADA
// =======================================================

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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// VARIÁVEIS GLOBAIS
let allEtecs = [];
let selectedEtecId = null;

// =======================================================
// === FUNÇÃO DE VALIDAÇÃO DE SENHA FORTE ===
// =======================================================
function isPasswordStrong(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength)
        return { valid: false, message: 'A senha deve ter no mínimo 8 caracteres.' };
    if (!hasUpperCase)
        return { valid: false, message: 'A senha deve conter pelo menos uma letra maiúscula.' };
    if (!hasLowerCase)
        return { valid: false, message: 'A senha deve conter pelo menos uma letra minúscula.' };
    if (!hasNumbers)
        return { valid: false, message: 'A senha deve conter pelo menos um número.' };
    if (!hasSpecialChars)
        return { valid: false, message: 'A senha deve conter pelo menos um caractere especial (ex: !@#$).' };

    return { valid: true, message: '' };
}

// =======================================================
// === ATUALIZAÇÃO DA INTERFACE DE VALIDAÇÃO DE SENHA ===
// =======================================================
function updatePasswordValidationUI(password) {
    const list = document.getElementById('password-validation-list');
    if (!list) return;

    const checks = {
        'val-length': password.length >= 8,
        'val-uppercase': /[A-Z]/.test(password),
        'val-lowercase': /[a-z]/.test(password),
        'val-number': /\d/.test(password),
        'val-special': /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    for (const [id, isValid] of Object.entries(checks)) {
        const item = document.getElementById(id);
        if (item) {
            item.classList.toggle('valid', isValid);
            item.classList.toggle('invalid', !isValid);
            const icon = item.querySelector('.icon-status');
            if (icon) {
                icon.setAttribute('data-feather', isValid ? 'check-circle' : 'x-circle');
            }
        }
    }
    if (typeof feather !== 'undefined' && feather.replace) {
        feather.replace();
    }
}

// =======================================================
// === FUNÇÃO DE EXCLUSÃO DE CONTA ===
// =======================================================
async function excluirContaAssistente(user) {
    if (!user) {
        alert("Erro: Nenhum assistente logado.");
        return;
    }

    const userId = user.uid;
    const userEmail = user.email;
    const confirmacaoEmail = prompt(
        `ATENÇÃO: A exclusão da conta do assistente técnico é PERMANENTE.\n\nPara confirmar a exclusão, digite seu EMAIL (${userEmail}) no campo abaixo:`
    );

    if (confirmacaoEmail !== userEmail) {
        alert("E-mail digitado incorretamente ou operação cancelada.");
        return;
    }

    const confirmacaoSenha = prompt("Por favor, digite sua SENHA para confirmar a exclusão:");
    if (!confirmacaoSenha) {
        alert("Exclusão cancelada. É necessário informar a senha.");
        return;
    }

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(userEmail, confirmacaoSenha);
        await user.reauthenticateWithCredential(credential);
        await db.collection('usuarios').doc(userId).delete();
        await user.delete();

        alert("Sua conta foi excluída permanentemente.");
        window.location.href = 'login-assistente.html';
    } catch (error) {
        console.error("Erro ao excluir a conta:", error);
        let errorMessage = "Ocorreu um erro ao tentar excluir sua conta.";
        if (error.code === 'auth/wrong-password')
            errorMessage = "Senha incorreta. Operação cancelada.";
        else if (error.code === 'auth/requires-recent-login')
            errorMessage = "Faça login novamente antes de excluir sua conta.";
        alert(errorMessage);
    }
}

// =======================================================
// === LOGIN COM GOOGLE ===
// =======================================================
async function loginComGoogleAssistente() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const userRef = db.collection('usuarios').doc(user.uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            await auth.signOut();
            throw new Error("Conta não encontrada. Cadastre-se primeiro.");
        } else if (userSnap.data().role !== 'assistente_tecnico') {
            await auth.signOut();
            throw new Error("Acesso negado. Use o login correto.");
        }

        alert("Login com Google realizado!");
        return user;
    } catch (error) {
        alert(`Erro ao fazer login: ${error.message}`);
        throw error;
    }
}

// =======================================================
// === RECUPERAÇÃO DE SENHA ===
// =======================================================
async function recuperarSenhaAssistente() {
    const email = prompt("Digite seu e-mail para redefinir a senha:");
    if (!email) return;

    try {
        await auth.sendPasswordResetEmail(email);
        alert(`E-mail de redefinição enviado para ${email}.`);
    } catch (error) {
        console.error("Erro:", error);
        let msg = "Erro ao redefinir senha.";
        if (error.code === 'auth/user-not-found')
            msg = "E-mail não encontrado.";
        else if (error.code === 'auth/invalid-email')
            msg = "E-mail inválido.";
        alert(msg);
    }
}

// =======================================================
// === CARREGAR TODAS AS ETECs ===
// =======================================================
async function fetchAllEtecs() {
    try {
        const snapshot = await db.collection('etecs').get();
        allEtecs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log(`Dados de ${allEtecs.length} ETECs carregados.`);
    } catch (error) {
        console.error("Erro ao carregar ETECs:", error);
        alert("Erro ao carregar lista de ETECs.");
        allEtecs = [];
    }
}

// =======================================================
// === AUTOCOMPLETE DE ETEC ===
// =======================================================
function setupEtecAutocomplete() {
    const input = document.getElementById('etec-input-field');
    const suggestionsContainer = document.getElementById('etec-results');
    const addressInput = document.getElementById('endereco-etec');

    if (!input || !suggestionsContainer || !addressInput) {
        console.error("Elementos do autocomplete não encontrados:", {
            input: !!input,
            suggestionsContainer: !!suggestionsContainer,
            addressInput: !!addressInput
        });
        return;
    }

    console.log("Autocomplete configurado com sucesso!");

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        suggestionsContainer.innerHTML = '';
        selectedEtecId = null;
        addressInput.value = '';

        if (query.length < 3) return;

        const sourceEtecs = Array.isArray(allEtecs) ? allEtecs : [];

       const filtered = sourceEtecs.filter(etec =>
            (etec.nome && etec.nome.toLowerCase().includes(query)) ||
            (etec.id && etec.id.toLowerCase().includes(query))
        );

        if (filtered.length > 0) {
            filtered.slice(0, 8).forEach(etec => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = `${etec.nome} ${etec.codigo ? `(${etec.codigo})` : ''}`;
                item.addEventListener('click', () => {
                    input.value = etec.nome;
                    suggestionsContainer.innerHTML = '';
                    selectedEtecId = etec.id;
                    addressInput.value = etec.endereco || 'Endereço não disponível';
                    console.log("ETEC selecionada:", etec.nome, "ID:", etec.id);
                });
                suggestionsContainer.appendChild(item);
            });
        } else {
            suggestionsContainer.innerHTML =
                '<div class="autocomplete-item no-results">Nenhuma ETEC encontrada.</div>';
        }
    });

    document.addEventListener('click', (e) => {
        const etecInputArea = input.parentElement;
        if (!etecInputArea.contains(e.target)) {
            suggestionsContainer.innerHTML = '';
        }
    });
}

// =======================================================
// === FUNÇÕES DE PERFIL: CARREGAMENTO E EDIÇÃO ===
// =======================================================
async function carregarDadosDoPerfil(user) {
    console.log(`[Perfil] Carregando dados para o usuário UID: ${user.uid}`);
    
    // 1. Preenche o Email (vem do Auth)
    const emailElements = document.querySelectorAll('#user-email, #email');
    emailElements.forEach(el => {
        if (el.tagName === 'INPUT') {
            el.value = user.email;
        } else {
            el.textContent = user.email;
        }
    });
    console.log("[Perfil] Email do Auth carregado.");

    try {
        // 2. Busca dados adicionais do Firestore
        const doc = await db.collection('usuarios').doc(user.uid).get();

        if (doc.exists) {
            const dados = doc.data();
            console.log("[Perfil] Dados do Firestore recebidos (SUCESSO):", dados);

            // 3. Preenche Nome Completo (Título e Campo)
            const userNameElement = document.getElementById('user-name');
            const nomeCompletoElement = document.getElementById('nome-completo');
            
            if (userNameElement) userNameElement.textContent = dados.nome || dados.nomeCompleto || 'Nome não definido';
            if (nomeCompletoElement) nomeCompletoElement.value = dados.nome || dados.nomeCompleto || '';

            // 4. Preenche Nome da ETEC (Título e Campo)
            const userEtecElement = document.getElementById('user-etec-name');
            const nomeEtecElement = document.getElementById('nome-etec');
            
            if (userEtecElement) userEtecElement.textContent = dados.etecNome || dados.nomeETEC || 'ETEC não associada';
            if (nomeEtecElement) nomeEtecElement.value = dados.etecNome || dados.nomeETEC || '';
            
        } else {
            console.warn("[Perfil] Documento de perfil não encontrado no Firestore.");
        }

    } catch (error) {
        console.error("[Perfil] Erro ao carregar dados do Firestore:", error);
    }
}

async function salvarAlteracoesPerfil(user) {
    const nomeCompletoInput = document.getElementById('nome-completo');
    if (!nomeCompletoInput) return;
    
    const nomeCompleto = nomeCompletoInput.value.trim();
    const saveButton = document.querySelector('.save-button');
    
    if (!nomeCompleto) {
        alert("O Nome Completo é obrigatório.");
        return;
    }
    
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';
    }

    try {
        await db.collection('usuarios').doc(user.uid).set({
            nome: nomeCompleto,
            nomeCompleto: nomeCompleto
        }, { merge: true });

        alert("Alterações salvas com sucesso!");
        await carregarDadosDoPerfil(user);

    } catch (error) {
        console.error("Erro ao salvar alterações do perfil:", error);
        alert("Falha ao salvar. Tente novamente.");
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Salvar Alterações';
        }
    }
}

// =======================================================
// === LÓGICA PRINCIPAL UNIFICADA ===
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    // Verifica o tipo de página
    const isCadastroPage = window.location.pathname.includes('cadastro-assistente.html');
    const isLoginPage = window.location.pathname.includes('login-assistente.html');
    const isProfilePage = document.querySelector('.profile-page-container') || 
                         window.location.pathname.includes('perfil-assistente');

    // ===================================================
    // LÓGICA PARA PÁGINA DE CADASTRO
    // ===================================================
    if (isCadastroPage) {
        console.log("Iniciando configuração da página de CADASTRO...");
        
        fetchAllEtecs().then(setupEtecAutocomplete);

        const inputSenha = document.getElementById('senha-assistente');
        if (inputSenha) {
            inputSenha.addEventListener('keyup', e => updatePasswordValidationUI(e.target.value));
        }

        const formCadastro = document.getElementById('form-assistente');
        if (formCadastro) {
            formCadastro.addEventListener('submit', async (e) => {
                e.preventDefault();

                const errorMessageDiv = document.getElementById('form-error-message');
                errorMessageDiv.textContent = '';

                const nome = document.getElementById('nome-assistente').value;
                const email = document.getElementById('email-assistente').value;
                const senha = document.getElementById('senha-assistente').value;
                const confirmarSenha = document.getElementById('confirmar-senha-assistente').value;
                const nomeEtec = document.getElementById('etec-input-field').value;

                if (senha !== confirmarSenha) {
                    errorMessageDiv.textContent = "As senhas não coincidem.";
                    return;
                }

                const passwordCheck = isPasswordStrong(senha);
                if (!passwordCheck.valid) {
                    errorMessageDiv.textContent = passwordCheck.message;
                    return;
                }

                if (!selectedEtecId) {
                    errorMessageDiv.textContent = "Por favor, selecione a ETEC na lista sugerida.";
                    return;
                }

                const submitBtn = formCadastro.querySelector('.submit-btn');
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Criando Conta...';

                try {
                    const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
                    await db.collection('usuarios').doc(userCredential.user.uid).set({
                        role: 'assistente_tecnico',
                        nome: nome,
                        email: email,
                        etecNome: nomeEtec,
                        etecId: selectedEtecId,
                        dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    await auth.signOut();
                    alert("✅ Cadastro realizado com sucesso!");
                    window.location.href = 'login-assistente.html';
                } catch (error) {
                    console.error("Erro no cadastro:", error);
                    let msg = error.message;
                    if (error.code === 'auth/email-already-in-use') {
                        msg = "Este e-mail já está em uso.";
                    }
                    errorMessageDiv.textContent = `❌ Erro ao cadastrar: ${msg}`;
                } finally {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            });
        }
    }

    // ===================================================
    // LÓGICA PARA PÁGINA DE LOGIN
    // ===================================================
    if (isLoginPage) {
        const formLoginAssistente = document.getElementById('form-login-assistente');
        if (formLoginAssistente) {
            formLoginAssistente.addEventListener('submit', async (e) => {
                e.preventDefault();

                const email = document.getElementById('email-login-assistente').value;
                const senha = document.getElementById('senha-login-assistente').value;
                const submitBtn = formLoginAssistente.querySelector('.submit-btn');

                submitBtn.disabled = true;
                submitBtn.textContent = 'Entrando...';

                try {
                    const userCredential = await auth.signInWithEmailAndPassword(email, senha);
                    const user = userCredential.user;
                    const userDoc = await db.collection('usuarios').doc(user.uid).get();

                    if (userDoc.exists && userDoc.data().role === 'assistente_tecnico') {
                        alert('Login realizado com sucesso!');
                        window.location.href = 'InicialAssistente.html';
                    } else {
                        await auth.signOut();
                        alert('Acesso negado. Este login é apenas para assistentes.');
                    }
                } catch (error) {
                    console.error("Erro no login:", error);
                    let errorMessage = "Erro ao fazer login.";
                    if (error.code === 'auth/user-not-found') errorMessage = "E-mail não encontrado.";
                    else if (error.code === 'auth/wrong-password') errorMessage = "Senha incorreta.";
                    else if (error.code === 'auth/invalid-email') errorMessage = "E-mail inválido.";
                    alert(errorMessage);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Entrar';
                }
            });
        }

        // LOGIN GOOGLE
        const btnGoogleLogin = document.getElementById('btn-google-login-assistente');
        if (btnGoogleLogin) {
            btnGoogleLogin.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const user = await loginComGoogleAssistente();
                    if (user) window.location.href = 'InicialAssistente.html';
                } catch {}
            });
        }

        // ESQUECI SENHA
        const btnEsqueciSenha = document.getElementById('btn-esqueci-senha-assistente');
        if (btnEsqueciSenha) {
            btnEsqueciSenha.addEventListener('click', (e) => {
                e.preventDefault();
                recuperarSenhaAssistente();
            });
        }
    }

    // ===================================================
    // LÓGICA PARA PÁGINA DE PERFIL (Auth State Changed)
    // ===================================================
    if (isProfilePage) {
        auth.onAuthStateChanged(user => {
            if (user) {
                console.log("Assistente logado. Carregando Perfil...");
                
                carregarDadosDoPerfil(user);

                // Configura o botão SALVAR PERFIL
                const formPerfil = document.getElementById('profile-form-assistente');
                if (formPerfil) {
                    formPerfil.addEventListener('submit', (e) => {
                        e.preventDefault();
                        salvarAlteracoesPerfil(user);
                    });
                }

                // Configura o botão DESLOGAR
                const btnDeslogar = document.getElementById('btn-deslogar');
                if (btnDeslogar) {
                    btnDeslogar.addEventListener('click', async () => {
                        await auth.signOut();
                        alert("Deslogado com sucesso.");
                        window.location.href = 'login-assistente.html';
                    });
                }

                // Configura o botão EXCLUIR CONTA
                const btnExcluirConta = document.getElementById('btn-excluir-conta-assistente');
                if (btnExcluirConta) {
                    btnExcluirConta.addEventListener('click', () => {
                        excluirContaAssistente(user);
                    });
                }

            } else {
                console.log("[Perfil] Usuário não autenticado. Redirecionando...");
                if (!window.location.href.includes('login-assistente.html')) {
                    window.location.href = 'login-assistente.html';
                }
            }
        });
    }

    // ===================================================
    // FUNÇÕES GLOBAIS (todas as páginas)
    // ===================================================
    
    // MOSTRAR/ESCONDER SENHA
    document.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            if (!passwordInput) return;

            const icon = toggle.querySelector('i');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                if (icon) icon.setAttribute('data-feather', 'eye-off');
            } else {
                passwordInput.type = 'password';
                if (icon) icon.setAttribute('data-feather', 'eye');
            }
            if (typeof feather !== 'undefined') feather.replace();
        });
    });
});

