// --- VARIÁVEIS GLOBAIS ---
let currentPlan = null;
let workoutSession = { dayIndex: 0, currentExerciseIndex: 0, data: [] };
let editingDayIndex = 0; 

// --- INICIALIZAÇÃO ---
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
        localStorage.removeItem('fitflow_plan');
        location.reload();
    }
};

function navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(viewId);
    if(activeEl) {
        activeEl.classList.add('active');
        window.scrollTo(0,0);
    }
}

// --- GERAÇÃO DE PROMPT COMPLETO (ANAMNESE) ---
function generatePrompt() {
    // Coleta TUDO
    const goal = document.getElementById('goal').value;
    const days = document.getElementById('days').value;
    const duration = document.getElementById('duration').value;
    const equipment = document.getElementById('equipment').value;
    const gender = document.getElementById('gender').value;
    const level = document.getElementById('level').value;
    const focus = document.getElementById('focus').value || "Geral";
    const injuries = document.getElementById('injuries').value || "Nenhuma";

    // Cardápio de Exercícios
    let exerciseMenu = "";
    if (typeof EXERCISE_DB !== 'undefined') {
        exerciseMenu = Object.entries(EXERCISE_DB)
            .map(([id, data]) => `ID ${id}: ${data.name} (${data.group})`)
            .join("\n");
    }

    // Prompt Rico
    const systemInstruction = `
    Aja como Treinador. Crie um treino JSON.
    ALUNO: ${gender}, ${level}.
    OBJETIVO: ${goal}.
    TEMPO: ${duration}.
    DIAS: ${days}.
    EQUIPAMENTO: ${equipment} (Respeite estritamente!).
    LESÕES: ${injuries}.
    FOCO: ${focus}.

    USE ESTES IDs:
    ${exerciseMenu}
    
    SCHEMA JSON:
    {
        "programName": "Nome",
        "description": "Desc",
        "schedule": [
            {
                "dayName": "Dia 1",
                "completed": false,
                "exercises": [
                    { "id": "1", "name_backup": "Supino", "targetSets": 3, "targetReps": "10", "notes": "", "isBodyweight": false }
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
        if(!plan.schedule) throw new Error("JSON inválido");
        currentPlan = plan;
        savePlan();
        renderHome();
        navigateTo('view-home');
    } catch (e) { alert("Erro JSON: " + e.message); }
}

function savePlan() {
    localStorage.setItem('fitflow_plan', JSON.stringify(currentPlan));
}

function renderHome() {
    document.getElementById('no-plan-state').style.display = 'none';
    document.getElementById('plan-dashboard').style.display = 'block';
    
    if(currentPlan.programName) document.getElementById('program-title').innerText = currentPlan.programName;
    if(currentPlan.description) document.getElementById('program-desc').innerText = currentPlan.description;

    const list = document.getElementById('days-list');
    list.innerHTML = '';
    
    currentPlan.schedule.forEach((day, idx) => {
        const completedClass = day.completed ? 'completed' : '';
        list.innerHTML += `
            <div class="card workout-item ${completedClass}">
                <div class="workout-info" onclick="startWorkout(${idx})">
                    <h3>${day.dayName}</h3>
                    <p>${day.exercises.length} Exercícios</p>
                </div>
                <div class="workout-actions">
                    <div class="btn-edit-day" onclick="openEditor(${idx})">✎</div>
                    <div class="btn-play" onclick="startWorkout(${idx})">▶</div>
                </div>
            </div>`;
    });
}

function resetApp() {
    if(confirm("Apagar tudo?")) { localStorage.removeItem('fitflow_plan'); location.reload(); }
}

// --- EDITOR DE DIA ---
function openEditor(dayIdx) {
    editingDayIndex = dayIdx;
    renderEditorList();
    navigateTo('view-edit-day');
}

function renderEditorList() {
    const list = document.getElementById('editor-list');
    const day = currentPlan.schedule[editingDayIndex];
    list.innerHTML = `<h3>Editando: ${day.dayName}</h3>`;
    if(day.exercises.length === 0) list.innerHTML += "<p>Vazio.</p>";

    day.exercises.forEach((ex, idx) => {
        const name = getExerciseName(ex);
        list.innerHTML += `
            <div class="editor-item">
                <div>
                    <div style="font-weight:bold; color:white;">${name}</div>
                    <div style="font-size:12px; color:#888;">${ex.targetSets} séries</div>
                </div>
                <div class="delete-btn" onclick="removeExercise(${idx})">✕</div>
            </div>
        `;
    });
}

function removeExercise(exIdx) {
    if(confirm("Remover?")) {
        currentPlan.schedule[editingDayIndex].exercises.splice(exIdx, 1);
        savePlan();
        renderEditorList();
    }
}

// --- BUSCA ---
function openSearchModal() {
    document.getElementById('search-modal').classList.add('active');
    document.getElementById('search-bar').value = '';
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-bar').focus();
}

function closeSearchModal() { document.getElementById('search-modal').classList.remove('active'); }

function performSearch() {
    const query = document.getElementById('search-bar').value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';
    if (query.length < 2) return;

    if (typeof EXERCISE_DB !== 'undefined') {
        Object.entries(EXERCISE_DB).forEach(([id, data]) => {
            if (data.name.toLowerCase().includes(query) || data.group.toLowerCase().includes(query)) {
                resultsContainer.innerHTML += `
                    <div class="search-result-item" onclick="addExercise('${id}')">
                        <div class="search-result-title">${data.name}</div>
                        <div class="search-result-sub">${data.group}</div>
                    </div>
                `;
            }
        });
    }
}

function addExercise(id) {
    const newExercise = {
        id: id,
        name_backup: EXERCISE_DB[id].name,
        targetSets: 3,
        targetReps: "10-12",
        notes: "Adicionado manualmente",
        isBodyweight: false
    };
    currentPlan.schedule[editingDayIndex].exercises.push(newExercise);
    savePlan();
    closeSearchModal();
    renderEditorList();
}

// --- EXECUÇÃO ---
function startWorkout(dayIdx) {
    workoutSession = { dayIndex: dayIdx, currentExerciseIndex: 0, data: [] };
    navigateTo('view-workout');
    renderActiveExercise();
}

function getExerciseName(exData) {
    if(typeof EXERCISE_DB !== 'undefined' && EXERCISE_DB[exData.id]) return EXERCISE_DB[exData.id].name;
    return exData.name_backup || "Exercício " + exData.id;
}

function renderActiveExercise() {
    const day = currentPlan.schedule[workoutSession.dayIndex];
    if(!day.exercises || day.exercises.length === 0) {
        alert("Dia vazio. Adicione exercícios.");
        navigateTo('view-home');
        return;
    }
    const exerciseConfig = day.exercises[workoutSession.currentExerciseIndex];
    const total = day.exercises.length;
    const exName = getExerciseName(exerciseConfig);

    const progress = ((workoutSession.currentExerciseIndex + 1) / total) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('step-counter').innerText = `${workoutSession.currentExerciseIndex + 1} / ${total}`;
    
    document.getElementById('btn-next').innerText = (workoutSession.currentExerciseIndex === total - 1) ? "Finalizar Treino" : "Próximo";
    document.getElementById('btn-prev').style.visibility = (workoutSession.currentExerciseIndex === 0) ? "hidden" : "visible";

    if (!workoutSession.data[workoutSession.currentExerciseIndex]) {
        const targetSets = parseInt(exerciseConfig.targetSets) || 3;
        workoutSession.data[workoutSession.currentExerciseIndex] = {
            id: exerciseConfig.id,
            sets: Array.from({ length: targetSets }, () => ({ weight: '', reps: '', completed: false })),
            isBodyweight: exerciseConfig.isBodyweight || false
        };
    }
    const currentSessionData = workoutSession.data[workoutSession.currentExerciseIndex];

    const container = document.getElementById('exercise-card-container');
    container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <h1 class="exercise-title">${exName}</h1>
                <button class="edit-btn" onclick="openEditModal()">⚙️ Editar</button>
            </div>
            <div class="meta-tags">
                <span class="tag">Meta: ${exerciseConfig.targetSets} Séries</span>
                <span class="tag">Reps: ${exerciseConfig.targetReps}</span>
            </div>
            <div class="notes-box"><p>💡 ${exerciseConfig.notes || 'Sem observações'}</p></div>
            <button class="toggle-btn ${currentSessionData.isBodyweight ? 'active' : ''}" onclick="toggleBodyweight()">
                ${currentSessionData.isBodyweight ? '◉ Peso do Corpo' : '○ Usar Peso'}
            </button>
            <div id="sets-container"></div>
        </div>
    `;

    const setsDiv = document.getElementById('sets-container');
    currentSessionData.sets.forEach((set, idx) => {
        setsDiv.innerHTML += `
            <div class="set-row" id="row-${idx}">
                <div class="check-container ${set.completed ? 'checked' : ''}" onclick="toggleCheck(${idx})">
                    <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
                <div class="set-number">#${idx+1}</div>
                <div class="input-cell">
                    <input type="text" inputmode="decimal" id="w-${idx}" placeholder="kg" value="${set.weight}" oninput="saveSessionData(${idx})" ${currentSessionData.isBodyweight ? 'disabled class="disabled-input"' : ''}>
                </div>
                <div class="input-cell">
                    <input type="text" inputmode="text" id="r-${idx}" placeholder="${exerciseConfig.targetReps}" value="${set.reps}" oninput="saveSessionData(${idx})">
                </div>
            </div>
        `;
    });
}

