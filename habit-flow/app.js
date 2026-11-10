/**
 * HabitFlow Mobile — App com 4 Homes Independentes:
 * 1. Começar (Modo Constância)
 * 2. Deixar (Modo Abstinência)
 * 3. Agenda (Lista do Dia & Filtros)
 * 4. Horários (Time-blocking 06:00 às 23:00)
 */

const STORAGE_KEYS = {
  HABITS: 'habitflow_habits_v1',
  AGENDA: 'habitflow_agenda_v1'
};

const MILESTONES = [7, 21, 30, 90];
const HOURS_RANGE = Array.from({ length: 18 }, (_, i) => {
  const hour = i + 6; // 06:00 às 23:00
  return `${String(hour).padStart(2, '0')}:00`;
});

const SCREEN_TITLES = {
  start: 'Hábitos para Começar',
  stop: 'Hábitos para Deixar',
  agenda: 'Agenda de Hoje',
  hours: 'Horários (06h – 23h)'
};

let state = {
  activeScreen: 'start', // 'start' | 'stop' | 'agenda' | 'hours'
  habits: [],
  agenda: [],
  agendaFilter: 'all', // 'all' | 'pending' | 'completed' | 'habits'
  hoursPeriod: 'all', // 'all' | 'morning' | 'afternoon' | 'night'
  pendingRelapseHabitId: null
};

// ==========================================
// UTILITÁRIOS DE DATA E TEMPO
// ==========================================

function getTodayKey(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getTodayKey(d);
}

function formatShortHeaderDate(dateObj = new Date()) {
  return dateObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short'
  });
}

function updateStatusBarClock() {
  const el = document.getElementById('statusBarClock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function calculateAbstinenceDuration(startTimestamp) {
  const now = Date.now();
  const diffMs = Math.max(0, now - Number(startTimestamp));
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes };
}

function getGoalProgress(currentDays) {
  let target = MILESTONES.find(m => currentDays < m) || 90;
  if (currentDays >= 90) {
    target = Math.ceil((currentDays + 1) / 30) * 30;
  }
  const percentage = Math.min(100, Math.round((currentDays / target) * 100));
  return { target, percentage };
}

