// index.js

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// 1. Inicialização do Firebase Admin SDK
// IMPORTANTE: O arquivo serviceAccountKey.json deve estar na raiz do seu projeto backend
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Adicione a URL do seu Database ou Storage Bucket se necessário
    databaseURL: "https://futurotec-e3a69.firebaseio.com" // Exemplo
});

const db = admin.firestore();
const app = express();
const PORT = 8080;

// Configurações do Express
app.use(cors()); // Permite requisições de outros domínios (como o frontend em localhost)
app.use(express.json()); // Permite o uso de JSON no corpo das requisições

// =======================================================
// === Middlewares de Autenticação e Autorização (CRÍTICO) ===
// =======================================================

/**
 * Middleware para verificar o token de autenticação do Firebase.
 * @param {object} req - Objeto de requisição.
 * @param {object} res - Objeto de resposta.
 * @param {function} next - Próxima função middleware.
 */
async function verifyFirebaseToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Acesso negado. Token não fornecido ou formato incorreto.' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken; // Adiciona as informações do usuário logado à requisição
        next();
    } catch (error) {
        console.error("Erro ao verificar token:", error.message);
        // O erro 'auth/argument-error' é comum se o token for inválido/expirado
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
        }
        return res.status(403).json({ erro: 'Token inválido ou acesso negado.' });
    }
}

/**
 * Middleware para verificar se o usuário tem a role necessária.
 * @param {Array<string>} allowedRoles - Roles permitidas (ex: ['aluno', 'empresa']).
 */
function checkRole(allowedRoles) {
    return async (req, res, next) => {
        // Assume que verifyFirebaseToken já foi executado e req.user existe
        if (!req.user || !req.user.uid) {
            return res.status(403).json({ erro: 'Usuário não autenticado.' });
        }

        try {
            const userDoc = await db.collection('usuarios').doc(req.user.uid).get();
            const role = userDoc.exists ? userDoc.data().role : null;

            if (role && allowedRoles.includes(role)) {
                // Adiciona a role para uso futuro (opcional)
                req.user.role = role; 
                next();
            } else {
                return res.status(403).json({ erro: `Acesso negado. Role necessária: ${allowedRoles.join(' ou ')}.` });
            }
        } catch (error) {
            console.error("Erro ao verificar role:", error.message);
            return res.status(500).json({ erro: 'Erro interno ao verificar permissões.' });
        }
    };
}


// =======================================================
// === Rota de Teste (OPCIONAL) ===
// =======================================================

app.get('/', (req, res) => {
    res.send('Servidor FuturoTEC Backend Online!');
});


// =======================================================
// === Endpoint de Exclusão de Conta (DELETE /perfil) ===
// (Protegido pelo verifyFirebaseToken e checkRole)
// =======================================================

// Aplica o middleware de autenticação em todas as rotas que precisam de login
app.use(verifyFirebaseToken); 

// Endpoint para ALUNOS (Role: aluno)
app.delete('/perfil', checkRole(['aluno']), async (req, res) => {
    try {
        const uid = req.user.uid;
        const batch = db.batch();

        // 1. Apaga o perfil do aluno no Firestore
        const userRef = db.collection('usuarios').doc(uid);
        batch.delete(userRef);

        // 2. Apaga candidaturas do aluno
        const candidaturasSnapshot = await db.collection('candidaturas').where('idAluno', '==', uid).get();
        candidaturasSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`Dados do Firestore do aluno ${uid} apagados (perfil e candidaturas).`);

        // 3. Apaga o usuário do Auth
        await admin.auth().deleteUser(uid);
        console.log(`Usuário aluno ${uid} apagado do Auth.`);

        res.status(200).json({ sucesso: true, mensagem: 'Conta de aluno excluída com sucesso.' });
    } catch (error) {
        console.error(`Erro ao excluir conta de aluno ${req.user.uid}:`, error.message);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir a conta do aluno. Tente fazer login novamente e repita o processo.' });
    }
});

// Endpoint para EMPRESAS (Role: empresa)
app.delete('/perfil', checkRole(['empresa']), async (req, res) => {
    try {
        const uid = req.user.uid;
        const batch = db.batch();

        // 1. Apaga o perfil da empresa no Firestore
        const userRef = db.collection('usuarios').doc(uid);
        batch.delete(userRef);
        
        // 2. Apaga TODAS AS VAGAS criadas pela empresa
        const vagasSnapshot = await db.collection('vagas').where('empresaId', '==', uid).get();
        const vagasIds = [];
        vagasSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            vagasIds.push(doc.id);
        });
        console.log(`Vagas (${vagasIds.length}) da empresa ${uid} marcadas para exclusão.`);

        // 3. Apaga TODAS AS CANDIDATURAS relacionadas a essas vagas
        if (vagasIds.length > 0) {
            // Nota: Se a lista vagasIds for muito grande, o Firestore pode falhar.
            const candidaturasSnapshot = await db.collection('candidaturas').where('idVaga', 'in', vagasIds).get();
            candidaturasSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            console.log(`Candidaturas relacionadas às vagas da empresa ${uid} marcadas para exclusão.`);
        }
        
        // 4. Se houver logo no Storage, apagar (Exemplo - Remova se não tiver a funcionalidade)
        // const bucket = admin.storage().bucket();
        // await bucket.file(`logos/${uid}`).delete().catch(e => console.log('Logo não encontrada para apagar.', e.message));

        await batch.commit();
        console.log(`Dados do Firestore da empresa ${uid} apagados (perfil, vagas e candidaturas).`);

        // 5. Apaga o usuário do Auth
        await admin.auth().deleteUser(uid);
        console.log(`Usuário empresa ${uid} apagado do Auth.`);

        res.status(200).json({ sucesso: true, mensagem: 'Conta de empresa excluída com sucesso.' });
    } catch (error) {
        console.error(`Erro ao excluir conta de empresa ${req.user.uid}:`, error.message);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir a conta da empresa. Tente fazer login novamente e repita o processo.' });
    }
});

// =======================================================
// === Inicialização do Servidor ===
// =======================================================

app.listen(PORT, () => {
    console.log(`✅ Firebase inicializado com sucesso!`);
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
