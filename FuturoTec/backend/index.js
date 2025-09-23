// index.js - VERSÃO COMPLETA E CORRIGIDA
const express = require('express');
const admin = require('firebase-admin');

// --- CONFIGURAÇÃO INICIAL DO FIREBASE ---
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase inicializado com sucesso!');
} catch (error) {
    console.error('❌ Erro ao inicializar o Firebase:', error.message);
    console.log("🚨 Verifique se o arquivo 'serviceAccountKey.json' está na pasta correta.");
    process.exit(1);
}

const db = admin.firestore();
const app = express();
app.use(express.json());

// --- MIDDLEWARE DE AUTENTICAÇÃO E PERMISSÃO ---

/**
 * Middleware para verificar o token de autenticação do Firebase.
 * Aplica-se a todas as rotas abaixo.
 */
const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ sucesso: false, erro: 'Acesso não autorizado. Token não fornecido.' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Erro ao verificar o token:', error);
        return res.status(403).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
    }
};

app.use(verifyFirebaseToken);

/**
 * Middleware para verificar o papel (role) do usuário.
 * Usado para proteger rotas específicas para empresas ou assistentes.
 */
const checkRole = (allowedRoles) => async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const userDoc = await db.collection('usuarios').doc(uid).get();
        const userData = userDoc.data();

        if (!userDoc.exists || !allowedRoles.includes(userData.role)) {
            return res.status(403).json({ sucesso: false, erro: 'Ação não permitida para o seu tipo de perfil.' });
        }
        req.profile = userData;
        next();
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: 'Erro ao verificar o papel do usuário.' });
    }
};

// --- Endpoints de Perfis ---

/**
 * Cria ou atualiza um perfil de usuário (aluno, empresa ou assistente_tecnico).
 * POST /perfil
 */
