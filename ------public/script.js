/* ============================================================
   1. STATO GLOBALE E CONFIGURAZIONE
   ============================================================ */
let nodes = [];
let connections = [];
let nextId = 1;
let selectedId = null;
let scale = 1;
let isDragging = false;
let currentDragNode = null;
let connSource = null;
let isPanning = false;
let viewBox = { x: 0, y: 0 }; 
let currentProjectName = null; 

const svg = document.getElementById('svg-canvas');
const mainGroup = document.getElementById('main-group');
const nodesLayer = document.getElementById('nodes-layer');
const connLayer = document.getElementById('connections-layer');
const contextMenu = document.getElementById('context-menu');




/* ============================================================
   2. CORE: RENDERING E TRASFORMAZIONI (Versione Ottimizzata)
   ============================================================ */

function render() {
    nodesLayer.innerHTML = '';
    connLayer.innerHTML = '';

    // Rendering Connessioni (rimane invariato)
    /*
    connections.forEach(c => {
        const fromNode = nodes.find(n => n.id === c.from);
        const toNode = nodes.find(n => n.id === c.to);
        if (fromNode && toNode) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const start = getAnchorPos(fromNode, c.fromAnchor);
            const end = getAnchorPos(toNode, c.toAnchor);
            const dx = Math.abs(end.x - start.x) * 0.5;
            line.setAttribute("d", `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`);
            line.setAttribute("class", "connection-line");
            connLayer.appendChild(line);
        }
    });
    */

    // Sostituisci il ciclo connections.forEach in render()
    /* - Aggiornamento logica rendering connessioni */
/* Sostituisci il ciclo connections.forEach dentro render() */
connections.forEach(c => {
    const fromNode = nodes.find(n => n.id === c.from);
    const toNode = nodes.find(n => n.id === c.to);

    if (fromNode && toNode) {
        const best = getBestAnchors(fromNode, toNode);
        const start = getAnchorPos(fromNode, best.from);
        const end = getAnchorPos(toNode, best.to);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "path");

        // Calcoliamo una curvatura proporzionale alla distanza (max 100px)
        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        const curvature = Math.min(dist * 0.3, 100);

        // Calcoliamo i punti di controllo cp1 e cp2 basati sull'orientamento dei pallini
        const cp1 = calculateControlPoint(best.from, start, curvature);
        const cp2 = calculateControlPoint(best.to, end, curvature);

        // La curva C (Bezier cubica) ora ha tangenti d'entrata e uscita corrette
        line.setAttribute("d", `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`);
        line.setAttribute("class", "connection-line");
        connLayer.appendChild(line);
    }
});

function calculateControlPoint(anchorType, pos, curvature) {
    let cx = pos.x;
    let cy = pos.y;

    if (anchorType.includes('top'))    cy -= curvature;
    if (anchorType.includes('bottom')) cy += curvature;
    if (anchorType.includes('left'))   cx -= curvature;
    if (anchorType.includes('right'))  cx += curvature;

    return { x: cx, y: cy };
}

    // Rendering Nodi Ottimizzato
    nodes.forEach(n => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("transform", `translate(${n.x}, ${n.y})`);
        g.setAttribute("class", "node-group");

        // Rettangolo principale (ora gestisce Selezione e Drag)
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", n.w);
        rect.setAttribute("height", n.h);
        rect.setAttribute("class", `node-rect ${selectedId === n.id ? 'selected' : ''}`);
        rect.setAttribute("fill", n.bgColor || "#ffffff");
        
        // Unico gestore per Selezione e inizio Trascinamento
        rect.onmousedown = (e) => {
            e.stopPropagation();
            isDragging = true;
            currentDragNode = n;
            selectNode(n.id); // Seleziona e apre tab
            openTab('node-tab');
            render();
        };
        g.appendChild(rect);

        // Testo del nodo (centrato nel rettangolo)
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", n.w / 2); // Centratura corretta
        text.setAttribute("y", n.h / 2 + 5);
        text.setAttribute("class", "node-text");
        const maxLength = 15; // Aumentato spazio per testo
        text.textContent = n.label.length > maxLength ? n.label.substring(0, maxLength) + "..." : n.label;
        g.appendChild(text);

        // Dentro nodes.forEach in render()
        ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(type => {
            const pos = getAnchorPos({ x: 0, y: 0, w: n.w, h: n.h }, type);

            // Connettori (rimangono invariati per i collegamenti)
            //['top', 'bottom', 'left', 'right'].forEach(type => {
            //const pos = getAnchorPos({ x: 0, y: 0, w: n.w, h: n.h }, type);
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", pos.x); dot.setAttribute("cy", pos.y);
            dot.setAttribute("r", 6);
            dot.setAttribute("class", "connector-dot");
            dot.onclick = (e) => { e.stopPropagation(); handleLink(n.id, type); };
            g.appendChild(dot);
        });

        nodesLayer.appendChild(g);
    });
    updateMermaid();
}

