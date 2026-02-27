

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.static('public'));
app.use(express.json());

// --- NUOVA ROTTA: Recupera lista progetti ---
app.get('/list-projects', (req, res) => {
    const projectsDir = path.join(__dirname, 'projects');

    // Verifica se la cartella projects esiste, altrimenti restituisci array vuoto
    if (!fs.existsSync(projectsDir)) {
        return res.json([]);
    }

    try {
        // Legge il contenuto della cartella
        const folders = fs.readdirSync(projectsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory()) // Filtra solo le cartelle
            .map(dirent => dirent.name);            // Prende solo il nome della cartella

        res.json(folders);
    } catch (err) {
        console.error("Errore nel recupero progetti:", err);
        res.status(500).json({ error: "Impossibile recuperare la lista dei progetti" });
    }
});






// --- ROTTA ESISTENTE: Salvataggio ---
app.post('/save-graph', (req, res) => {
    const { graphName, nodes, connections, mermaidCode } = req.body;
    const dir = path.join(__dirname, 'projects', graphName);

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 1. Salva il file .mmd (per visualizzazione esterna)
    fs.writeFileSync(path.join(dir, 'graph.mmd'), mermaidCode);

    // 2. NUOVO: Salva il file data.json con id, tipi, posizioni e connessioni
    // Questo file servirà per ricostruire il grafo all'apertura
    const graphData = {
        nodes: nodes.map(n => ({
            id: n.id,
            label: n.label,
            x: n.x,
            y: n.y,
            w: n.w,
            h: n.h,
            bgColor: n.bgColor,
            longText: n.longText
        })),
        connections: connections
    };
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(graphData, null, 2));

    // 3. Salva i testi lunghi dei nodi in file .txt separati (opzionale, utile per backup)
    nodes.forEach(node => {
        const cleanLabel = node.label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${cleanLabel}_${node.id}.txt`;
        fs.writeFileSync(path.join(dir, fileName), node.longText || "");
    });

    res.json({ success: true, message: `Progetto "${graphName}" salvato correttamente!` });
});


////////// carica un grafo salvato
app.get('/load-graph/:name', (req, res) => {
    const projectName = req.params.name;
    const dir = path.join(__dirname, 'projects', projectName);
    const dataPath = path.join(dir, 'data.json');
    const mmdPath = path.join(dir, 'graph.mmd');

    if (!fs.existsSync(dataPath)) {
        return res.status(404).json({ error: "Dati del grafo non trovati." });
    }

    const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const mermaidCode = fs.existsSync(mmdPath) ? fs.readFileSync(mmdPath, 'utf8') : "";

    res.json({
        nodes: jsonData.nodes,
        connections: jsonData.connections,
        mermaidCode: mermaidCode
    });
});


// cancella un nodo
app.post('/delete-node-file', (req, res) => {
    const { graphName, nodeId, label } = req.body;
    if (!graphName || !nodeId) return res.status(400).json({ error: "Dati mancanti" });

    const cleanLabel = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${cleanLabel}_${nodeId}.txt`;
    const filePath = path.join(__dirname, 'projects', graphName, fileName);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: "File eliminato" });
    } else {
        res.json({ success: true, message: "File non trovato, procedo comunque" });
    }
});


const { exec } = require('child_process');

app.get('/apri-file', (req, res) => {
    const filePath = "C:\\Users\\infom\\Documents\\MIEI FILE\\SVILUPPO\\CREO-GRAFO\\projects\\xxxxxx\\data.json";
    
    // Il comando 'code -g' apre il file alla riga specifica nell'istanza già aperta di VS Code
    exec(`windsurf -g "${filePath}"`, (error) => {
        if (error) {
            console.error(`Errore: ${error}`);
            return res.status(500).send('Errore nell\'apertura del file');
        }
        res.send('OK');
    });
});


app.listen(3000, () => console.log('Server pronto su http://localhost:3000'));