app.post('/perfil', async (req, res) => {
    try {
        const uid = req.user.uid;
        const { role, dados } = req.body;

        if (!role || !dados) {
            return res.status(400).json({ sucesso: false, erro: "Corpo da requisição inválido. 'role' e 'dados' são obrigatórios." });
        }
        const rolesValidos = ['aluno', 'empresa', 'assistente_tecnico'];
        if (!rolesValidos.includes(role)) {
            return res.status(400).json({ sucesso: false, erro: "O 'role' de perfil é inválido." });
        }

        dados.email = req.user.email;

        const dadosPerfil = {
            ...dados,
            role: role,
            dataAtualizacao: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('usuarios').doc(uid).set(dadosPerfil, { merge: true });
        res.status(201).json({ sucesso: true, mensagem: `Perfil de ${role} criado/atualizado com sucesso para o UID ${uid}` });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

/**
 * Obtém os dados de um perfil específico da coleção "usuarios".
 * GET /perfil/:uid
 */
app.get('/perfil/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const docRef = db.collection('usuarios').doc(uid);
        const doc = await docRef.get();

        if (doc.exists) {
            res.status(200).json({ id: doc.id, ...doc.data() });
        } else {
            res.status(404).json({ sucesso: false, erro: "Perfil não encontrado" });
        }
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});


// --- Endpoints de Etecs (apenas para assistente técnico) ---

/**
 * Cria uma nova Etec.
 * POST /etecs
 */
app.post('/etecs', checkRole(['assistente_tecnico']), async (req, res) => {
    try {
        const { nome, cod, endereco } = req.body;
        if (!nome || !cod) {
            return res.status(400).json({ sucesso: false, erro: 'Nome e código são obrigatórios para a Etec.' });
        }
        const etecData = {
            nome,
            cod,
            endereco,
            dataCriacao: admin.firestore.FieldValue.serverTimestamp()
        };
        const docRef = await db.collection('etecs').add(etecData);
        res.status(201).json({ sucesso: true, id_etec: docRef.id });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

/**
 * Lista todas as Etecs.
 * GET /etecs
 */
app.get('/etecs', async (req, res) => {
    try {
        const snapshot = await db.collection('etecs').get();
        const etecs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(etecs);
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});


// --- Endpoints de Vagas ---

/**
 * Cria uma nova vaga. Apenas perfis de empresa podem usar.
 * POST /vagas
 */
app.post('/vagas', checkRole(['empresa']), async (req, res) => {
    try {
        const empresaId = req.user.uid;
        const perfilEmpresa = req.profile; // Dados do perfil da empresa vêm do middleware

        const vagaData = {
            ...req.body,
            empresaId: empresaId,
            nomeEmpresa: perfilEmpresa.nome,
            dataPublicacao: admin.firestore.FieldValue.serverTimestamp(),
            status: 'aberta'
        };

        const docRef = await db.collection('vagas').add(vagaData);
        res.status(201).json({ sucesso: true, id_vaga: docRef.id });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

/**
 * Lista todas as vagas. Acesso liberado para todos os usuários autenticados.
 * GET /vagas
 */
app.get('/vagas', async (req, res) => {
    try {
        const snapshot = await db.collection('vagas').get();
        const vagas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(vagas);
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

/**
 * Obtém os detalhes de uma vaga específica.
 * GET /vagas/:id
 */
app.get('/vagas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await db.collection('vagas').doc(id).get();
        if (!doc.exists) {
            return res.status(404).json({ sucesso: false, erro: 'Vaga não encontrada.' });
        }
        res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

/**
 * NOVO: Atualiza uma vaga. Apenas a empresa que a criou pode editar.
 * PUT /vagas/:id
 */
app.put('/vagas/:id', checkRole(['empresa']), async (req, res) => {
    try {
        const { id } = req.params;
        const vagaRef = db.collection('vagas').doc(id);
        const vagaDoc = await vagaRef.get();

        if (!vagaDoc.exists || vagaDoc.data().empresaId !== req.user.uid) {
            return res.status(403).json({ sucesso: false, erro: 'Ação não permitida.' });
        }

        await vagaRef.update(req.body);
        res.status(200).json({ sucesso: true, mensagem: 'Vaga atualizada com sucesso.' });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

/**
 * NOVO: Exclui uma vaga. Apenas a empresa que a criou pode excluir.
 * DELETE /vagas/:id
 */
app.delete('/vagas/:id', checkRole(['empresa']), async (req, res) => {
    try {
        const { id } = req.params;
        const vagaRef = db.collection('vagas').doc(id);
        const vagaDoc = await vagaRef.get();

        if (!vagaDoc.exists || vagaDoc.data().empresaId !== req.user.uid) {
            return res.status(403).json({ sucesso: false, erro: 'Ação não permitida.' });
        }

        await vagaRef.delete();
        res.status(200).json({ sucesso: true, mensagem: 'Vaga excluída com sucesso.' });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

// --- Endpoints de Candidaturas (NOVO) ---

/**
 * NOVO: Permite a um aluno candidatar-se a uma vaga.
 * POST /candidatar/:id_vaga
 */
app.post('/candidatar/:id_vaga', checkRole(['aluno']), async (req, res) => {
    try {
        const { id_vaga } = req.params;
        const alunoId = req.user.uid;
        const alunoPerfil = req.profile;
        const candidaturaData = {
            idVaga: id_vaga,
            idAluno: alunoId,
            nomeAluno: alunoPerfil.nome,
            dataCandidatura: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('candidaturas').add(candidaturaData);
        res.status(201).json({ sucesso: true, mensagem: 'Candidatura realizada com sucesso.' });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

/**
 * NOVO: Lista todas as candidaturas para uma vaga específica. Apenas a empresa da vaga pode ver.
 * GET /vagas/:id_vaga/candidaturas
 */
app.get('/vagas/:id_vaga/candidaturas', checkRole(['empresa']), async (req, res) => {
    try {
        const { id_vaga } = req.params;
        const empresaId = req.user.uid;

        const vagaDoc = await db.collection('vagas').doc(id_vaga).get();
        if (!vagaDoc.exists || vagaDoc.data().empresaId !== empresaId) {
            return res.status(403).json({ sucesso: false, erro: 'Ação não permitida.' });
        }

        const candidaturasSnapshot = await db.collection('candidaturas').where('idVaga', '==', id_vaga).get();
        const candidaturas = candidaturasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(candidaturas);
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});


// --- Roda o Servidor ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
