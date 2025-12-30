// VARIÁVEIS GLOBAIS
let currentPlan = null;
let workoutSession = {
    dayIndex: 0,
    currentExerciseIndex: 0,
    data: [] // Armazena o que o usuário fez: [{ name: 'Supino', sets: [{weight: 20, reps: 10}, ...] }]
};

// INICIALIZAÇÃO
window.onload = () => {
    const savedPlan = localStorage.getItem('fitflow_plan');
    if (savedPlan) {
        currentPlan = JSON.parse(savedPlan);
        renderHome();
    } else {
        document.getElementById('no-plan-state').style.display = 'block';
    }
};

function navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    window.scrollTo(0,0);
}

// 1. GERAR PROMPT (AJUSTADO PARA PEDIR ORDEM CORRETA)
function generatePrompt() {
    const goal = document.getElementById('goal').value;
    const level = document.getElementById('level').value;
    const days = document.getElementById('days').value;
    const focus = document.getElementById('focus').value;

    const systemInstruction = `
    Crie um treino JSON para app fitness.
    Contexto: ${goal}, Nível ${level}, ${days} dias/semana. Foco: ${focus}.
    
    REGRAS ESTRITAS:
    1. A ordem dos exercícios DEVE ser lógica: Aquecimento/Mobilidade -> Compostos (Pesados) -> Isolados -> Abdominais/Alongamento.
    2. Responda APENAS com JSON válido. Sem markdown.
    
    SCHEMA JSON:
    {
        "programName": "Nome Curto e Impactante",
        "description": "Uma frase motivacional sobre o foco.",
        "schedule": [
            {
                "dayName": "Dia 1 - Push / Empurrar",
                "exercises": [
                    { 
                        "name": "Supino Reto", 
                        "sets": "3", 
                        "reps": "8-10", 
                        "notes": "Desça controlando a barra." 
                    }
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
        const input = document.getElementById('json-input').value.replace(/```json/g, '').replace(/```/g, '').trim();
        const plan = JSON.parse(input);
        if(!plan.schedule) throw new Error("JSON sem cronograma");
        
        currentPlan = plan;
        localStorage.setItem('fitflow_plan', JSON.stringify(plan));
        renderHome();
        navigateTo('view-home');
    } catch (e) {
        alert("JSON inválido. Tente novamente.");
    }
}

function renderHome() {
    document.getElementById('no-plan-state').style.display = 'none';
    document.getElementById('plan-dashboard').style.display = 'block';
    document.getElementById('program-title').innerText = currentPlan.programName;
    document.getElementById('program-desc').innerText = currentPlan.description;

    const list = document.getElementById('days-list');
    list.innerHTML = '';
    currentPlan.schedule.forEach((day, idx) => {
        list.innerHTML += `
            <div class="card" onclick="startWorkout(${idx})">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="color:white; margin-bottom:5px;">${day.dayName}</h3>
                        <p style="margin:0; font-size:13px;">${day.exercises.length} Exercícios</p>
                    </div>
                    <span style="color:var(--accent-color);">Iniciar ></span>
                </div>
            </div>`;
    });
}

function resetApp() {
    if(confirm("Apagar tudo?")) {
        localStorage.removeItem('fitflow_plan');
        location.reload();
    }
}

// --- LOGICA DE TREINO (CORE) ---

function startWorkout(dayIdx) {
    workoutSession = {
        dayIndex: dayIdx,
        currentExerciseIndex: 0,
        data: [] 
    };
    navigateTo('view-workout');
    renderActiveExercise();
}

function renderActiveExercise() {
    const day = currentPlan.schedule[workoutSession.dayIndex];
    const exercise = day.exercises[workoutSession.currentExerciseIndex];
    const totalExercises = day.exercises.length;
    
    // Atualiza Barra de Progresso
    const progress = ((workoutSession.currentExerciseIndex) / totalExercises) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('step-counter').innerText = `${workoutSession.currentExerciseIndex + 1} de ${totalExercises}`;

    // Atualiza Botões
    const btnNext = document.getElementById('btn-next');
    btnNext.innerText = (workoutSession.currentExerciseIndex === totalExercises - 1) ? "Finalizar" : "Próximo";
    document.getElementById('btn-prev').style.visibility = (workoutSession.currentExerciseIndex === 0) ? "hidden" : "visible";

    // Recupera dados já preenchidos (se o usuário voltou) ou cria novos
    let exData = workoutSession.data[workoutSession.currentExerciseIndex];
    if (!exData) {
        // Parse "3" ou "3-4" para inteiro. Default 3.
        let numSets = parseInt(exercise.sets) || 3; 
        exData = {
            name: exercise.name,
            sets: Array(numSets).fill({ weight: '', reps: '', completed: false, isBodyweight: false })
        };
        workoutSession.data[workoutSession.currentExerciseIndex] = exData;
    }

    // Renderiza HTML do Card
    const container = document.getElementById('exercise-card-container');
    container.innerHTML = `
        <div class="card">
            <h1 style="color: var(--accent-color); font-size: 28px;">${exercise.name}</h1>
            <div style="margin-bottom: 20px;">
                <span style="background:#333; padding:4px 10px; border-radius:4px; font-size:13px; margin-right:10px;">Meta: ${exercise.sets} Séries</span>
                <span style="background:#333; padding:4px 10px; border-radius:4px; font-size:13px;">Reps: ${exercise.reps}</span>
            </div>
            <p style="font-style: italic; opacity: 0.8;">"${exercise.notes || 'Sem observações.'}"</p>
            
            <button class="toggle-btn" id="bw-toggle" onclick="toggleBodyweight()">
                ${exData.isBodyweight ? '◉ Usando Peso do Corpo' : '○ Usar Peso do Corpo (Sem Carga)'}
            </button>

            <div id="sets-container">
                </div>
        </div>
    `;

    // Renderiza as linhas de Sets
    const setsContainer = document.getElementById('sets-container');
    exData.sets.forEach((set, idx) => {
        const isBw = exData.isBodyweight;
        setsContainer.innerHTML += `
            <div class="set-row" id="row-${idx}">
                <div class="check-container ${set.completed ? 'checked' : ''}" onclick="toggleCheck(${idx})">
                    <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
                <div class="set-number">#${idx + 1}</div>
                
                <div class="input-cell">
                    <input type="number" id="weight-${idx}" placeholder="-" value="${set.weight}" 
                           onchange="saveInput(${idx})" ${isBw ? 'disabled style="opacity:0.3"' : ''}>
                    <span class="input-label">Kg</span>
                </div>
                
                <div class="input-cell">
                    <input type="number" id="reps-${idx}" placeholder="-" value="${set.reps}" onchange="saveInput(${idx})">
                    <span class="input-label">Reps</span>
                </div>
            </div>
        `;
    });
}

function toggleBodyweight() {
    const idx = workoutSession.currentExerciseIndex;
    const currentStatus = workoutSession.data[idx].isBodyweight;
    
    // Inverte o status
    workoutSession.data[idx].isBodyweight = !currentStatus;
    
    // Limpa pesos se for bodyweight
    if (!currentStatus) {
        workoutSession.data[idx].sets.forEach(s => s.weight = 0);
    }
    
    // Re-renderiza para aplicar mudanças visuais
    renderActiveExercise();
}

function toggleCheck(setIdx) {
    const exIdx = workoutSession.currentExerciseIndex;
    const set = workoutSession.data[exIdx].sets[setIdx];
    
    set.completed = !set.completed;
    
    // Visual update apenas da classe
    const checkBtn = document.querySelector(`#row-${setIdx} .check-container`);
    if(set.completed) checkBtn.classList.add('checked');
    else checkBtn.classList.remove('checked');
}