function computeBuildStreak(completedDates = []) {
  if (!Array.isArray(completedDates) || completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  if (!set.has(todayKey) && !set.has(yesterdayKey)) return 0;

  let streak = 0;
  let cursor = new Date();
  if (!set.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const key = getTodayKey(cursor);
    if (set.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ==========================================
// DADOS DEMO & LOCALSTORAGE
// ==========================================

function createDemoData() {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  const today = getTodayKey();
  const d1 = getTodayKey(new Date(now - 1 * dayMs));
  const d2 = getTodayKey(new Date(now - 2 * dayMs));
  const d3 = getTodayKey(new Date(now - 3 * dayMs));
  const d4 = getTodayKey(new Date(now - 4 * dayMs));
  const d5 = getTodayKey(new Date(now - 5 * dayMs));

  state.habits = [
    {
      id: 'hab_start_1',
      name: 'Leitura Focada (20 páginas)',
      category: 'start',
      suggestedTime: '07:00',
      completedDates: [d5, d4, d3, d2, d1, today],
      bestStreak: 6,
      createdAt: now - 10 * dayMs
    },
    {
      id: 'hab_start_2',
      name: 'Meditação Mindfulness (10 min)',
      category: 'start',
      suggestedTime: '08:00',
      completedDates: [d2, d1, today],
      bestStreak: 8,
      createdAt: now - 15 * dayMs
    },
    {
      id: 'hab_start_3',
      name: 'Treino de Força & Mobilidade',
      category: 'start',
      suggestedTime: '18:00',
      completedDates: [d3, d2, d1],
      bestStreak: 12,
      createdAt: now - 25 * dayMs
    },
    {
      id: 'hab_stop_1',
      name: 'Sem Açúcar Refinado & Refrigerante',
      category: 'stop',
      suggestedTime: '',
      abstinenceStartTimestamp: now - (14 * dayMs + 6 * hourMs),
      bestRecordDays: 21,
      relapseCount: 1,
      createdAt: now - 40 * dayMs
    },
    {
      id: 'hab_stop_2',
      name: 'Zero Redes Sociais na Cama',
      category: 'stop',
      suggestedTime: '22:00',
      abstinenceStartTimestamp: now - (5 * dayMs + 11 * hourMs),
      bestRecordDays: 9,
      relapseCount: 2,
      createdAt: now - 20 * dayMs
    }
  ];

  state.agenda = [
    {
      id: 'ag_1',
      time: '07:00',
      type: 'habit',
      habitId: 'hab_start_1',
      title: 'Leitura Focada (20 páginas)',
      completed: true,
      dateKey: today
    },
    {
      id: 'ag_2',
      time: '08:00',
      type: 'habit',
      habitId: 'hab_start_2',
      title: 'Meditação Mindfulness (10 min)',
      completed: true,
      dateKey: today
    },
    {
      id: 'ag_3',
      time: '10:00',
      type: 'task',
      habitId: null,
      title: 'Deep Work: Planejamento do projeto',
      completed: false,
      dateKey: today
    },
    {
      id: 'ag_4',
      time: '15:00',
      type: 'task',
      habitId: null,
      title: 'Revisar pendências e responder mensagens',
      completed: false,
      dateKey: today
    },
    {
      id: 'ag_5',
      time: '18:00',
      type: 'habit',
      habitId: 'hab_start_3',
      title: 'Treino de Força & Mobilidade',
      completed: false,
      dateKey: today
    }
  ];

  saveState();
}

function loadState() {
  try {
    const rawHabits = localStorage.getItem(STORAGE_KEYS.HABITS);
    const rawAgenda = localStorage.getItem(STORAGE_KEYS.AGENDA);
    if (!rawHabits && !rawAgenda) {
      createDemoData();
      return;
    }
    state.habits = rawHabits ? JSON.parse(rawHabits) : [];
    state.agenda = rawAgenda ? JSON.parse(rawAgenda) : [];
    syncAgendaWithHabits();
  } catch (e) {
    createDemoData();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
  localStorage.setItem(STORAGE_KEYS.AGENDA, JSON.stringify(state.agenda));
}

function syncAgendaWithHabits() {
  const today = getTodayKey();
  state.agenda.forEach(item => {
    if (item.type === 'habit' && item.habitId) {
      const habit = state.habits.find(h => h.id === item.habitId);
      if (habit && habit.category === 'start') {
        item.title = habit.name;
        item.completed = Array.isArray(habit.completedDates) && habit.completedDates.includes(today);
      }
    }
  });
}

// ==========================================
// NAVEGAÇÃO ENTRE AS 4 HOMES
// ==========================================

function switchScreen(screenKey) {
  state.activeScreen = screenKey;

  document.querySelectorAll('.app-screen').forEach(sec => {
    sec.classList.toggle('active', sec.dataset.screen === screenKey);
  });

  document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === screenKey);
  });

  document.getElementById('screenHeaderTitle').textContent = SCREEN_TITLES[screenKey] || 'HabitFlow';
  document.getElementById('mobileViewport').scrollTop = 0;
}

// ==========================================
// AÇÕES DE HÁBITOS E AGENDA
// ==========================================

function toggleStartHabitToday(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit || habit.category !== 'start') return;

  if (!Array.isArray(habit.completedDates)) {
    habit.completedDates = [];
  }

  const today = getTodayKey();
  const idx = habit.completedDates.indexOf(today);
  let nowChecked = false;

  if (idx === -1) {
    habit.completedDates.push(today);
    nowChecked = true;
  } else {
    habit.completedDates.splice(idx, 1);
    nowChecked = false;
  }

  const currentStreak = computeBuildStreak(habit.completedDates);
  if (currentStreak > (habit.bestStreak || 0)) {
    habit.bestStreak = currentStreak;
  }

  state.agenda.forEach(item => {
    if (item.type === 'habit' && item.habitId === habitId) {
      item.completed = nowChecked;
    }
  });

  saveState();
  renderAll();

  showToast(nowChecked
    ? `🔥 Check-in feito: "${habit.name}"!`
    : `Check-in de hoje removido em "${habit.name}".`
  );
}

function openRelapseModal(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit || habit.category !== 'stop') return;

  state.pendingRelapseHabitId = habitId;
  const { days, hours } = calculateAbstinenceDuration(habit.abstinenceStartTimestamp);
  const currentRecord = Math.max(habit.bestRecordDays || 0, days);

  document.getElementById('relapseModalText').innerHTML = `
    Você está há <strong>${days} dias e ${hours}h</strong> sem praticar <strong>"${escapeHtml(habit.name)}"</strong>.<br><br>
    Ao confirmar, o contador será zerado para <strong>0d 0h</strong> e seu recorde de <strong>${currentRecord} dias</strong> ficará salvo.
  `;

  document.getElementById('relapseModal').classList.remove('hidden');
}

