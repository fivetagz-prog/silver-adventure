// server.js — For Render Web Service
const express = require('express');
const app = express();
const obfuscateHandler = require('./api/obfuscate');

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.post('/api/obfuscate', obfuscateHandler);
app.get('/api/obfuscate', (req, res) => res.status(405).json({ error: 'Use POST' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('LuaForge Server on port', PORT));
