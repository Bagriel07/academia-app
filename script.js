// --- VARIÁVEIS GLOBAIS ---
let currentPlan = null;
let workoutSession = {
    dayIndex: 0,
    currentExerciseIndex: 0,
    data: [] 
};

// --- SISTEMA DE INICIALIZAÇÃO SEGURO ---
window.onload = () => {
    try {
        const savedPlan = localStorage.getItem('fitflow_plan');
        if (savedPlan) {
            currentPlan = JSON.parse(savedPlan);
            renderHome();
            navigateTo('view-home');
        } else {
            document.getElementById('no-plan-state').style.display = 'block';
            navigateTo('view-home');
        }
    } catch (e) {
        console.error("Erro crítico na inicialização:", e);
        alert("Ocorreu um erro ao carregar seus dados. O app será reiniciado.");
        localStorage.removeItem('fitflow_plan');
        location.reload();
    }
};

function navigateTo(viewId) {
    // Esconde todas as views removendo a classe ativa
    document.querySelectorAll('.view').forEach(el => {
        el.classList.remove('active');
    });
    
    // Mostra a view desejada adicionando a classe (o CSS !important cuida do resto)
    const activeEl = document.getElementById(viewId);
    if(activeEl) {
        activeEl.classList.add('active');
        window.scrollTo(0,0);
    } else {
        console.error("Tela não encontrada: " + viewId);
    }
}

// 1. GERAR PROMPT
function generatePrompt() {
    const goal = document.getElementById('goal').value;
    const level = document.getElementById('level').value;
    const days = document.getElementById('days').value;
    const focus = document.getElementById('focus').value;

    const systemInstruction = `
    Crie um treino JSON para app fitness.
    Contexto: ${goal}, Nível ${level}, ${days} dias/semana. Foco: ${focus}.
    REGRAS ESTRITAS:
    1. A ordem deve ser: Aquecimento -> Compostos -> Isolados -> Abdominais.
    2. Responda APENAS com JSON válido.
    
    SCHEMA JSON:
    {
        "programName": "Nome do Programa",
        "description": "Descrição",
        "schedule": [
            {
                "dayName": "Dia 1 - Peito",
                "exercises": [
                    { "name": "Supino", "sets": "3", "reps": "10", "notes": "Obs" }
                ]
            }
        ]
    }
    `;
    document.getElementById('prompt-output').value = systemInstruction;
    navigateTo('view-import');
}

function copyToClipboard() {
    document.getElementById("prompt-output").select();
    document.execCommand("copy");
    alert("Copiado!");
}

function processJSON() {
    try {
        const rawInput = document.getElementById('json-input').value;
        const cleanJson = rawInput.replace(/```json/g, '').replace(/```/g, '').trim();
        const plan = JSON.parse(cleanJson);
        
        if(!plan.schedule) throw new Error("JSON inválido (sem cronograma)");
        
        currentPlan = plan;
        localStorage.setItem('fitflow_plan', JSON.stringify(plan));
        renderHome();
        navigateTo('view-home');
    } catch (e) {
        alert("Erro no JSON: " + e.message);
    }
}

function renderHome() {
    document.getElementById('no-plan-state').style.display = 'none';
    document.getElementById('plan-dashboard').style.display = 'block';
    
    if(currentPlan.programName) document.getElementById('program-title').innerText = currentPlan.programName;
    if(currentPlan.description) document.getElementById('program-desc').innerText = currentPlan.description;

    const list = document.getElementById('days-list');
    list.innerHTML = '';
    
    currentPlan.schedule.forEach((day, idx) => {
        list.innerHTML += `
            <div class="card workout-item" onclick="startWorkout(${idx})">
                <div class="workout-info">
                    <h3>${day.dayName}</h3>
                    <p>${day.exercises.length} Exercícios</p>
                </div>
                <div class="workout-action"><span class="btn-icon">▶</span></div>
            </div>`;
    });
}

function resetApp() {
    if(confirm("Deseja apagar todos os dados do app?")) {
        localStorage.removeItem('fitflow_plan');
        location.reload();
    }
}

// --- LÓGICA DE TREINO ---

function startWorkout(dayIdx) {
    try {
        workoutSession = { dayIndex: dayIdx, currentExerciseIndex: 0, data: [] };
        navigateTo('view-workout');
        renderActiveExercise();
    } catch(e) {
        console.error(e);
        alert("Erro ao iniciar treino. Tente resetar o app.");
    }
}

