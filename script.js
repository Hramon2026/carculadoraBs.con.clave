// --- LOGICA DE CLAVES ---
let claves = { admin: "1313", super: "456", vende: "789" };

function verificarClave() {
    const intento = document.getElementById('claveEntrada').value;
    if (intento === claves.admin) { activarApp('admin'); }
    else if (intento === claves.super) { activarApp('super'); }
    else if (intento === claves.vende) { activarApp('vende'); }
    else { alert("Clave incorrecta"); }
}

function activarApp(rango) {
    document.getElementById('vista-login').classList.add('hidden');
    document.getElementById('vista-principal').style.display = 'flex';
    document.getElementById('vista-principal').classList.remove('hidden');
    document.getElementById('btn-config').classList.toggle('hidden', rango !== 'admin');
    document.getElementById('btn-inv-toggle').classList.toggle('hidden', rango === 'vende');
    document.getElementById('tasaCambio').readOnly = (rango === 'vende');
}

function irAConfiguracion() {
    document.getElementById('vista-principal').style.display = 'none';
    document.getElementById('vista-admin').classList.remove('hidden');
    document.getElementById('cAdmin').value = claves.admin;
    document.getElementById('cSuper').value = claves.super;
    document.getElementById('cVendedor').value = claves.vende;
}

function guardarCambios() {
    claves.admin = document.getElementById('cAdmin').value;
    claves.super = document.getElementById('cSuper').value;
    claves.vende = document.getElementById('cVendedor').value;
    localStorage.setItem('mis_claves', JSON.stringify(claves));
    alert("? Claves guardadas");
}

// --- LOGICA CALCULADORA E INVENTARIO ---
let inventarioGlobal = {}; let html5QrCode; let html5QrCodeInv; let escanerBloqueado = false; let timersAtajos = {};

window.onload = function() {
    document.getElementById('claveEntrada').value = "";
    const t = localStorage.getItem('miTasaBs'); if (t) document.getElementById('tasaCambio').value = t.replace('.', ',');
    const inv = localStorage.getItem('miInventario'); if (inv) { inventarioGlobal = JSON.parse(inv); actualizarTablaVista(); }
    calcularTodo();
};

function mostrarInventario() { document.getElementById('vista-principal').style.display = 'none'; document.getElementById('vista-inventario').style.display = 'block'; document.getElementById('vista-inventario').classList.remove('hidden'); }
async function regresarACalculadora() { await detenerCamaraInv(); document.getElementById('vista-inventario').style.display = 'none'; document.getElementById('vista-admin').classList.add('hidden'); document.getElementById('vista-principal').style.display = 'flex'; }

function abrirEdicion(codigo) {
    const item = inventarioGlobal[codigo] || { producto: "", marca: "", unidad: "", precio: 0 };
    document.getElementById('edit-cod').value = codigo;
    document.getElementById('edit-prod').value = item.producto;
    document.getElementById('edit-marca').value = item.marca;
    document.getElementById('edit-unid').value = item.unidad;
    document.getElementById('edit-precio').value = item.precio;
    document.getElementById('vista-editar-producto').classList.remove('hidden');
}

function cerrarEdicion() { document.getElementById('vista-editar-producto').classList.add('hidden'); }

function guardarEdicionModal() {
    const cod = document.getElementById('edit-cod').value;
    inventarioGlobal[cod] = {
        producto: document.getElementById('edit-prod').value,
        marca: document.getElementById('edit-marca').value,
        unidad: document.getElementById('edit-unid').value,
        precio: parseFloat(document.getElementById('edit-precio').value) || 0
    };
    localStorage.setItem('miInventario', JSON.stringify(inventarioGlobal));
    actualizarTablaVista();
    cerrarEdicion();
    alert("Producto Guardado ?");
}

function alternarEscaneoInv() { 
    const r = document.getElementById('reader-inv'); 
    if (r.style.display === 'none') { r.style.display = 'block'; iniciarCamaraInv(); } 
    else { detenerCamaraInv(); r.style.display = 'none'; } 
}

function iniciarCamaraInv() { 
    html5QrCodeInv = new Html5Qrcode("reader-inv"); 
    html5QrCodeInv.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (cod) => { 
        const c = cod.toLowerCase(); 
        detenerCamaraInv().then(() => { 
            document.getElementById('reader-inv').style.display = 'none';
            abrirEdicion(c);
        }); 
    }); 
}

function actualizarTablaVista() {
    const cuerpo = document.getElementById('cuerpo-tabla-inv'); cuerpo.innerHTML = "";
    Object.keys(inventarioGlobal).sort().forEach(codigo => {
        const item = inventarioGlobal[codigo];
        cuerpo.innerHTML += `<tr><td>${codigo}</td><td>${item.producto}</td><td>${item.marca}</td><td>${item.unidad}</td><td>${item.precio.toFixed(2)}</td><td><button onclick="abrirEdicion('${codigo}')" style="background:none; border:none; cursor:pointer; font-size:18px;">??</button></td></tr>`;
    });
}

