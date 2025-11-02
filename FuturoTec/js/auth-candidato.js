// auth-candidato.js

import { showAlert } from './alert-manager.js';

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "sua-api-key",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "seu-sender-id",
    appId: "seu-app-id"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Cadastro do Candidato
document.addEventListener('DOMContentLoaded', function() {
    const formCadastro = document.getElementById('form-candidato');
    
    if (formCadastro) {
        formCadastro.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Coletar dados do formulário
            const nome = document.getElementById('nome-candidato').value;
            const telefone = document.getElementById('telefone-candidato').value;
            const email = document.getElementById('email-candidato').value;
            const dataNascimento = document.getElementById('data-nascimento-candidato').value;
            const cursoId = document.getElementById('curso-id-candidato').value;
            const cursoNome = document.getElementById('curso-candidato').value;
            const linkedin = document.getElementById('linkedin-candidato').value; // NOVO CAMPO
            const resumoHabilidades = document.getElementById('resumo-habilidades').value;
            const experienciasProfissionais = document.getElementById('experiencias-profissionais').value;
            const senha = document.getElementById('senha-candidato').value;
            const confirmarSenha = document.getElementById('confirmar-senha-candidato').value;

            // Validação de senha
            if (senha !== confirmarSenha) {
                showAlert('error', 'As senhas não coincidem!');
                return;
            }

            // Validação de força da senha
            if (!validarSenha(senha)) {
                showAlert('error', 'A senha não atende aos requisitos de segurança!');
                return;
            }

            try {
                // Criar usuário no Authentication
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
                const user = userCredential.user;

                // Salvar dados adicionais no Firestore
                await db.collection('candidatos').doc(user.uid).set({
                    nome: nome,
                    telefone: telefone,
                    email: email,
                    dataNascimento: dataNascimento,
                    cursoId: cursoId,
                    cursoNome: cursoNome,
                    linkedin: linkedin, // SALVAR LINKEDIN
                    resumoHabilidades: resumoHabilidades,
                    experienciasProfissionais: experienciasProfissionais,
                    dataCriacao: new Date(),
                    tipo: 'candidato'
                });

                showAlert('success', 'Cadastro realizado com sucesso!');
                
                // Redirecionar após 2 segundos
                setTimeout(() => {
                    window.location.href = 'InicialAluno.html';
                }, 2000);

            } catch (error) {
                console.error('Erro no cadastro:', error);
                let errorMessage = 'Erro ao realizar cadastro. Tente novamente.';
                
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'Este email já está em uso.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Email inválido.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Senha muito fraca.';
                        break;
                }
                
                showAlert('error', errorMessage);
            }
        });
    }

    // Validação de senha em tempo real
    const senhaInput = document.getElementById('senha-candidato');
    if (senhaInput) {
        senhaInput.addEventListener('input', function() {
            validarSenhaEmTempoReal(this.value);
        });
    }

    // Verificação de confirmação de senha
    const confirmarSenhaInput = document.getElementById('confirmar-senha-candidato');
    if (confirmarSenhaInput) {
        confirmarSenhaInput.addEventListener('input', function() {
            const senha = document.getElementById('senha-candidato').value;
            const confirmarSenha = this.value;
            const errorMessage = document.getElementById('password-error-message');
            
            if (senha !== confirmarSenha && confirmarSenha.length > 0) {
                errorMessage.textContent = 'As senhas não coincidem!';
            } else {
                errorMessage.textContent = '';
            }
        });
    }
});

// Função para validar senha
function validarSenha(senha) {
    const minLength = senha.length >= 8;
    const hasUpper = /[A-Z]/.test(senha);
    const hasLower = /[a-z]/.test(senha);
    const hasNumber = /[0-9]/.test(senha);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha);
    
    return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
}

// Validação de senha em tempo real
function validarSenhaEmTempoReal(senha) {
    const validations = {
        'min-length': senha.length >= 8,
        'has-upper': /[A-Z]/.test(senha),
        'has-lower': /[a-z]/.test(senha),
        'has-number': /[0-9]/.test(senha),
        'has-special': /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)
    };

    for (const [id, isValid] of Object.entries(validations)) {
        const element = document.getElementById(id);
        if (element) {
            const icon = element.querySelector('.icon-status');
            if (isValid) {
                element.classList.remove('invalid');
                element.classList.add('valid');
                icon.setAttribute('data-feather', 'check');
            } else {
                element.classList.remove('valid');
                element.classList.add('invalid');
                icon.setAttribute('data-feather', 'x');
            }
            feather.replace();
        }
    }
}

// Gerenciamento do Perfil do Candidato
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se estamos na página de perfil
    const profileForm = document.getElementById('profile-form');
    const profileProfissionalForm = document.getElementById('profile-profissional-form');
    
    if (profileForm || profileProfissionalForm) {
        carregarPerfilUsuario();
        
        // Configurar formulário de dados pessoais
        if (profileForm) {
            profileForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                await salvarDadosPessoais();
            });
        }
        
        // Configurar formulário de perfil profissional
        if (profileProfissionalForm) {
            profileProfissionalForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                await salvarPerfilProfissional();
            });
        }
        
        // Configurar botão de deslogar
        const btnDeslogar = document.getElementById('btn-deslogar');
        if (btnDeslogar) {
            btnDeslogar.addEventListener('click', deslogarUsuario);
        }
        
        // Configurar botão de excluir conta
        const btnExcluirConta = document.getElementById('btn-excluir-conta');
        if (btnExcluirConta) {
            btnExcluirConta.addEventListener('click', excluirConta);
        }
    }
});