function saveInput(setIdx) {
    const exIdx = workoutSession.currentExerciseIndex;
    const weightVal = document.getElementById(`weight-${setIdx}`).value;
    const repsVal = document.getElementById(`reps-${setIdx}`).value;
    
    workoutSession.data[exIdx].sets[setIdx].weight = weightVal;
    workoutSession.data[exIdx].sets[setIdx].reps = repsVal;
}

function nextExercise() {
    // Salva estado atual visualmente (já salvo no onchange, mas por segurança)
    const dayData = currentPlan.schedule[workoutSession.dayIndex];
    
    if (workoutSession.currentExerciseIndex < dayData.exercises.length - 1) {
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
    if(confirm("Sair do treino? O progresso será perdido.")) {
        navigateTo('view-home');
    }
}

function finishWorkout() {
    let totalVolume = 0;
    let totalSets = 0;

    workoutSession.data.forEach(ex => {
        if(ex && ex.sets) {
            ex.sets.forEach(set => {
                if(set.completed) {
                    totalSets++;
                    const w = parseFloat(set.weight) || 0;
                    const r = parseFloat(set.reps) || 0;
                    totalVolume += (w * r);
                }
            });
        }
    });

    document.getElementById('summary-volume').innerText = totalVolume.toLocaleString('pt-BR') + " kg";
    document.getElementById('summary-sets').innerText = totalSets;
    navigateTo('view-summary');
}