function confirmRelapseReset() {
  const habit = state.habits.find(h => h.id === state.pendingRelapseHabitId);
  if (!habit) return;

  const { days } = calculateAbstinenceDuration(habit.abstinenceStartTimestamp);
  if (days > (habit.bestRecordDays || 0)) {
    habit.bestRecordDays = days;
  }

  habit.abstinenceStartTimestamp = Date.now();
  habit.relapseCount = (habit.relapseCount || 0) + 1;
  state.pendingRelapseHabitId = null;

  document.getElementById('relapseModal').classList.add('hidden');
  saveState();
  renderAll();
  showToast(`Contador reiniciado em "${habit.name}". Força no recomeço!`);
}

function deleteHabit(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;

  state.habits = state.habits.filter(h => h.id !== habitId);
  state.agenda = state.agenda.filter(a => a.habitId !== habitId);

  saveState();
  renderAll();
  showToast(`Hábito "${habit.name}" removido.`);
}

function addAgendaItem({ time, type, title, habitId }) {
  const today = getTodayKey();

  if (type === 'habit') {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) {
      showToast('Crie ou selecione um hábito válido.');
      return false;
    }

    const exists = state.agenda.some(
      a => a.time === time && a.type === 'habit' && a.habitId === habit.id
    );
    if (exists) {
      showToast(`"${habit.name}" já está agendado às ${time}.`);
      return false;
    }

    const doneToday = Array.isArray(habit.completedDates) && habit.completedDates.includes(today);
    state.agenda.push({
      id: 'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      time,
      type: 'habit',
      habitId: habit.id,
      title: habit.name,
      completed: doneToday,
      dateKey: today
    });

    saveState();
    renderAll();
    showToast(`Hábito "${habit.name}" agendado às ${time}!`);
    return true;
  } else {
    const clean = (title || '').trim();
    if (!clean) {
      showToast('Digite o título da tarefa.');
      return false;
    }

    state.agenda.push({
      id: 'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      time,
      type: 'task',
      habitId: null,
      title: clean,
      completed: false,
      dateKey: today
    });

    saveState();
    renderAll();
    showToast(`Tarefa agendada para ${time}!`);
    return true;
  }
}

function toggleAgendaItem(itemId) {
  const item = state.agenda.find(a => a.id === itemId);
  if (!item) return;

  if (item.type === 'habit' && item.habitId) {
    toggleStartHabitToday(item.habitId);
  } else {
    item.completed = !item.completed;
    saveState();
    renderAll();
  }
}

function removeAgendaItem(itemId) {
  state.agenda = state.agenda.filter(a => a.id !== itemId);
  saveState();
  renderAll();
}

