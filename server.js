const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'FuturoTec')));
app.use(bodyParser.urlencoded({ extended: true }))


// ROTA PRINCIPAL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// INICIAR SERVIDOR
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