async function detenerCamaraInv() { if (html5QrCodeInv && html5QrCodeInv.getState() === 2) await html5QrCodeInv.stop(); }

document.getElementById('uploadExcel').addEventListener('change', function(e) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, {type: 'array'});
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        inventarioGlobal = {};
        jsonData.forEach(item => {
            const cod = String(item.codigo || item.CODIGO || "").toLowerCase();
            if(cod) inventarioGlobal[cod] = { producto: item.producto || item.PRODUCTO || "", marca: item.marca || item.MARCA || "", unidad: item.Unidad || item.unidad || item.UNIDAD || "", precio: parseFloat(item.precio || item.PRECIO) || 0 };
        });
        localStorage.setItem('miInventario', JSON.stringify(inventarioGlobal)); actualizarTablaVista(); alert("Inventario cargado.");
    }; reader.readAsArrayBuffer(e.target.files[0]);
});

function gestionarEntrada(input) {
    const valor = input.value.trim().toLowerCase();
    const filaId = Array.from(document.querySelectorAll('.input-bs')).indexOf(input);
    if (timersAtajos[filaId]) clearTimeout(timersAtajos[filaId]);
    if (valor !== "" && isNaN(valor.replace(',', '.'))) {
        timersAtajos[filaId] = setTimeout(() => {
            const item = inventarioGlobal[valor];
            if (item) { 
                input.value = item.precio.toFixed(2).replace('.', ','); 
                document.getElementById('nombre-detectado').innerText = `${item.producto}   |   ${item.marca}   |   ${item.unidad || '-'}`; 
                verificarFila(input); calcularTodo(); 
            }
        }, 1500);
    } else { verificarFila(input); calcularTodo(); }
}

function alternarEscaneo() { const r = document.getElementById('reader'); if (r.style.display === 'none') { r.style.display = 'block'; iniciarCamara(); } else { detenerCamara(); r.style.display = 'none'; } }
function iniciarCamara() { html5QrCode = new Html5Qrcode("reader"); html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 250, height: 150 } }, (c) => {
    const item = inventarioGlobal[c.toLowerCase()];
    if(item && !escanerBloqueado) {
        escanerBloqueado = true;
        document.getElementById('nombre-detectado').innerText = `${item.producto}   |   ${item.marca}   |   ${item.unidad || '-'}`;
        let filas = document.getElementsByClassName('fila-input');
        let inputActual = filas[filas.length - 1].querySelector('.input-bs');
        inputActual.value = item.precio.toFixed(2).replace('.', ','); verificarFila(inputActual); calcularTodo();
        setTimeout(() => escanerBloqueado = false, 2000);
    }
}); }
function detenerCamara() { if (html5QrCode) html5QrCode.stop().catch(() => {}); }
function parseInput(valor) { return parseFloat(valor.replace(',', '.')) || 0; }
function guardarYCalcular() { localStorage.setItem('miTasaBs', document.getElementById('tasaCambio').value.replace(',', '.')); calcularTodo(); }

function verificarFila(inputActual) {
    const contenedor = document.getElementById('lista-filas'); const filas = contenedor.getElementsByClassName('fila-input');
    if (filas[filas.length - 1].contains(inputActual) && inputActual.value !== "") {
        const nuevaFila = document.createElement('div'); nuevaFila.className = 'fila-input';
        nuevaFila.innerHTML = `<input type="text" class="input-bs" placeholder="0,00" oninput="gestionarEntrada(this)"><input type="text" class="input-divisa" inputmode="decimal" placeholder="0,00" oninput="gestionarEntrada(this)">`;
        contenedor.appendChild(nuevaFila);
    }
}

function calcularTodo() {
    const tasa = parseInput(document.getElementById('tasaCambio').value);
    let totalBs = 0; document.querySelectorAll('.input-bs').forEach(inp => totalBs += parseInput(inp.value));
    let totalDivisa = 0; document.querySelectorAll('.input-divisa').forEach(inp => totalDivisa += parseInput(inp.value));
    const totalGen = totalBs + (totalDivisa * tasa);
    document.getElementById('sumaBs').innerText = totalBs.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('sumaDivisaEnBs').innerText = (totalDivisa * tasa).toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('totalGeneral').innerText = totalGen.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('totalSoloDivisa').innerText = tasa > 0 ? (totalGen / tasa).toFixed(2) : "0.00";
}

function limpiarColumnas() {
    document.getElementById('lista-filas').innerHTML = `<div class=\"fila-input\"><input type=\"text\" class=\"input-bs\" placeholder=\"0,00\" oninput=\"gestionarEntrada(this)\"><input type=\"text\" class=\"input-divisa\" inputmode=\"decimal\" placeholder=\"0,00\" oninput=\"gestionarEntrada(this)\"></div>`;
    document.getElementById('nombre-detectado').innerText = "";
    calcularTodo();
}