// ==========================================
// RENDERIZAÇÃO DAS 4 HOMES
// ==========================================

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMilestoneHtml(currentDays) {
  const { target, percentage } = getGoalProgress(currentDays);
  const chipsHtml = MILESTONES.map(m => {
    const reached = currentDays >= m;
    return `<span class="milestone-chip ${reached ? 'reached' : ''}">${m}d</span>`;
  }).join('');

  return `
    <div class="goal-progress-area">
      <div class="goal-header">
        <span>Meta: <strong>${currentDays}/${target}d</strong> (${percentage}%)</span>
        <div class="goal-milestones">${chipsHtml}</div>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
    </div>
  `;
}

function renderHomeStart() {
  const today = getTodayKey();
  const startHabits = state.habits.filter(h => h.category === 'start');
  const doneCount = startHabits.filter(
    h => Array.isArray(h.completedDates) && h.completedDates.includes(today)
  ).length;
  const pct = startHabits.length > 0 ? Math.round((doneCount / startHabits.length) * 100) : 0;

  document.getElementById('startHeroStat').textContent = `${doneCount} de ${startHabits.length} concluídos hoje`;
  document.getElementById('startHeroPct').textContent = `${pct}%`;
  document.getElementById('startHeroFill').style.width = `${pct}%`;
  document.getElementById('navBadgeStart').textContent = startHabits.length;

  const listEl = document.getElementById('startHabitsList');
  if (startHabits.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Você ainda não cadastrou hábitos para começar.<br>Toque em <strong>+ Novo Hábito</strong>!</div>`;
    return;
  }

  listEl.innerHTML = startHabits.map(habit => {
    const completedDates = Array.isArray(habit.completedDates) ? habit.completedDates : [];
    const isCheckedToday = completedDates.includes(today);
    const currentStreak = computeBuildStreak(completedDates);
    const totalDays = completedDates.length;
    const bestStreak = Math.max(habit.bestStreak || 0, currentStreak);

    return `
      <article class="habit-card card-start">
        <div class="card-top">
          <div class="habit-info">
            <h4>${escapeHtml(habit.name)}</h4>
            <div class="chip-row">
              ${habit.suggestedTime ? `<span class="time-badge">⏰ ${habit.suggestedTime}</span>` : ''}
              <span class="sub-badge">Constância diária</span>
            </div>
          </div>
          <div class="card-actions">
            ${habit.suggestedTime ? `
              <button class="icon-btn" onclick="quickScheduleHabit('${habit.id}')" title="Alocar na Agenda às ${habit.suggestedTime}">📅</button>
            ` : ''}
            <button class="icon-btn" onclick="openEditHabitModal('${habit.id}')" title="Editar">✎</button>
            <button class="icon-btn" onclick="deleteHabit('${habit.id}')" title="Excluir">🗑</button>
          </div>
        </div>

        <div class="counter-box">
          <div>
            <span class="primary-counter">🔥 ${currentStreak} <span class="counter-unit">${currentStreak === 1 ? 'dia' : 'dias'}</span></span>
            <div class="secondary-metrics">
              <span class="metric-tag">Total: <strong>${totalDays}d</strong></span>
              <span class="metric-tag">Recorde: <strong>${bestStreak}d</strong></span>
            </div>
          </div>

          <button class="btn-checkin-mobile ${isCheckedToday ? 'checked-today' : ''}" onclick="toggleStartHabitToday('${habit.id}')">
            ${isCheckedToday ? '✓ Feito Hoje' : 'Check-in'}
          </button>
        </div>

        ${buildMilestoneHtml(currentStreak)}
      </article>
    `;
  }).join('');
}

function renderHomeStop() {
  const stopHabits = state.habits.filter(h => h.category === 'stop');
  document.getElementById('stopHeroStat').textContent = `${stopHabits.length} ${stopHabits.length === 1 ? 'hábito monitorado' : 'hábitos monitorados'}`;
  document.getElementById('navBadgeStop').textContent = stopHabits.length;

  let maxRecord = 0;
  stopHabits.forEach(h => {
    const { days } = calculateAbstinenceDuration(h.abstinenceStartTimestamp);
    const rec = Math.max(h.bestRecordDays || 0, days);
    if (rec > maxRecord) maxRecord = rec;
  });
  document.getElementById('stopBestOverall').textContent = `${maxRecord} dias`;

  const listEl = document.getElementById('stopHabitsList');
  if (stopHabits.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Nenhum hábito em modo abstinência.<br>Toque em <strong>+ Parar Hábito</strong> para iniciar o contador!</div>`;
    return;
  }

  listEl.innerHTML = stopHabits.map(habit => {
    const { days, hours, minutes } = calculateAbstinenceDuration(habit.abstinenceStartTimestamp);
    const bestRecord = Math.max(habit.bestRecordDays || 0, days);
    const startedStr = new Date(Number(habit.abstinenceStartTimestamp)).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <article class="habit-card card-stop">
        <div class="card-top">
          <div class="habit-info">
            <h4>${escapeHtml(habit.name)}</h4>
            <div class="chip-row">
              ${habit.suggestedTime ? `<span class="time-badge">⚠️ Alerta ${habit.suggestedTime}</span>` : ''}
              <span class="sub-badge">Desde ${startedStr}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="icon-btn" onclick="openEditHabitModal('${habit.id}')" title="Editar">✎</button>
            <button class="icon-btn" onclick="deleteHabit('${habit.id}')" title="Excluir">🗑</button>
          </div>
        </div>

        <div class="counter-box">
          <div>
            <span class="primary-counter">🛡️ ${days}d ${hours}h <span class="counter-unit">${minutes}m</span></span>
            <div class="secondary-metrics">
              <span class="metric-tag">Recorde: <strong>${bestRecord}d</strong></span>
              <span class="metric-tag">Recaídas: <strong>${habit.relapseCount || 0}</strong></span>
            </div>
          </div>

          <button class="btn-relapse-mobile" onclick="openRelapseModal('${habit.id}')">
            ↺ Recaída
          </button>
        </div>

        ${buildMilestoneHtml(days)}
      </article>
    `;
  }).join('');
}

function renderHomeAgenda() {
  const sorted = [...state.agenda].sort((a, b) => a.time.localeCompare(b.time));
  const total = sorted.length;
  const done = sorted.filter(a => a.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('agendaHeroStat').textContent = `${done} de ${total} concluídos`;
  document.getElementById('agendaHeroPct').textContent = `${pct}%`;
  document.getElementById('agendaHeroFill').style.width = `${pct}%`;
  document.getElementById('navBadgeAgenda').textContent = total - done;

  const filtered = sorted.filter(item => {
    if (state.agendaFilter === 'pending') return !item.completed;
    if (state.agendaFilter === 'completed') return item.completed;
    if (state.agendaFilter === 'habits') return item.type === 'habit';
    return true;
  });

  const listEl = document.getElementById('agendaItemsList');
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Nenhum item encontrado para este filtro na agenda de hoje.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(item => `
    <div class="agenda-card-mobile ${item.type === 'habit' ? 'item-habit' : ''} ${item.completed ? 'completed' : ''}">
      <div class="agenda-left" onclick="toggleAgendaItem('${item.id}')">
        <span class="custom-checkbox">${item.completed ? '✓' : ''}</span>
        <div class="agenda-item-info">
          <div class="agenda-item-top">
            <span class="agenda-time-tag">🕒 ${item.time}</span>
            ${item.type === 'habit' ? `<span class="habit-link-badge">🔥 Hábito (+Streak)</span>` : ''}
          </div>
          <span class="item-title">${escapeHtml(item.title)}</span>
        </div>
      </div>
      <button class="icon-btn" onclick="removeAgendaItem('${item.id}')" title="Remover">✕</button>
    </div>
  `).join('');
}

function renderHomeHours() {
  const container = document.getElementById('timelineContainer');
  const currentHourNum = new Date().getHours();

  const periods = [
    { id: 'morning', label: '☀️ Manhã (06:00 – 11:00)', min: 6, max: 11 },
    { id: 'afternoon', label: '🌤️ Tarde (12:00 – 17:00)', min: 12, max: 17 },
    { id: 'night', label: '🌙 Noite (18:00 – 23:00)', min: 18, max: 23 }
  ];

  let html = '';

  periods.forEach(period => {
    if (state.hoursPeriod !== 'all' && state.hoursPeriod !== period.id) return;

    html += `<div class="period-divider">${period.label}</div>`;

    for (let h = period.min; h <= period.max; h++) {
      const timeStr = `${String(h).padStart(2, '0')}:00`;
      const slotItems = state.agenda.filter(a => a.time === timeStr);
      const isNow = h === currentHourNum;

      const itemsHtml = slotItems.length === 0
        ? `<button type="button" class="slot-empty-btn" onclick="openScheduleModal('${timeStr}')">Horário livre — toque para agendar</button>`
        : slotItems.map(item => `
            <div class="slot-mini-item ${item.type === 'habit' ? 'item-habit' : ''} ${item.completed ? 'completed' : ''}" onclick="toggleAgendaItem('${item.id}')">
              <span>${item.completed ? '✓ ' : '○ '}${escapeHtml(item.title)}</span>
              ${item.type === 'habit' ? `<span class="habit-link-badge">🔥</span>` : ''}
            </div>
          `).join('');

      html += `
        <div class="time-slot ${slotItems.length > 0 ? 'has-items' : ''} ${isNow ? 'current-hour' : ''}">
          <div class="slot-hour">
            <div>${timeStr}</div>
            ${isNow ? `<span class="now-pill">AGORA</span>` : ''}
          </div>
          <div class="slot-items">${itemsHtml}</div>
          <button type="button" class="slot-add-btn" onclick="openScheduleModal('${timeStr}')" title="Adicionar às ${timeStr}">+</button>
        </div>
      `;
    }
  });

  container.innerHTML = html;
}

function renderScheduleHabitSelect() {
  const selectEl = document.getElementById('agendaHabitId');
  const startHabits = state.habits.filter(h => h.category === 'start');
  if (startHabits.length === 0) {
    selectEl.innerHTML = `<option value="">Nenhum hábito "Começar" cadastrado</option>`;
  } else {
    selectEl.innerHTML = startHabits.map(h => {
      const hint = h.suggestedTime ? ` (${h.suggestedTime})` : '';
      return `<option value="${h.id}">${escapeHtml(h.name)}${hint}</option>`;
    }).join('');
  }
}

function renderAll() {
  syncAgendaWithHabits();
  updateStatusBarClock();
  document.getElementById('currentDateDisplay').textContent = formatShortHeaderDate(new Date());
  renderHomeStart();
  renderHomeStop();
  renderHomeAgenda();
  renderHomeHours();
  renderScheduleHabitSelect();
}

// ==========================================
// BOTTOM SHEETS (MODAIS MOBILE)
// ==========================================

function populateTimeSelects() {
  const agendaTimeEl = document.getElementById('agendaTime');
  const habitTimeEl = document.getElementById('habitTime');

  agendaTimeEl.innerHTML = HOURS_RANGE.map(t => `<option value="${t}">${t}</option>`).join('');
  habitTimeEl.innerHTML = `<option value="">Sem horário fixo</option>` +
    HOURS_RANGE.map(t => `<option value="${t}">${t}</option>`).join('');
}

function toLocalDatetimeInputValue(ts = Date.now()) {
  const d = new Date(Number(ts));
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateHabitModalFields() {
  const cat = document.querySelector('input[name="habitCategory"]:checked')?.value || 'start';
  document.getElementById('quitStartDateField').style.display = cat === 'stop' ? 'flex' : 'none';
  document.getElementById('autoScheduleField').style.display = cat === 'start' ? 'flex' : 'none';
}

function openNewHabitModal(defaultCategory = 'start') {
  document.getElementById('modalTitle').textContent = defaultCategory === 'stop'
    ? 'Novo Hábito para Deixar'
    : 'Novo Hábito para Começar';
  document.getElementById('habitId').value = '';
  document.getElementById('habitName').value = '';
  document.querySelector(`input[name="habitCategory"][value="${defaultCategory}"]`).checked = true;
  document.getElementById('habitTime').value = defaultCategory === 'start' ? '08:00' : '';
  document.getElementById('habitQuitDate').value = toLocalDatetimeInputValue(Date.now());
  document.getElementById('habitAutoSchedule').checked = true;

  updateHabitModalFields();
  document.getElementById('habitModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('habitName').focus(), 80);
}

function openEditHabitModal(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;

  document.getElementById('modalTitle').textContent = 'Editar Hábito';
  document.getElementById('habitId').value = habit.id;
  document.getElementById('habitName').value = habit.name;
  document.querySelector(`input[name="habitCategory"][value="${habit.category}"]`).checked = true;
  document.getElementById('habitTime').value = habit.suggestedTime || '';
  document.getElementById('habitQuitDate').value = toLocalDatetimeInputValue(
    habit.abstinenceStartTimestamp || Date.now()
  );
  document.getElementById('habitAutoSchedule').checked = false;

  updateHabitModalFields();
  document.getElementById('habitModal').classList.remove('hidden');
}

function closeHabitModal() {
  document.getElementById('habitModal').classList.add('hidden');
}

function openScheduleModal(prefillTime = null) {
  const currentH = Math.min(23, Math.max(6, new Date().getHours()));
  const defaultTime = prefillTime || `${String(currentH).padStart(2, '0')}:00`;

  document.getElementById('agendaTime').value = defaultTime;
  document.querySelector('input[name="agendaItemType"][value="task"]').checked = true;
  document.getElementById('taskTitleGroup').classList.remove('hidden');
  document.getElementById('habitSelectGroup').classList.add('hidden');
  document.getElementById('agendaTaskTitle').value = '';

  document.getElementById('scheduleModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('agendaTaskTitle').focus(), 80);
}

function closeScheduleModal() {
  document.getElementById('scheduleModal').classList.add('hidden');
}

function quickScheduleHabit(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit || !habit.suggestedTime) return;
  addAgendaItem({
    time: habit.suggestedTime,
    type: 'habit',
    habitId: habit.id,
    title: habit.name
  });
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s ease';
    setTimeout(() => toast.remove(), 220);
  }, 2600);
}

// ==========================================
// INICIALIZAÇÃO E EVENTOS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  populateTimeSelects();
  loadState();
  renderAll();

  // Registrar Service Worker para PWA Mobile
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Navegação Inferior (4 Homes)
  document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.target));
  });

  // Botão "+" Flutuante (FAB) e Topo: adapta-se à Home ativa!
  const handleContextualAdd = () => {
    if (state.activeScreen === 'start') {
      openNewHabitModal('start');
    } else if (state.activeScreen === 'stop') {
      openNewHabitModal('stop');
    } else {
      openScheduleModal();
    }
  };
  document.getElementById('fabMainAction').addEventListener('click', handleContextualAdd);
  document.getElementById('btnQuickActionTop').addEventListener('click', handleContextualAdd);

  // Botões da barra superior Desktop (Alternar Moldura / Restaurar Demo)
  document.getElementById('btnToggleFrame').addEventListener('click', () => {
    document.getElementById('phoneFrame').classList.toggle('expanded-frame');
  });

  document.getElementById('btnResetDemo').addEventListener('click', () => {
    createDemoData();
    renderAll();
    showToast('Dados de demonstração restaurados!');
  });

  // Modal de Hábito
  document.getElementById('btnCloseHabitModal').addEventListener('click', closeHabitModal);
  document.getElementById('btnCancelHabitModal').addEventListener('click', closeHabitModal);
  document.querySelectorAll('input[name="habitCategory"]').forEach(r => {
    r.addEventListener('change', updateHabitModalFields);
  });

  document.getElementById('habitForm').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('habitId').value;
    const name = document.getElementById('habitName').value.trim();
    const category = document.querySelector('input[name="habitCategory"]:checked').value;
    const suggestedTime = document.getElementById('habitTime').value;
    const quitVal = document.getElementById('habitQuitDate').value;
    const autoSchedule = document.getElementById('habitAutoSchedule').checked;

    if (!name) return;

    const parsedQuitTs = quitVal ? new Date(quitVal).getTime() : Date.now();
    const safeQuitTs = Math.min(Date.now(), isNaN(parsedQuitTs) ? Date.now() : parsedQuitTs);

    if (id) {
      const existing = state.habits.find(h => h.id === id);
      if (existing) {
        existing.name = name;
        existing.category = category;
        existing.suggestedTime = suggestedTime;
        if (category === 'stop') {
          existing.abstinenceStartTimestamp = safeQuitTs;
        }
      }
      showToast(`Hábito "${name}" atualizado!`);
    } else {
      const newHabit = {
        id: 'hab_' + Date.now(),
        name,
        category,
        suggestedTime,
        createdAt: Date.now()
      };

      if (category === 'stop') {
        newHabit.abstinenceStartTimestamp = safeQuitTs;
        newHabit.bestRecordDays = 0;
        newHabit.relapseCount = 0;
      } else {
        newHabit.completedDates = [];
        newHabit.bestStreak = 0;
      }

      state.habits.unshift(newHabit);

      if (category === 'start' && suggestedTime && autoSchedule) {
        state.agenda.push({
          id: 'ag_' + Date.now(),
          time: suggestedTime,
          type: 'habit',
          habitId: newHabit.id,
          title: newHabit.name,
          completed: false,
          dateKey: getTodayKey()
        });
      }

      showToast(`Hábito "${name}" criado!`);
      switchScreen(category === 'stop' ? 'stop' : 'start');
    }

    saveState();
    closeHabitModal();
    renderAll();
  });

  // Modal de Agendamento (Agenda & Horários)
  document.getElementById('btnCloseScheduleModal').addEventListener('click', closeScheduleModal);
  document.getElementById('btnCancelScheduleModal').addEventListener('click', closeScheduleModal);

  document.querySelectorAll('input[name="agendaItemType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isHabit = document.querySelector('input[name="agendaItemType"]:checked').value === 'habit';
      document.getElementById('taskTitleGroup').classList.toggle('hidden', isHabit);
      document.getElementById('habitSelectGroup').classList.toggle('hidden', !isHabit);
    });
  });

  document.getElementById('scheduleForm').addEventListener('submit', e => {
    e.preventDefault();
    const time = document.getElementById('agendaTime').value;
    const type = document.querySelector('input[name="agendaItemType"]:checked').value;
    const title = document.getElementById('agendaTaskTitle').value;
    const habitId = document.getElementById('agendaHabitId').value;

    const ok = addAgendaItem({ time, type, title, habitId });
    if (ok) closeScheduleModal();
  });

  // Modal de Recaída
  document.getElementById('btnCancelRelapse').addEventListener('click', () => {
    state.pendingRelapseHabitId = null;
    document.getElementById('relapseModal').classList.add('hidden');
  });
  document.getElementById('btnConfirmRelapse').addEventListener('click', confirmRelapseReset);

  // Filtros da Home 3 (Agenda)
  document.querySelectorAll('.agenda-filter-bar .filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.agenda-filter-bar .filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.agendaFilter = btn.dataset.agfilter;
      renderHomeAgenda();
    });
  });

  // Filtros de Período da Home 4 (Horários)
  document.querySelectorAll('.period-tabs .period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-tabs .period-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.hoursPeriod = btn.dataset.period;
      renderHomeHours();
    });
  });

  // Atualização automática a cada 20s (Relógio e Contadores de Abstinência)
  setInterval(() => {
    updateStatusBarClock();
    renderHomeStop();
  }, 20000);
});
