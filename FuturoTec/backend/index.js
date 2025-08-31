// index.js
// Backend API para o TCC de Vagas de Estágio com Node.js, Express e Firebase

const express = require('express');
const admin = require('firebase-admin');

// --- CONFIGURAÇÃO INICIAL ---
// 1. Baixe o arquivo de credenciais do seu projeto Firebase
//    (Projeto > Configurações > Contas de serviço > Gerar nova chave privada)
// 2. Renomeie o arquivo para "serviceAccountKey.json" e coloque na mesma pasta que este script.
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase inicializado com sucesso!');
} catch (error) {
    console.error('❌ Erro ao inicializar o Firebase:', error);
    console.log("🚨 Verifique se o arquivo 'serviceAccountKey.json' está na pasta correta.");
}

// Inicializa o Firestore DB e o Express App
const db = admin.firestore();
const app = express();

// Middleware para o Express entender JSON no corpo das requisições
app.use(express.json());

// --- ENDPOINTS DA API ---

// --- Endpoints de Perfis (Alunos e Empresas) ---

/**
 * Cria um perfil de aluno ou empresa.
 * O ID do documento será o mesmo UID do Firebase Auth.
 * POST /perfil
 * Body: { "uid": "...", "tipo": "alunos" ou "empresas", "dados": { ... } }
 */
app.post('/perfil', async (req, res) => {
    try {
        const { uid, tipo, dados } = req.body;
        const dadosPerfil = {
            ...dados,
            dataCriacao: admin.firestore.FieldValue.serverTimestamp() // Usa o timestamp do servidor
        };

        // Salva o documento na coleção correta com o UID como ID
        await db.collection(tipo).doc(uid).set(dadosPerfil);

        res.status(201).json({ sucesso: true, mensagem: `Perfil de ${tipo} criado com sucesso para o UID ${uid}` });
    } catch (error) {
        res.status(400).json({ sucesso: false, erro: error.message });
    }
});

/**
 * Obtém os dados de um perfil específico (aluno ou empresa).
 * GET /perfil/:tipo/:uid
 */
app.get('/perfil/:tipo/:uid', async (req, res) => {
    try {
        const { tipo, uid } = req.params;

        if (!['alunos', 'empresas'].includes(tipo)) {
            return res.status(400).json({ sucesso: false, erro: "Tipo de perfil inválido" });
        }

        const docRef = db.collection(tipo).doc(uid);
        const doc = await docRef.get();

        if (doc.exists) {
            res.status(200).json(doc.data());
        } else {
            res.status(404).json({ sucesso: false, erro: "Perfil não encontrado" });
        }
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

// --- Endpoints de Vagas ---

/**
 * Cria uma nova vaga de estágio.
 * POST /vagas
 * Body: { "titulo": "Estágio Dev", "empresaId": "...", ... }
 */
app.post('/vagas', async (req, res) => {
    try {
        const vagaData = {
            ...req.body,
            dataPublicacao: admin.firestore.FieldValue.serverTimestamp(),
            status: 'aberta' // Status inicial padrão
        };

        const docRef = await db.collection('vagas').add(vagaData);
        res.status(201).json({ sucesso: true, id_vaga: docRef.id });
    } catch (error) {
        res.status(400).json({ sucesso: false, erro: error.message });
    }
});

/**
 * Lista todas as vagas abertas, com filtro opcional por curso.
 * GET /vagas?curso=Ciência%20da%20Computação
 */
app.get('/vagas', async (req, res) => {
    try {
        const { curso } = req.query;
        let vagasQuery = db.collection('vagas').where('status', '==', 'aberta');

        if (curso) {
            vagasQuery = vagasQuery.where('cursosAlvo', 'array-contains', curso);
        }

        const snapshot = await vagasQuery.get();
        const vagas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        res.status(200).json(vagas);
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

/**
 * Lista todas as vagas de uma empresa específica.
 * GET /vagas/empresa/:empresaId
 */
app.get('/vagas/empresa/:empresaId', async (req, res) => {
    try {
        const { empresaId } = req.params;
        const snapshot = await db.collection('vagas').where('empresaId', '==', empresaId).get();
        const vagas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(vagas);
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});


// --- Endpoints de Candidaturas ---

/**
 * Registra a candidatura de um aluno a uma vaga.
 * POST /candidaturas
 * Body: { "vagaId": "...", "alunoId": "...", "empresaId": "..." }
 */
app.post('/candidaturas', async (req, res) => {
    try {
        const candidaturaData = {
            ...req.body,
            dataCandidatura: admin.firestore.FieldValue.serverTimestamp(),
            status: 'enviada' // Status inicial
        };
        const docRef = await db.collection('candidaturas').add(candidaturaData);
        res.status(201).json({ sucesso: true, id_candidatura: docRef.id });
    } catch (error) {
        res.status(400).json({ sucesso: false, erro: error.message });
    }
});

/**
 * Lista todos os candidatos de uma vaga específica.
 * GET /candidaturas/vaga/:vagaId
 */
app.get('/candidaturas/vaga/:vagaId', async (req, res) => {
    try {
        const { vagaId } = req.params;
        const snapshot = await db.collection('candidaturas').where('vagaId', '==', vagaId).get();
        const candidaturas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(candidaturas);
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

/**
 * Lista todas as candidaturas de um aluno específico.
 * GET /candidaturas/aluno/:alunoId
 */
app.get('/candidaturas/aluno/:alunoId', async (req, res) => {
    try {
        const { alunoId } = req.params;
        const snapshot = await db.collection('candidaturas').where('alunoId', '==', alunoId).get();
        const candidaturas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