function applyTransform() {
    mainGroup.setAttribute('transform', `translate(${viewBox.x}, ${viewBox.y}) scale(${scale})`);
}

/*
function getAnchorPos(n, type) {
    if (type === 'top') return { x: n.x + n.w / 2, y: n.y };
    if (type === 'bottom') return { x: n.x + n.w / 2, y: n.y + n.h };
    if (type === 'left') return { x: n.x, y: n.y + n.h / 2 };
    if (type === 'right') return { x: n.x + n.w, y: n.y + n.h / 2 };
    return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}
*/
function getAnchorPos(n, type) {
    const map = {
        'top': { x: n.x + n.w / 2, y: n.y },
        'bottom': { x: n.x + n.w / 2, y: n.y + n.h },
        'left': { x: n.x, y: n.y + n.h / 2 },
        'right': { x: n.x + n.w, y: n.y + n.h / 2 },
        'top-left': { x: n.x, y: n.y },
        'top-right': { x: n.x + n.w, y: n.y },
        'bottom-left': { x: n.x, y: n.y + n.h },
        'bottom-right': { x: n.x + n.w, y: n.y + n.h }
    };
    return map[type] || { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}


function getBestAnchors(fromNode, toNode) {
    const anchors = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
    let minText = Infinity;
    let best = { from: 'right', to: 'left' };

    anchors.forEach(a1 => {
        anchors.forEach(a2 => {
            const p1 = getAnchorPos(fromNode, a1);
            const p2 = getAnchorPos(toNode, a2);
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (dist < minText) {
                minText = dist;
                best = { from: a1, to: a2 };
            }
        });
    });
    return best;
}



function updateMermaid() {
    let m = "graph TD\n";
    nodes.forEach(n => m += `  ${n.id}["${n.label}"]\n`);
    connections.forEach(c => m += `  ${c.from} --> ${c.to}\n`);
    document.getElementById('mermaid-display').innerText = m;
}

function rebuildGraph() {
    viewBox = { x: 0, y: 0 };
    scale = 1;
    applyTransform();
    render();
}

/* ============================================================
   3. GESTIONE DATI E PROGETTI (BACKEND SYNC)
   ============================================================ */

   /*
   // Modifica addNode per usare i nuovi default se necessario
function addNode() {
    const centerX = (svg.clientWidth / 2 - viewBox.x) / scale;
    const centerY = (svg.clientHeight / 2 - viewBox.y) / scale;

    const node = {
        id: nextId++,
        label: "Nodo " + (nextId - 1),
        longText: "",
        x: centerX - 75,
        y: centerY - 40,
        w: 150, h: 80
    };
    nodes.push(node);
    render();
}
*/

function addNode(type = 'default') {
    const centerX = (svg.clientWidth / 2 - viewBox.x) / scale;
    const centerY = (svg.clientHeight / 2 - viewBox.y) / scale;

    let color = '#ffffff';
    let labelPrefix = "Nodo";

    switch (type) {
        case 'tipo1': color = '#e1f5fe'; labelPrefix = "Input"; break;
        case 'tipo2': color = '#fff3e0'; labelPrefix = "Processo"; break;
        case 'tipo3': color = '#e8f5e9'; labelPrefix = "Output"; break;
    }

    const node = {
        id: nextId++,
        label: `${labelPrefix} ${nextId - 1}`,
        longText: "",
        x: centerX - 75,
        y: centerY - 40,
        w: 150,
        h: 80,
        bgColor: color 
    };

    nodes.push(node);
    render();
}

async function handleSave() {
    if (!currentProjectName || currentProjectName === "Senza nome") {
        const name = await showDialog("Inserisci il nome della cartella per questo grafo:", "prompt", "Nuovo Progetto");
        if (!name || name.trim() === "") {
            await showDialog(`Salvataggio annullato: il nome è obbligatorio.`, "alert", "Salvataggio");
            return;
        }
        currentProjectName = name.trim().replace(/\s+/g, '-');
    }

    const mermaidCode = document.getElementById('mermaid-display').innerText;
    const body = {
        graphName: currentProjectName,
        nodes: nodes,
        connections: connections,
        mermaidCode: mermaidCode
    };

    try {
        const res = await fetch('/save-graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            document.querySelectorAll('#current-project-display').forEach(el => el.innerText = currentProjectName);
            await showDialog(data.message, "alert", "Salvataggio");
        }
    } catch (err) {
        await showDialog("Errore durante il salvataggio.", "alert", "Salvataggio");
    }
}

async function loadGraphData(name) {
    try {
        const response = await fetch(`/load-graph/${name}`);
        if (!response.ok) throw new Error("Errore nel caricamento");
        const data = await response.json();
        currentProjectName = name;
        nodes = data.nodes;
        connections = data.connections;
        nextId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
        document.getElementById('current-project-display').innerText = name;
        document.getElementById('mermaid-display').innerText = data.mermaidCode;
        rebuildGraph();
        closeLoadPopup();
    } catch (err) {
        await showDialog("Impossibile caricare il grafo.", "alert", "Errore");
    }
}

async function deleteNode(id) {
    if (!id) return;
    const nodeId = parseInt(id);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const confirmDelete = await showDialog(`Sei sicuro? Il nodo "${node.label}" verrà eliminato.`, "confirm", "Elimina");
    if (!confirmDelete) return;

    if (currentProjectName) {
        try {
            await fetch('/delete-node-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ graphName: currentProjectName, nodeId: node.id, label: node.label })
            });
        } catch (e) { console.error(e); }
    }
    connections = connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    nodes = nodes.filter(n => n.id !== nodeId);
    if (selectedId === nodeId) {
        selectedId = null;
        document.getElementById('edit-label').value = '';
        document.getElementById('edit-text').value = '';
    }
    render();
}