function renderActiveExercise() {
    const day = currentPlan.schedule[workoutSession.dayIndex];
    const exercise = day.exercises[workoutSession.currentExerciseIndex];
    const total = day.exercises.length;
    
    // Progresso
    const progress = ((workoutSession.currentExerciseIndex + 1) / total) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('step-counter').innerText = `${workoutSession.currentExerciseIndex + 1} / ${total}`;

    // Botões nav
    document.getElementById('btn-next').innerText = (workoutSession.currentExerciseIndex === total - 1) ? "Finalizar" : "Próximo";
    document.getElementById('btn-prev').style.visibility = (workoutSession.currentExerciseIndex === 0) ? "hidden" : "visible";

    // Inicializa dados se não existirem
    if (!workoutSession.data[workoutSession.currentExerciseIndex]) {
        let setsNum = 3;
        if(exercise.sets) {
            const match = exercise.sets.toString().match(/\d+/);
            if(match) setsNum = parseInt(match[0]);
        }
        
        workoutSession.data[workoutSession.currentExerciseIndex] = {
            name: exercise.name,
            isBodyweight: false,
            sets: Array.from({ length: setsNum }, () => ({ weight: '', reps: '', completed: false }))
        };
    }

    const exData = workoutSession.data[workoutSession.currentExerciseIndex];

    // Renderiza Card
    const container = document.getElementById('exercise-card-container');
    container.innerHTML = `
        <div class="card">
            <h1 class="exercise-title">${exercise.name}</h1>
            <div class="meta-tags">
                <span class="tag">Meta: ${exercise.sets} Séries</span>
                <span class="tag">Reps: ${exercise.reps}</span>
            </div>
            <div class="notes-box"><p>💡 ${exercise.notes || 'Sem observações'}</p></div>
            
            <button class="toggle-btn ${exData.isBodyweight ? 'active' : ''}" onclick="toggleBodyweight()">
                ${exData.isBodyweight ? '◉ Peso do Corpo' : '○ Usar Peso do Corpo'}
            </button>

            <div id="sets-container"></div>
        </div>
    `;

    // Renderiza Sets
    const setsDiv = document.getElementById('sets-container');
    exData.sets.forEach((set, idx) => {
        setsDiv.innerHTML += `
            <div class="set-row" id="row-${idx}">
                <div class="check-col">
                    <div class="check-container ${set.completed ? 'checked' : ''}" onclick="toggleCheck(${idx})">
                        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </div>
                </div>
                <div class="set-number">#${idx+1}</div>
                <div class="input-cell">
                    <input type="text" id="w-${idx}" placeholder="kg" value="${set.weight}" oninput="saveData(${idx})" ${exData.isBodyweight ? 'disabled class="disabled-input"' : ''}>
                    <span class="input-label">Kg</span>
                </div>
                <div class="input-cell">
                    <input type="text" id="r-${idx}" placeholder="reps" value="${set.reps}" oninput="saveData(${idx})">
                    <span class="input-label">Reps</span>
                </div>
            </div>
        `;
    });
}

function toggleBodyweight() {
    const idx = workoutSession.currentExerciseIndex;
    workoutSession.data[idx].isBodyweight = !workoutSession.data[idx].isBodyweight;
    renderActiveExercise();
}

function toggleCheck(setIdx) {
    const exIdx = workoutSession.currentExerciseIndex;
    const set = workoutSession.data[exIdx].sets[setIdx];
    set.completed = !set.completed;
    const el = document.querySelector(`#row-${setIdx} .check-container`);
    if(set.completed) el.classList.add('checked'); else el.classList.remove('checked');
}

function saveData(setIdx) {
    const exIdx = workoutSession.currentExerciseIndex;
    workoutSession.data[exIdx].sets[setIdx].weight = document.getElementById(`w-${setIdx}`).value;
    workoutSession.data[exIdx].sets[setIdx].reps = document.getElementById(`r-${setIdx}`).value;
}

function nextExercise() {
    const day = currentPlan.schedule[workoutSession.dayIndex];
    if (workoutSession.currentExerciseIndex < day.exercises.length - 1) {
        workoutSession.currentExerciseIndex++;
        renderActiveExercise();
    } else {
        finishWorkout();
    }
}

function prevExercise() {
    if (workoutSession.currentExerciseIndex > 0) {
        workoutSession.currentExerciseIndex--;
        renderActiveExercise();
    }
}

function confirmExit() {
    if(confirm("Sair do treino?")) navigateTo('view-home');
}

function finishWorkout() {
    let vol = 0; let sets = 0;
    workoutSession.data.forEach(ex => {
        ex.sets.forEach(s => {
            if(s.completed) {
                sets++;
                const w = parseFloat(s.weight.replace(',','.')) || 0;
                const r = parseFloat(s.reps.replace(',','.')) || 0;
                vol += (w * r);
            }
        });
    });
    document.getElementById('summary-volume').innerText = vol.toLocaleString('pt-BR') + ' kg';
    document.getElementById('summary-sets').innerText = sets;
    navigateTo('view-summary');
}