// Carregar perfil do usuário
async function carregarPerfilUsuario() {
    try {
        const user = auth.currentUser;
        if (!user) {
            window.location.href = 'login-candidato.html';
            return;
        }

        const userDoc = await db.collection('candidatos').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Preencher dados pessoais
            document.getElementById('user-name').textContent = userData.nome || 'Usuário';
            document.getElementById('user-email').textContent = userData.email || '';
            document.getElementById('email').value = userData.email || '';
            document.getElementById('nome-completo').value = userData.nome || '';
            document.getElementById('celular').value = userData.telefone || '';
            document.getElementById('nascimento').value = userData.dataNascimento || '';
            document.getElementById('curso-aluno').value = userData.cursoNome || '';
            document.getElementById('linkedin-perfil').value = userData.linkedin || ''; // CARREGAR LINKEDIN
            
            // Preencher perfil profissional
            document.getElementById('resumo-habilidades').value = userData.resumoHabilidades || '';
            document.getElementById('experiencias-profissionais').value = userData.experienciasProfissionais || '';
            
            // Atualizar contadores
            const habilidadesCount = document.getElementById('habilidadesCount');
            const experienciasCount = document.getElementById('experienciasCount');
            if (habilidadesCount) habilidadesCount.textContent = userData.resumoHabilidades?.length || 0;
            if (experienciasCount) experienciasCount.textContent = userData.experienciasProfissionais?.length || 0;
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showAlert('error', 'Erro ao carregar dados do perfil.');
    }
}

// Salvar dados pessoais
async function salvarDadosPessoais() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const dadosAtualizados = {
            nome: document.getElementById('nome-completo').value,
            telefone: document.getElementById('celular').value,
            dataNascimento: document.getElementById('nascimento').value,
            linkedin: document.getElementById('linkedin-perfil').value // SALVAR LINKEDIN
        };

        await db.collection('candidatos').doc(user.uid).update(dadosAtualizados);
        showAlert('success', 'Dados pessoais atualizados com sucesso!');
        
        // Atualizar nome exibido
        document.getElementById('user-name').textContent = dadosAtualizados.nome;
        
    } catch (error) {
        console.error('Erro ao salvar dados pessoais:', error);
        showAlert('error', 'Erro ao salvar dados pessoais.');
    }
}

// Salvar perfil profissional
async function salvarPerfilProfissional() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const dadosAtualizados = {
            resumoHabilidades: document.getElementById('resumo-habilidades').value,
            experienciasProfissionais: document.getElementById('experiencias-profissionais').value
        };

        await db.collection('candidatos').doc(user.uid).update(dadosAtualizados);
        showAlert('success', 'Perfil profissional atualizado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao salvar perfil profissional:', error);
        showAlert('error', 'Erro ao salvar perfil profissional.');
    }
}

// Deslogar usuário
async function deslogarUsuario() {
    try {
        await auth.signOut();
        showAlert('success', 'Deslogado com sucesso!');
        setTimeout(() => {
            window.location.href = 'login-candidato.html';
        }, 1500);
    } catch (error) {
        console.error('Erro ao deslogar:', error);
        showAlert('error', 'Erro ao deslogar.');
    }
}

// Excluir conta
async function excluirConta() {
    if (!confirm('Tem certeza que deseja excluir sua conta permanentemente? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const user = auth.currentUser;
        if (!user) return;

        // Opcional: Deletar dados do Firestore primeiro
        await db.collection('candidatos').doc(user.uid).delete();
        
        // Deletar usuário do Authentication
        await user.delete();
        
        showAlert('success', 'Conta excluída com sucesso!');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        console.error('Erro ao excluir conta:', error);
        showAlert('error', 'Erro ao excluir conta. Você pode precisar fazer login novamente.');
    }
}

// Verificar autenticação em páginas protegidas
auth.onAuthStateChanged((user) => {
    const currentPage = window.location.pathname;
    
    // Páginas que requerem autenticação
    const protectedPages = [
        'InicialAluno.html',
        'PerfilAluno.html',
        'VagasAluno.html',
        'minhasCandidaturas.html'
    ];
    
    const isProtectedPage = protectedPages.some(page => currentPage.includes(page));
    
    if (isProtectedPage && !user) {
        window.location.href = 'login-candidato.html';
    }
});

// Auto-complete para cursos (se necessário)
document.addEventListener('DOMContentLoaded', function() {
    const cursoInput = document.getElementById('curso-candidato');
    const sugestoesDiv = document.getElementById('sugestoes-curso');
    const cursoIdInput = document.getElementById('curso-id-candidato');
    
    if (cursoInput && sugestoesDiv) {
        // Implementar auto-complete de cursos aqui
        // (mantenha sua implementação existente)
    }
});

