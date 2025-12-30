// --- LÓGICA DO APP ---

// Estrutura de dados Global
let currentPlan = null;
let currentWorkoutData = []; // Armazena dados temporários do treino atual

// Inicialização
window.onload = () => {
    const savedPlan = localStorage.getItem('fitflow_plan');
    if (savedPlan) {
        currentPlan = JSON.parse(savedPlan);
        renderHome();
    } else {
        document.getElementById('no-plan-state').style.display = 'block';
    }
};

// Navegação simples
function navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    window.scrollTo(0,0);
}

// 1. GERAR PROMPT
function generatePrompt() {
    const goal = document.getElementById('goal').value;
    const level = document.getElementById('level').value;
    const days = document.getElementById('days').value;
    const focus = document.getElementById('focus').value;

    // O prompt "secreto" que instrui o Gemini a retornar JSON puro
    const systemInstruction = `
    Você é uma API JSON para um app de treino. Crie um treino de ${goal} para nível ${level}, ${days} dias na semana. Foco extra: ${focus}.
    IMPORTANTE: Responda APENAS com um objeto JSON válido, sem markdown, sem explicações, sem crases (\`\`\`).
    
    Use EXATAMENTE este esquema JSON:
    {
        "programName": "Nome Criativo do Programa",
        "description": "Breve descrição do foco",
        "schedule": [
            {
                "dayName": "Dia 1 - Nome do Treino",
                "exercises": [
                    { "name": "Nome do Exercício", "sets": "3", "reps": "10-12", "notes": "Dica rápida" }
                ]
            }
        ]
    }
    `;

    document.getElementById('prompt-output').value = systemInstruction;
    navigateTo('view-import');
}

function copyToClipboard() {
    const copyText = document.getElementById("prompt-output");
    copyText.select();
    document.execCommand("copy");
    alert("Prompt copiado! Cole no Gemini.");
}

// 2. IMPORTAR JSON
function processJSON() {
    const input = document.getElementById('json-input').value;
    try {
        // Tenta limpar o JSON caso o usuário tenha copiado crases ou texto extra
        const cleanJson = input.replace(/```json/g, '').replace(/```/g, '').trim();
        const plan = JSON.parse(cleanJson);

        if(!plan.schedule || !Array.isArray(plan.schedule)) throw new Error("Formato inválido");

        currentPlan = plan;
        localStorage.setItem('fitflow_plan', JSON.stringify(plan));
        renderHome();
        navigateTo('view-home');
    } catch (e) {
        alert("Erro ao ler o JSON. Certifique-se de copiar apenas o código gerado pelo Gemini. Erro: " + e.message);
    }
}

// 3. RENDERIZAR HOME
function renderHome() {
    document.getElementById('no-plan-state').style.display = 'none';
    document.getElementById('plan-dashboard').style.display = 'block';
    
    document.getElementById('program-title').innerText = currentPlan.programName;
    document.getElementById('program-desc').innerText = currentPlan.description;

    const list = document.getElementById('days-list');
    list.innerHTML = '';

    currentPlan.schedule.forEach((day, index) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h3 style="color:white;">${day.dayName}</h3>
                    <p>${day.exercises.length} Exercícios</p>
                </div>
                <button class="btn" style="width: auto; padding: 10px 20px; font-size:14px;" onclick="startWorkout(${index})">Iniciar</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// 4. MODO TREINO
function startWorkout(dayIndex) {
    const day = currentPlan.schedule[dayIndex];
    document.getElementById('workout-day-title').innerText = day.dayName;
    
    const container = document.getElementById('workout-exercises');
    container.innerHTML = '';
    currentWorkoutData = []; // Resetar stats

    day.exercises.forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="margin-bottom:10px;">
                <h3 style="color: var(--accent-color);">${ex.name}</h3>
                <p style="font-size:13px;">Meta: ${ex.sets} séries x ${ex.reps} reps ${ex.notes ? '• ' + ex.notes : ''}</p>
            </div>
            
            <div class="input-group">
                <input type="number" class="mini-input" placeholder="Kg Carga" id="weight-${idx}">
                <input type="number" class="mini-input" placeholder="Reps Feitas" id="reps-${idx}">
            </div>
        `;
        container.appendChild(div);
        // Prepara objeto para salvar dados (simples)
        currentWorkoutData.push({ name: ex.name, setsTarget: ex.sets });
    });

    navigateTo('view-workout');
}

// 5. FINALIZAR E ESTATÍSTICAS
function finishWorkout() {
    let totalVolume = 0;
    let exercisesDone = 0;

    // Loop pelos inputs
    const inputs = document.querySelectorAll('#workout-exercises .card');
    inputs.forEach((card, idx) => {
        const weight = parseFloat(document.getElementById(`weight-${idx}`).value) || 0;
        const reps = parseFloat(document.getElementById(`reps-${idx}`).value) || 0;
        
        // Cálculo estimado de volume
        const sets = parseInt(currentWorkoutData[idx].setsTarget) || 3;
        
        if (weight > 0 && reps > 0) {
            totalVolume += (weight * reps * sets);
            exercisesDone++;
        }
    });

    document.getElementById('summary-volume').innerText = totalVolume.toLocaleString('pt-BR') + " kg";
    document.getElementById('summary-exercises').innerText = exercisesDone;

    navigateTo('view-summary');
}

function resetApp() {
    if(confirm("Tem certeza? Isso apagará seu plano atual.")) {
        localStorage.removeItem('fitflow_plan');
        location.reload();
    }
}