function toggleBodyweight() {
    const idx = workoutSession.currentExerciseIndex;
    const currentStatus = workoutSession.data[idx].isBodyweight;
    workoutSession.data[idx].isBodyweight = !currentStatus;
    currentPlan.schedule[workoutSession.dayIndex].exercises[idx].isBodyweight = !currentStatus;
    savePlan();
    renderActiveExercise();
}

function toggleCheck(setIdx) {
    const exIdx = workoutSession.currentExerciseIndex;
    const set = workoutSession.data[exIdx].sets[setIdx];
    set.completed = !set.completed;
    renderActiveExercise();
}

function saveSessionData(setIdx) {
    const exIdx = workoutSession.currentExerciseIndex;
    workoutSession.data[exIdx].sets[setIdx].weight = document.getElementById(`w-${setIdx}`).value;
    workoutSession.data[exIdx].sets[setIdx].reps = document.getElementById(`r-${setIdx}`).value;
}

// Modal Edição Rápida
function openEditModal() {
    const day = currentPlan.schedule[workoutSession.dayIndex];
    const config = day.exercises[workoutSession.currentExerciseIndex];
    const modalHTML = `
        <div id="edit-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; display:flex; justify-content:center; align-items:center;">
            <div class="card" style="width:90%; max-width:350px; background:#1C1C1E; border:1px solid #333;">
                <h2>Configurar</h2>
                <label style="font-size:12px; color:#888;">Séries Alvo</label>
                <input type="number" id="edit-sets" value="${config.targetSets}">
                <label style="font-size:12px; color:#888;">Repetições</label>
                <input type="text" id="edit-reps" value="${config.targetReps}">
                <label style="font-size:12px; color:#888;">Notas</label>
                <textarea id="edit-notes" style="height:60px;">${config.notes || ''}</textarea>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="btn btn-secondary" onclick="document.getElementById('edit-modal').remove()">Cancelar</button>
                    <button class="btn" onclick="saveEditAndRefresh()">Salvar</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function saveEditAndRefresh() {
    const dayIdx = workoutSession.dayIndex;
    const exIdx = workoutSession.currentExerciseIndex;
    currentPlan.schedule[dayIdx].exercises[exIdx].targetSets = parseInt(document.getElementById('edit-sets').value);
    currentPlan.schedule[dayIdx].exercises[exIdx].targetReps = document.getElementById('edit-reps').value;
    currentPlan.schedule[dayIdx].exercises[exIdx].notes = document.getElementById('edit-notes').value;
    savePlan();
    workoutSession.data[exIdx] = null;
    document.getElementById('edit-modal').remove();
    renderActiveExercise();
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

function confirmExit() { if(confirm("Sair?")) navigateTo('view-home'); }

function finishWorkout() {
    let vol = 0; let sets = 0;
    workoutSession.data.forEach(ex => {
        if(ex && ex.sets) {
            ex.sets.forEach(s => {
                if(s.completed) {
                    sets++;
                    const w = parseFloat(s.weight.replace(',','.')) || 0;
                    vol += (w * (parseFloat(s.reps)||0));
                }
            });
        }
    });
    // Marca dia como feito
    currentPlan.schedule[workoutSession.dayIndex].completed = true;
    savePlan();
    document.getElementById('summary-volume').innerText = vol.toLocaleString('pt-BR') + ' kg';
    navigateTo('view-summary');
}