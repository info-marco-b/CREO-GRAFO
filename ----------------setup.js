const fs = require('fs');
const path = require('path');

const folders = ['public', 'projects'];
const files = {
    'server.js': `const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.static('public'));
app.use(express.json());

app.post('/save-graph', (req, res) => {
    const { graphName, nodes, connections, mermaidCode } = req.body;
    const dir = path.join(__dirname, 'projects', graphName);

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Salva il file .mmd
    fs.writeFileSync(path.join(dir, 'graph.mmd'), mermaidCode);

    // Salva i testi dei nodi
    nodes.forEach(node => {
        const cleanLabel = node.label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = \`\${cleanLabel}_\${node.id}.txt\`;
        fs.writeFileSync(path.join(dir, fileName), node.longText || "");
    });

    res.json({ success: true, message: \`Progetto saved in /projects/\${graphName}\` });
});

app.listen(3000, () => console.log('Server pronto su http://localhost:3000'));`,

    'public/index.html': `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Mermaid Visual Builder</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
<div id="app">
    <main id="canvas-container">
        <div id="canvas-wrapper">
            <div id="canvas"></div>
        </div>
        <div id="toolbar">
            <input type="text" id="project-name" placeholder="Nome Progetto" value="MioGrafo">
            <button onclick="addNode()">+ Aggiungi Nodo</button>
            <button onclick="saveProject()" class="btn-save">💾 Salva Tutto</button>
            <span style="color:white; margin-left:10px; font-size:12px;">Ctrl+Scroll per Zoom</span>
        </div>
    </main>
    <aside id="sidebar">
        <div class="tabs">
            <button class="tab-btn active" onclick="openTab('mermaid-tab')">Mermaid Code</button>
            <button class="tab-btn" onclick="openTab('editor-tab')">Testo Nodo</button>
        </div>
        <div id="mermaid-tab" class="tab-content active">
            <pre id="mermaid-display">graph TD</pre>
        </div>
        <div id="editor-tab" class="tab-content">
            <div id="node-info">
                <h4 id="editing-node-title">Seleziona un nodo</h4>
                <textarea id="node-long-text"></textarea>
                <button onclick="updateNodeData()">Aggiorna Dati</button>
            </div>
        </div>
    </aside>
</div>
<script src="script.js"></script>
</body>
</html>`,

    'public/style.css': `body { margin: 0; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
#app { display: flex; height: 100vh; background: #1a1a1a; }
#canvas-container { flex: 1; position: relative; overflow: hidden; background: #2a2a2a; background-image: radial-gradient(#333 1px, transparent 1px); background-size: 20px 20px; }
#canvas-wrapper { width: 100%; height: 100%; overflow: hidden; cursor: grab; }
#canvas { position: absolute; transform-origin: 0 0; width: 5000px; height: 5000px; }

.node {
    position: absolute; width: 140px; min-height: 50px; background: white; border: 2px solid #555;
    border-radius: 5px; padding: 10px; cursor: move; color: #333; box-shadow: 3px 3px 10px rgba(0,0,0,0.3);
}
.node.selected { border-color: #007bff; box-shadow: 0 0 10px #007bff; }
.pencil { color: #888; margin-right: 5px; }
.dot { position: absolute; right: -8px; top: 50%; width: 16px; height: 16px; background: #ff4757; border-radius: 50%; cursor: crosshair; border: 2px solid white; }

#sidebar { width: 350px; background: #252526; border-left: 1px solid #444; color: white; display: flex; flex-direction: column; }
.tabs { display: flex; background: #333; }
.tab-btn { flex: 1; padding: 12px; border: none; background: none; color: #888; cursor: pointer; border-bottom: 2px solid transparent; }
.tab-btn.active { color: white; border-bottom-color: #007bff; background: #252526; }
.tab-content { display: none; padding: 15px; flex: 1; }
.tab-content.active { display: block; }

#node-long-text { width: 100%; height: 300px; background: #1e1e1e; color: #d4d4d4; border: 1px solid #444; padding: 10px; resize: none; }
#toolbar { position: absolute; top: 20px; left: 20px; z-index: 100; display: flex; gap: 10px; align-items: center; }
.btn-save { background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; }`,

    'public/script.js': `let nodes = [];
let connections = [];
let nextId = 1;
let selectedId = null;
let scale = 1;
let connSource = null;
let isDragging = false;
let currentDragNode = null;

const canvas = document.getElementById('canvas');

// Drag & Drop
window.onmousemove = (e) => {
    if (isDragging && currentDragNode) {
        currentDragNode.x += e.movementX / scale;
        currentDragNode.y += e.movementY / scale;
        render();
    }
};
window.onmouseup = () => isDragging = false;

function addNode() {
    nodes.push({ id: nextId++, label: "Nodo " + nextId, longText: "", x: 100, y: 100 });
    render();
}

function render() {
    canvas.innerHTML = '';
    nodes.forEach(n => {
        const div = document.createElement('div');
        div.className = 'node' + (selectedId === n.id ? ' selected' : '');
        div.style.left = n.x + 'px';
        div.style.top = n.y + 'px';
        div.innerHTML = \`<span class="pencil">✏️</span> <b>\${n.label}</b> (ID: \${n.id}) <div class="dot" onclick="event.stopPropagation(); link(\${n.id})"></div>\`;
        
        div.onmousedown = (e) => {
            if(e.target.className === 'dot') return;
            isDragging = true;
            currentDragNode = n;
            selectNode(n.id);
        };
        canvas.appendChild(div);
    });
    updateMermaid();
}

function selectNode(id) {
    selectedId = id;
    const node = nodes.find(n => n.id === id);
    document.getElementById('editing-node-title').innerText = "Edit: " + node.label;
    document.getElementById('node-long-text').value = node.longText;
    render();
}

function updateNodeData() {
    const node = nodes.find(n => n.id === selectedId);
    if(node) {
        node.longText = document.getElementById('node-long-text').value;
        alert("Dati aggiornati!");
    }
}

function link(id) {
    if (!connSource) {
        connSource = id;
        console.log("Sorgente selezionata: " + id);
    } else {
        if (connSource !== id) {
            connections.push({ from: connSource, to: id });
            connSource = null;
            render();
        }
    }
}

function updateMermaid() {
    let m = "graph TD\\n";
    nodes.forEach(n => m += \`  \${n.id}["\${n.label}"]\\n\`);
    connections.forEach(c => m += \`  \${c.from} --> \${c.to}\\n\`);
    document.getElementById('mermaid-display').innerText = m;
}

// Zoom
document.getElementById('canvas-wrapper').onwheel = (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        scale *= e.deltaY > 0 ? 0.9 : 1.1;
        canvas.style.transform = \`scale(\${scale})\`;
    }
};

function openTab(id) {
    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
}

async function saveProject() {
    const name = document.getElementById('project-name').value;
    const body = { graphName: name, nodes, connections, mermaidCode: document.getElementById('mermaid-display').innerText };
    const res = await fetch('/save-graph', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    alert(data.message);
}`
};

// Crea cartelle
folders.forEach(f => {
    if (!fs.existsSync(f)) fs.mkdirSync(f);
});

// Crea file
Object.keys(files).forEach(f => {
    fs.writeFileSync(f, files[f]);
});

console.log("Struttura creata con successo! Ora esegui 'npm install express' e 'node server.js'");