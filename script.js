// VARIÁVEIS GLOBAIS
let currentPlan = null;
let workoutSession = {
    dayIndex: 0,
    currentExerciseIndex: 0,
    data: [] 
};

// INICIALIZAÇÃO
window.onload = () => {
    const savedPlan = localStorage.getItem('fitflow_plan');
    if (savedPlan) {
        try {
            currentPlan = JSON.parse(savedPlan);
            renderHome();
        } catch (e) {
            console.error("Erro ao carregar plano salvo", e);
            localStorage.removeItem('fitflow_plan'); // Limpa se estiver corrompido
        }
    } else {
        document.getElementById('no-plan-state').style.display = 'block';
    }
};

function navigateTo(viewId) {
    // Esconde todas as views
    document.querySelectorAll('.view').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none'; // Garante que suma
    });
    
    // Mostra a desejada
    const activeEl = document.getElementById(viewId);
    activeEl.classList.add('active');
    
    // Ajuste específico para layout flex da tela de treino
    if(viewId === 'view-workout') {
        activeEl.style.display = 'flex';
    } else {
        activeEl.style.display = 'block';
    }
    window.scrollTo(0,0);
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
        const rawInput = document.getElementById('json-input').value;
        // Limpeza agressiva para garantir JSON puro
        const cleanJson = rawInput.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const plan = JSON.parse(cleanJson);
        if(!plan.schedule) throw new Error("JSON sem cronograma");
        
        currentPlan = plan;
        localStorage.setItem('fitflow_plan', JSON.stringify(plan));
        renderHome();
        navigateTo('view-home');
    } catch (e) {
        alert("Erro no JSON: " + e.message + "\nCertifique-se de copiar APENAS o código.");
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
        // Correção do botão desformatado: Agora é um item de lista clicável e limpo
        list.innerHTML += `
            <div class="card workout-item" onclick="startWorkout(${idx})">
                <div class="workout-info">
                    <h3>${day.dayName}</h3>
                    <p>${day.exercises.length} Exercícios</p>
                </div>
                <div class="workout-action">
                    <span class="btn-icon">▶</span>
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

// --- LOGICA DE TREINO (CORE FIX) ---

function startWorkout(dayIdx) {
    try {
        workoutSession = {
            dayIndex: dayIdx,
            currentExerciseIndex: 0,
            data: [] 
        };
        navigateTo('view-workout');
        
        // Pequeno delay para garantir que o DOM renderizou o container
        setTimeout(() => renderActiveExercise(), 50);
    } catch (e) {
        alert("Erro ao iniciar treino: " + e.message);
    }
}

function renderActiveExercise() {
    const day = currentPlan.schedule[workoutSession.dayIndex];
    
    // Verificação de segurança
    if (!day || !day.exercises) {
        alert("Erro nos dados do treino.");
        return;
    }

    const exercise = day.exercises[workoutSession.currentExerciseIndex];
    const totalExercises = day.exercises.length;
    
    // Atualiza Barra de Progresso
    const progress = ((workoutSession.currentExerciseIndex + 1) / totalExercises) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('step-counter').innerText = `${workoutSession.currentExerciseIndex + 1} / ${totalExercises}`;

    // Atualiza Botões
    const btnNext = document.getElementById('btn-next');
    btnNext.innerText = (workoutSession.currentExerciseIndex === totalExercises - 1) ? "Finalizar" : "Próximo";
    
    const btnPrev = document.getElementById('btn-prev');
    btnPrev.style.visibility = (workoutSession.currentExerciseIndex === 0) ? "hidden" : "visible";

    // INICIALIZAÇÃO DOS DADOS (CORREÇÃO DE BUG DE REFERÊNCIA)
    if (!workoutSession.data[workoutSession.currentExerciseIndex]) {
        // Tenta converter sets para número, se falhar usa 3
        let numSets = 3;
        if(exercise.sets) {
            // Remove letras, pega só o primeiro número. Ex: "3-4" vira 3.
            const cleanSets = exercise.sets.toString().match(/\d+/);
            if(cleanSets) numSets = parseInt(cleanSets[0]);
        }

        // CRUCIAL: Array.from cria objetos INDEPENDENTES para cada série
        workoutSession.data[workoutSession.currentExerciseIndex] = {
            name: exercise.name,
            isBodyweight: false,
            sets: Array.from({ length: numSets }, () => ({
                weight: '', 
                reps: '', // Inicializa vazio para o usuário preencher
                completed: false
            }))
        };
    }

    const exData = workoutSession.data[workoutSession.currentExerciseIndex];

    // Renderiza HTML do Card
    const container = document.getElementById('exercise-card-container');
    container.innerHTML = `
        <div class="card exercise-card-content">
            <h1 class="exercise-title">${exercise.name}</h1>
            
            <div class="meta-tags">
                <span class="tag">Meta: ${exercise.sets} Séries</span>
                <span class="tag">Reps: ${exercise.reps}</span>
            </div>
            
            <div class="notes-box">
                <p>💡 ${exercise.notes || 'Sem observações.'}</p>
            </div>
            
            <button class="toggle-btn ${exData.isBodyweight ? 'active' : ''}" onclick="toggleBodyweight()">
                ${exData.isBodyweight ? '◉ Peso do Corpo Ativo' : '○ Usar Peso do Corpo'}
            </button>

            <div id="sets-container"></div>
        </div>
    `;

    // Renderiza as linhas de Sets
    const setsContainer = document.getElementById('sets-container');
    
    exData.sets.forEach((set, idx) => {
        // CORREÇÃO: Usar type="text" e inputmode="decimal" aceita "12-15" ou números, sem bugar em mobile
        const isBw = exData.isBodyweight;
        
        setsContainer.innerHTML += `
            <div class="set-row" id="row-${idx}">
                <div class="check-col">
                    <div class="check-container ${set.completed ? 'checked' : ''}" onclick="toggleCheck(${idx})">
                        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </div>
                </div>
                
                <div class="set-number">#${idx + 1}</div>
                
                <div class="input-cell">
                    <input type="text" inputmode="decimal" id="weight-${idx}" placeholder="kg" 
                           value="${set.weight}" 
                           oninput="saveInput(${idx})" 
                           ${isBw ? 'disabled' : ''} 
                           class="${isBw ? 'disabled-input' : ''}">
                    <span class="input-label">Kg</span>
                </div>
                
                <div class="input-cell">
                    <input type="text" inputmode="text" id="reps-${idx}" placeholder="${exercise.reps}" 
                           value="${set.reps}" 
                           oninput="saveInput(${idx})">
                    <span class="input-label">Reps</span>
                </div>
            </div>
        `;
    });
}

function toggleBodyweight() {
    const idx = workoutSession.currentExerciseIndex;
    workoutSession.data[idx].isBodyweight = !workoutSession.data[idx].isBodyweight;
    renderActiveExercise(); // Re-renderiza para bloquear/desbloquear inputs
}

function toggleCheck(setIdx) {
    const exIdx = workoutSession.currentExerciseIndex;
    const set = workoutSession.data[exIdx].sets[setIdx];
    set.completed = !set.completed;
    
    // Atualização visual rápida sem re-renderizar tudo
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
                    // Tenta limpar strings como "12 reps" para apenas "12" no cálculo
                    const w = parseFloat(String(set.weight).replace(',','.')) || 0;
                    const r = parseFloat(String(set.reps).replace(',','.')) || 0;
                    totalVolume += (w * r);
                }
            });
        }
    });

    document.getElementById('summary-volume').innerText = totalVolume.toLocaleString('pt-BR') + " kg";
    document.getElementById('summary-sets').innerText = totalSets;
    navigateTo('view-summary');
}