async function newGraph() {
    const confirmClear = await showDialog("Tutti i dati non salvati andranno persi. Continuare?", "confirm", "Nuovo Grafo");
    if (confirmClear) {
        nodes = []; connections = []; nextId = 1; selectedId = null; currentProjectName = null;
        document.getElementById('current-project-display').innerText = "Senza nome";
        rebuildGraph();
    }
}

/* ============================================================
   4. INTERFACCIA E UI (SIDEBAR & POPUP)
   ============================================================ */

function showDialog(message, type = 'alert', title = "Sistema", defaultValue = "") {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-dialog');
        const msgEl = document.getElementById('dialog-message');
        const titleEl = document.getElementById('dialog-title');
        const inputEl = document.getElementById('dialog-input');
        const confirmBtn = document.getElementById('dialog-confirm-btn');
        const cancelBtn = document.getElementById('dialog-cancel-btn');

        titleEl.innerText = title;
        msgEl.innerText = message;
        dialog.style.display = 'flex';
        inputEl.value = defaultValue;
        inputEl.style.display = (type === 'prompt') ? 'block' : 'none';
        if (type === 'prompt') setTimeout(() => inputEl.focus(), 100);
        cancelBtn.style.display = (type === 'alert') ? 'none' : 'block';

        const cleanup = (result) => {
            dialog.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };
        confirmBtn.onclick = () => cleanup(type === 'prompt' ? inputEl.value : true);
        cancelBtn.onclick = () => cleanup(type === 'prompt' ? null : false);
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape') cancelBtn.click();
        };
    });
}

function selectNode(id) {
    selectedId = parseInt(id);
    const node = nodes.find(n => n.id === selectedId);
    if(node) {
        document.getElementById('edit-label').value = node.label;
        document.getElementById('edit-color').value = node.bgColor || "#ffffff";
        document.getElementById('edit-text').value = node.longText;
        const delBtn = document.getElementById('btn-delete-node');
        if(delBtn) delBtn.dataset.nodeId = id;
        refreshConnectionsList(selectedId);
    }
    render();
}

function refreshConnectionsList(nodeId) {
    const listContainer = document.getElementById('node-connections-list');
    listContainer.innerHTML = '';
    const nodeConns = connections.filter(c => c.from === nodeId || c.to === nodeId);
    if (nodeConns.length === 0) {
        listContainer.innerHTML = '<p style="font-size:12px; color:#666;">Nessun collegamento.</p>';
        return;
    }
    nodeConns.forEach(c => {
        const isOut = c.from === nodeId;
        const otherNode = nodes.find(n => n.id === (isOut ? c.to : c.from));
        const item = document.createElement('div');
        item.className = 'conn-item';
        item.innerHTML = `<div>${isOut ? '→' : '←'} <span>${otherNode ? otherNode.label : "?"}</span></div>
                          <div class="delete-conn-btn"><i data-lucide="trash-2"></i></div>`;
        item.querySelector('.delete-conn-btn').onclick = () => deleteConnection(c);
        listContainer.appendChild(item);
    });
    if(window.lucide) lucide.createIcons();
}

function deleteConnection(connObj) {
    connections = connections.filter(c => c !== connObj);
    if (selectedId) refreshConnectionsList(selectedId);
    render();
}

function updateNodeLive() {
    if (!selectedId) return;
    const node = nodes.find(n => n.id === selectedId);
    if(node) {
        node.label = document.getElementById('edit-label').value;
        node.bgColor = document.getElementById('edit-color').value;
        node.longText = document.getElementById('edit-text').value;
        render();
    }
}

function openTab(id) {
    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const tabs = [...document.querySelectorAll('.tab-content')];
    const index = tabs.findIndex(tab => tab.id === id);
    if(index !== -1) document.querySelectorAll('.tab-btn')[index].classList.add('active');
}

async function openLoadPopup() {
    const confirmClear = await showDialog("Sei sicuro? Dati non salvati andranno persi.", "confirm", "Carica");
    if (!confirmClear) return;
    const popup = document.getElementById('load-popup');
    const listContainer = document.getElementById('graphs-list');
    popup.style.display = 'flex';
    listContainer.innerHTML = '<p>Caricamento...</p>';
    try {
        const response = await fetch('/list-projects');
        const projects = await response.json();
        listContainer.innerHTML = ''; 
        projects.forEach(name => {
            const div = document.createElement('div');
            div.className = 'graph-item';
            div.innerHTML = `<i data-lucide="folder"></i> <span>${name}</span>`;
            div.onclick = () => loadGraphData(name);
            listContainer.appendChild(div);
        });
        if(window.lucide) lucide.createIcons();
    } catch (err) { listContainer.innerHTML = '<p>Errore.</p>'; }
}

function closeLoadPopup() { document.getElementById('load-popup').style.display = 'none'; }

/* ============================================================
   5. EVENT LISTENER (MOUSE & TASTIERA)
   ============================================================ */

// Context Menu
svg.addEventListener('contextmenu', e => {
    e.preventDefault();
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.display = 'block';
});

// Zoom Wheel
svg.addEventListener('wheel', e => {
    if (e.ctrlKey) {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
        const worldX = (mouseX - viewBox.x) / scale, worldY = (mouseY - viewBox.y) / scale;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale *= delta;
        viewBox.x = mouseX - worldX * scale;
        viewBox.y = mouseY - worldY * scale;
        applyTransform();
    }
}, { passive: false });

// Pan & Drag
svg.onmousedown = (e) => { if (e.target === svg || e.target.id === 'connections-layer') isPanning = true; };

window.onmousemove = (e) => {
    if (isDragging && currentDragNode) {
        currentDragNode.x += e.movementX / scale;
        currentDragNode.y += e.movementY / scale;
        render();
    } else if (isPanning) {
        viewBox.x += e.movementX; viewBox.y += e.movementY;
        applyTransform();
    }
};
/*
// Aggiorniamo mousemove globale
window.onmousemove = (e) => {
    if (isDragging && currentDragNode) {
        currentDragNode.x += e.movementX / scale;
        currentDragNode.y += e.movementY / scale;
        render();
    } else if (isPanning) {
        viewBox.x += e.movementX;
        viewBox.y += e.movementY;
        applyTransform();
    }
};

window.onmousemove = (e) => {
    if (isDragging && currentDragNode) {
        currentDragNode.x += e.movementX / scale;
        currentDragNode.y += e.movementY / scale;
        render();
    }
};


window.onmousemove = (e) => {
    if (isDragging && currentDragNode) {
        // Trascina il singolo nodo (diviso per la scala per mantenere la precisione)
        currentDragNode.x += e.movementX / scale;
        currentDragNode.y += e.movementY / scale;
        render();
    } else if (isPanning) {
        // Trascina l'intero grafo
        viewBox.x += e.movementX;
        viewBox.y += e.movementY;
        applyTransform();
    }
};
*/





window.onmouseup = () => { isDragging = isPanning = false; currentDragNode = null; };

// Tastiera
window.addEventListener('keydown', e => {
    const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if ((e.key === "Delete" || e.key === "Backspace") && !isTyping && selectedId) deleteNode(selectedId);
});

// Chiusura Popup/Menu Click Fuori
window.onclick = (e) => {
    if (e.target === document.getElementById('load-popup')) closeLoadPopup();
    contextMenu.style.display = 'none';
};

/* ============================================================
   6. INIZIALIZZAZIONE
   ============================================================ */
handleLink = (id, anchor) => {
    if (!connSource) { connSource = { id, anchor }; } 
    else { if (connSource.id !== id) { connections.push({ from: connSource.id, fromAnchor: connSource.anchor, to: id, toAnchor: anchor }); connSource = null; render(); } }
};

addNode(); // Crea il primo nodo all'avvio