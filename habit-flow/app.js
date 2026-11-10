/**
 * HabitFlow Mobile — 4 Homes:
 * 1. Começar (Modo Constância)
 * 2. Deixar (Modo Abstinência)
 * 3. Agenda (Calendário Mensal & Semanal com visão da Semana/Mês)
 * 4. Horários (Time-blocking hora a hora 06:00 às 23:00 do dia selecionado)
 */

const STORAGE_KEYS = {
  HABITS: 'habitflow_habits_v2',
  AGENDA: 'habitflow_agenda_v2'
};

const MILESTONES = [7, 21, 30, 90];
const HOURS_RANGE = Array.from({ length: 18 }, (_, i) => {
  const hour = i + 6; // 06:00 às 23:00
  return `${String(hour).padStart(2, '0')}:00`;
});

const SCREEN_TITLES = {
  start: 'Hábitos para Começar',
  stop: 'Hábitos para Deixar',
  agenda: 'Calendário & Agenda',
  hours: 'Horários do Dia'
};

let state = {
  activeScreen: 'start', // 'start' | 'stop' | 'agenda' | 'hours'
  habits: [],
  agenda: [], // [{ id, dateKey, time, type: 'task' | 'habit', title, habitId, completed }]
  calendarMode: 'month', // 'month' | 'week'
  selectedDateKey: '', // YYYY-MM-DD
  calendarCursorDate: new Date(), // Date object for month/week navigation
  hoursPeriod: 'all', // 'all' | 'morning' | 'afternoon' | 'night'
  pendingRelapseHabitId: null
};

// ==========================================
// UTILITÁRIOS DE DATA E CALENDÁRIO
// ==========================================

function getDateKey(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return getDateKey(new Date());
}

function parseDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function shiftDateKey(dateKey, deltaDays) {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + deltaDays);
  return getDateKey(d);
}

function getYesterdayKey() {
  return shiftDateKey(getTodayKey(), -1);
}

function formatShortHeaderDate(dateObj = new Date()) {
  return dateObj.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).replace('.', '');
}

function formatDayFullLabel(dateKey) {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

function getRelativeDayTag(dateKey) {
  const today = getTodayKey();
  if (dateKey === today) return 'HOJE';
  if (dateKey === shiftDateKey(today, 1)) return 'AMANHÃ';
  if (dateKey === shiftDateKey(today, -1)) return 'ONTEM';
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    const key = getDateKey(cursor);
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
  const dMinus1 = shiftDateKey(today, -1);
  const dMinus2 = shiftDateKey(today, -2);
  const dMinus3 = shiftDateKey(today, -3);
  const dMinus4 = shiftDateKey(today, -4);
  const dMinus5 = shiftDateKey(today, -5);
  const dPlus1 = shiftDateKey(today, 1);
  const dPlus2 = shiftDateKey(today, 2);
  const dPlus4 = shiftDateKey(today, 4);

  state.habits = [
    {
      id: 'hab_start_1',
      name: 'Leitura Focada (20 páginas)',
      category: 'start',
      suggestedTime: '07:00',
      completedDates: [dMinus5, dMinus4, dMinus3, dMinus2, dMinus1, today],
      bestStreak: 6,
      createdAt: now - 10 * dayMs
    },
    {
      id: 'hab_start_2',
      name: 'Meditação Mindfulness (10 min)',
      category: 'start',
      suggestedTime: '08:00',
      completedDates: [dMinus2, dMinus1, today],
      bestStreak: 8,
      createdAt: now - 15 * dayMs
    },
    {
      id: 'hab_start_3',
      name: 'Treino de Força & Mobilidade',
      category: 'start',
      suggestedTime: '18:00',
      completedDates: [dMinus3, dMinus2, dMinus1],
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
    // Hoje
    {
      id: 'ag_1',
      dateKey: today,
      time: '07:00',
      type: 'habit',
      habitId: 'hab_start_1',
      title: 'Leitura Focada (20 páginas)',
      completed: true
    },
    {
      id: 'ag_2',
      dateKey: today,
      time: '08:00',
      type: 'habit',
      habitId: 'hab_start_2',
      title: 'Meditação Mindfulness (10 min)',
      completed: true
    },
    {
      id: 'ag_3',
      dateKey: today,
      time: '10:00',
      type: 'task',
      habitId: null,
      title: 'Reunião de alinhamento semanal',
      completed: false
    },
    {
      id: 'ag_4',
      dateKey: today,
      time: '15:00',
      type: 'task',
      habitId: null,
      title: 'Revisar metas e organizar entregas',
      completed: false
    },
    {
      id: 'ag_5',
      dateKey: today,
      time: '18:00',
      type: 'habit',
      habitId: 'hab_start_3',
      title: 'Treino de Força & Mobilidade',
      completed: false
    },
    // Amanhã
    {
      id: 'ag_6',
      dateKey: dPlus1,
      time: '09:00',
      type: 'task',
      habitId: null,
      title: 'Consulta médica / Check-up',
      completed: false
    },
    {
      id: 'ag_7',
      dateKey: dPlus1,
      time: '18:00',
      type: 'habit',
      habitId: 'hab_start_3',
      title: 'Treino de Força & Mobilidade',
      completed: false
    },
    // Daqui a 2 dias
    {
      id: 'ag_8',
      dateKey: dPlus2,
      time: '14:00',
      type: 'task',
      habitId: null,
      title: 'Apresentação de resultados do mês',
      completed: false
    },
    // Daqui a 4 dias
    {
      id: 'ag_9',
      dateKey: dPlus4,
      time: '11:00',
      type: 'task',
      habitId: null,
      title: 'Planejamento financeiro mensal',
      completed: false
    }
  ];

  saveState();
}

function loadState() {
  state.selectedDateKey = getTodayKey();
  state.calendarCursorDate = new Date();

  try {
    const rawHabits = localStorage.getItem(STORAGE_KEYS.HABITS);
    const rawAgenda = localStorage.getItem(STORAGE_KEYS.AGENDA);
    if (!rawHabits && !rawAgenda) {
      createDemoData();
      return;
    }
    state.habits = rawHabits ? JSON.parse(rawHabits) : [];
    state.agenda = rawAgenda ? JSON.parse(rawAgenda) : [];
    // Garantir que todo item da agenda tenha dateKey
    const today = getTodayKey();
    state.agenda.forEach(item => {
      if (!item.dateKey) item.dateKey = today;
    });
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
  state.agenda.forEach(item => {
    if (item.type === 'habit' && item.habitId) {
      const habit = state.habits.find(h => h.id === item.habitId);
      if (habit && habit.category === 'start') {
        item.title = habit.name;
        const targetDate = item.dateKey || getTodayKey();
        item.completed = Array.isArray(habit.completedDates) && habit.completedDates.includes(targetDate);
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
  renderAll();
}

function selectCalendarDate(dateKey) {
  state.selectedDateKey = dateKey;
  state.calendarCursorDate = parseDateKey(dateKey);
  renderAll();
}

// ==========================================
// AÇÕES DE HÁBITOS E AGENDA
// ==========================================

function toggleStartHabitOnDate(habitId, dateKey = getTodayKey()) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit || habit.category !== 'start') return;

  if (!Array.isArray(habit.completedDates)) {
    habit.completedDates = [];
  }

  const idx = habit.completedDates.indexOf(dateKey);
  let nowChecked = false;

  if (idx === -1) {
    habit.completedDates.push(dateKey);
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
    if (item.type === 'habit' && item.habitId === habitId && item.dateKey === dateKey) {
      item.completed = nowChecked;
    }
  });

  saveState();
  renderAll();

  showToast(nowChecked
    ? `🔥 Hábito concluído: "${habit.name}"!`
    : `Check-in desfeito em "${habit.name}".`
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
    Ao confirmar, o contador voltará para <strong>0d 0h</strong> e seu recorde de <strong>${currentRecord} dias</strong> ficará salvo.
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

function addAgendaItem({ dateKey, time, type, title, habitId }) {
  const targetDate = dateKey || state.selectedDateKey || getTodayKey();

  if (type === 'habit') {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) {
      showToast('Selecione um hábito válido.');
      return false;
    }

    const exists = state.agenda.some(
      a => a.dateKey === targetDate && a.time === time && a.type === 'habit' && a.habitId === habit.id
    );
    if (exists) {
      showToast(`"${habit.name}" já está agendado às ${time} nesta data.`);
      return false;
    }

    const isDone = Array.isArray(habit.completedDates) && habit.completedDates.includes(targetDate);
    state.agenda.push({
      id: 'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      dateKey: targetDate,
      time,
      type: 'habit',
      habitId: habit.id,
      title: habit.name,
      completed: isDone
    });

    state.selectedDateKey = targetDate;
    saveState();
    renderAll();
    showToast(`Hábito "${habit.name}" agendado às ${time}!`);
    return true;
  } else {
    const clean = (title || '').trim();
    if (!clean) {
      showToast('Digite a descrição do compromisso.');
      return false;
    }

    state.agenda.push({
      id: 'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      dateKey: targetDate,
      time,
      type: 'task',
      habitId: null,
      title: clean,
      completed: false
    });

    state.selectedDateKey = targetDate;
    saveState();
    renderAll();
    showToast(`Compromisso agendado para ${time}!`);
    return true;
  }
}

function toggleAgendaItem(itemId) {
  const item = state.agenda.find(a => a.id === itemId);
  if (!item) return;

  if (item.type === 'habit' && item.habitId) {
    toggleStartHabitOnDate(item.habitId, item.dateKey || getTodayKey());
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

// HOME 1: COMEÇAR HÁBITO
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
    listEl.innerHTML = `<div class="empty-state">Nenhum hábito em construção.<br>Toque em <strong>+ Hábito</strong> para começar!</div>`;
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
              <button class="icon-btn" type="button" onclick="quickScheduleHabit('${habit.id}')" title="Agendar hoje às ${habit.suggestedTime}">📅</button>
            ` : ''}
            <button class="icon-btn" type="button" onclick="openEditHabitModal('${habit.id}')" title="Editar">✎</button>
            <button class="icon-btn" type="button" onclick="deleteHabit('${habit.id}')" title="Excluir">🗑</button>
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

          <button type="button" class="btn-checkin-mobile ${isCheckedToday ? 'checked-today' : ''}" onclick="toggleStartHabitOnDate('${habit.id}')">
            ${isCheckedToday ? '✓ Feito Hoje' : 'Check-in'}
          </button>
        </div>

        ${buildMilestoneHtml(currentStreak)}
      </article>
    `;
  }).join('');
}

// HOME 2: DEIXAR HÁBITO
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
    listEl.innerHTML = `<div class="empty-state">Nenhum hábito em modo abstinência.<br>Toque em <strong>+ Parar Hábito</strong> para iniciar!</div>`;
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
            <button class="icon-btn" type="button" onclick="openEditHabitModal('${habit.id}')" title="Editar">✎</button>
            <button class="icon-btn" type="button" onclick="deleteHabit('${habit.id}')" title="Excluir">🗑</button>
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

          <button type="button" class="btn-relapse-mobile" onclick="openRelapseModal('${habit.id}')">
            ↺ Recaída
          </button>
        </div>

        ${buildMilestoneHtml(days)}
      </article>
    `;
  }).join('');
}

// HOME 3: AGENDA (CALENDÁRIO MENSAL & SEMANAL)
function renderHomeAgenda() {
  const todayKey = getTodayKey();
  const cursor = state.calendarCursorDate;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Badge na barra inferior mostra compromissos pendentes de hoje
  const pendingToday = state.agenda.filter(a => a.dateKey === todayKey && !a.completed).length;
  document.getElementById('navBadgeAgenda').textContent = pendingToday;

  // Título do Mês/Ano no topo do calendário
  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  document.getElementById('calendarTitleLabel').textContent = monthLabel;

  // Construir células do Calendário (Mês completo ou Semana de 7 dias)
  const gridEl = document.getElementById('calendarGrid');
  let cells = [];

  if (state.calendarMode === 'month') {
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 (Dom) a 6 (Sáb)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      cells.push({ dateObj: d, dateKey: getDateKey(d), otherMonth: true });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({ dateObj: d, dateKey: getDateKey(d), otherMonth: false });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ dateObj: d, dateKey: getDateKey(d), otherMonth: true });
    }
  } else {
    // Modo Semana: domingo a sábado da semana do cursor
    const startOfWeek = new Date(cursor);
    startOfWeek.setDate(cursor.getDate() - cursor.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      cells.push({ dateObj: d, dateKey: getDateKey(d), otherMonth: d.getMonth() !== month });
    }
  }

  gridEl.innerHTML = cells.map(cell => {
    const isToday = cell.dateKey === todayKey;
    const isSelected = cell.dateKey === state.selectedDateKey;
    const dayItems = state.agenda.filter(a => a.dateKey === cell.dateKey);

    const hasTask = dayItems.some(i => i.type === 'task' && !i.completed);
    const hasHabit = dayItems.some(i => i.type === 'habit' && !i.completed);
    const hasDone = dayItems.some(i => i.completed) || state.habits.some(
      h => h.category === 'start' && Array.isArray(h.completedDates) && h.completedDates.includes(cell.dateKey)
    );

    return `
      <button
        type="button"
        class="cal-day ${cell.otherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}"
        onclick="selectCalendarDate('${cell.dateKey}')"
      >
        <span class="cal-day-num">${cell.dateObj.getDate()}</span>
        <div class="cal-dots">
          ${hasTask ? '<i class="dot dot-task"></i>' : ''}
          ${hasHabit ? '<i class="dot dot-habit"></i>' : ''}
          ${hasDone ? '<i class="dot dot-done"></i>' : ''}
        </div>
      </button>
    `;
  }).join('');

  // Atualizar Banner do Dia Selecionado
  document.getElementById('selectedDayRelativeTag').textContent = getRelativeDayTag(state.selectedDateKey);
  document.getElementById('selectedDayTitle').textContent = formatDayFullLabel(state.selectedDateKey);

  // Listar compromissos do Dia Selecionado
  const dayItems = state.agenda
    .filter(a => a.dateKey === state.selectedDateKey)
    .sort((a, b) => a.time.localeCompare(b.time));

  const dayListEl = document.getElementById('agendaDayItemsList');
  if (dayItems.length === 0) {
    dayListEl.innerHTML = `<div class="empty-state">Nenhum compromisso agendado para esta data.<br>Toque em <strong>+ Agendar</strong> para incluir!</div>`;
  } else {
    dayListEl.innerHTML = dayItems.map(item => `
      <div class="agenda-card-mobile ${item.type === 'habit' ? 'item-habit' : ''} ${item.completed ? 'completed' : ''}">
        <div class="agenda-left" onclick="toggleAgendaItem('${item.id}')">
          <span class="custom-checkbox">${item.completed ? '✓' : ''}</span>
          <div class="agenda-item-info">
            <div class="agenda-item-top">
              <span class="agenda-time-tag">🕒 ${item.time}</span>
              ${item.type === 'habit' ? `<span class="habit-link-badge">🔥 Hábito</span>` : `<span class="sub-badge">Compromisso</span>`}
            </div>
            <span class="item-title">${escapeHtml(item.title)}</span>
          </div>
        </div>
        <button class="icon-btn" type="button" onclick="removeAgendaItem('${item.id}')" title="Remover">✕</button>
      </div>
    `).join('');
  }

  // Renderizar Resumo da Semana (Dom a Sáb da semana selecionada)
  const selDate = parseDateKey(state.selectedDateKey);
  const weekStart = new Date(selDate);
  weekStart.setDate(selDate.getDate() - selDate.getDay());

  let weekRowsHtml = '';
  for (let i = 0; i < 7; i++) {
    const wd = new Date(weekStart);
    wd.setDate(weekStart.getDate() + i);
    const wKey = getDateKey(wd);
    const wItems = state.agenda
      .filter(a => a.dateKey === wKey)
      .sort((a, b) => a.time.localeCompare(b.time));

    const shortWeekday = wd.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const dayNum = String(wd.getDate()).padStart(2, '0');
    const summaryText = wItems.length === 0
      ? 'Dia livre — sem compromissos'
      : wItems.map(x => `${x.time} ${x.title}`).join(' • ');

    weekRowsHtml += `
      <div class="week-day-row ${wKey === state.selectedDateKey ? 'active-week-day' : ''}" onclick="selectCalendarDate('${wKey}')">
        <div class="week-day-left">
          <div class="week-day-badge">
            <span>${shortWeekday}</span>
            <strong>${dayNum}</strong>
          </div>
          <div class="week-day-details">
            <h4>${wItems.length} ${wItems.length === 1 ? 'compromisso' : 'compromissos'}</h4>
            <p>${escapeHtml(summaryText)}</p>
          </div>
        </div>
        <span class="time-badge">${wKey === todayKey ? 'Hoje' : 'Ver'}</span>
      </div>
    `;
  }
  document.getElementById('weekSummaryContainer').innerHTML = weekRowsHtml;
}

// HOME 4: HORÁRIOS DO DIA (Time-blocking 06:00 às 23:00)
function renderHomeHours() {
  const container = document.getElementById('timelineContainer');
  const todayKey = getTodayKey();
  const isTodaySelected = state.selectedDateKey === todayKey;
  const currentHourNum = new Date().getHours();

  const selDateObj = parseDateKey(state.selectedDateKey);
  document.getElementById('hoursDayBadge').textContent = getRelativeDayTag(state.selectedDateKey);
  document.getElementById('hoursDayLabel').textContent = selDateObj.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });

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
      const slotItems = state.agenda.filter(
        a => a.dateKey === state.selectedDateKey && a.time === timeStr
      );
      const isNow = isTodaySelected && h === currentHourNum;

      const itemsHtml = slotItems.length === 0
        ? `<button type="button" class="slot-empty-btn" onclick="openScheduleModal('${timeStr}', '${state.selectedDateKey}')">Livre — tocar p/ agendar</button>`
        : slotItems.map(item => `
            <div class="slot-mini-item ${item.type === 'habit' ? 'item-habit' : ''} ${item.completed ? 'completed' : ''}">
              <div class="slot-mini-left" onclick="toggleAgendaItem('${item.id}')">
                <span>${item.completed ? '✓' : '○'}</span>
                <span class="slot-mini-title">${escapeHtml(item.title)}</span>
              </div>
              <button class="icon-btn" type="button" style="width:20px;height:20px;font-size:0.7rem;" onclick="removeAgendaItem('${item.id}')" title="Remover">✕</button>
            </div>
          `).join('');

      html += `
        <div class="time-slot ${slotItems.length > 0 ? 'has-items' : ''} ${isNow ? 'current-hour' : ''}">
          <div class="slot-hour">
            <div>${timeStr}</div>
            ${isNow ? `<span class="now-pill">AGORA</span>` : ''}
          </div>
          <div class="slot-items">${itemsHtml}</div>
          <button type="button" class="slot-add-btn" onclick="openScheduleModal('${timeStr}', '${state.selectedDateKey}')" title="Agendar às ${timeStr}">+</button>
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
  document.getElementById('currentDateDisplay').textContent = `📅 ${formatShortHeaderDate(new Date())}`;
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

function openScheduleModal(prefillTime = null, prefillDateKey = null) {
  const currentH = Math.min(23, Math.max(6, new Date().getHours()));
  const defaultTime = prefillTime || `${String(currentH).padStart(2, '0')}:00`;
  const defaultDate = prefillDateKey || state.selectedDateKey || getTodayKey();

  document.getElementById('agendaDateInput').value = defaultDate;
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
    dateKey: getTodayKey(),
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

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Navegação Inferior (4 Homes)
  document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.target));
  });

  // Botão "+ Novo" sempre visível no Header Superior (adapta-se à aba ativa)
  document.getElementById('btnQuickActionTop').addEventListener('click', () => {
    if (state.activeScreen === 'start') {
      openNewHabitModal('start');
    } else if (state.activeScreen === 'stop') {
      openNewHabitModal('stop');
    } else {
      openScheduleModal(null, state.selectedDateKey);
    }
  });

  // Botões Desktop Preview
  document.getElementById('btnToggleFrame').addEventListener('click', () => {
    document.getElementById('phoneFrame').classList.toggle('expanded-frame');
  });

  document.getElementById('btnResetDemo').addEventListener('click', () => {
    createDemoData();
    renderAll();
    showToast('Dados de demonstração restaurados!');
  });

  // Controles do Calendário na aba Agenda
  document.querySelectorAll('.cal-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cal-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.calendarMode = btn.dataset.calmode;
      renderHomeAgenda();
    });
  });

  document.getElementById('btnCalPrev').addEventListener('click', () => {
    const d = new Date(state.calendarCursorDate);
    if (state.calendarMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    state.calendarCursorDate = d;
    renderHomeAgenda();
  });

  document.getElementById('btnCalNext').addEventListener('click', () => {
    const d = new Date(state.calendarCursorDate);
    if (state.calendarMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    state.calendarCursorDate = d;
    renderHomeAgenda();
  });

  document.getElementById('btnCalToday').addEventListener('click', () => {
    state.selectedDateKey = getTodayKey();
    state.calendarCursorDate = new Date();
    renderAll();
  });

  // Controles de Data na aba Horários
  document.getElementById('btnHoursPrevDay').addEventListener('click', () => {
    selectCalendarDate(shiftDateKey(state.selectedDateKey, -1));
  });
  document.getElementById('btnHoursNextDay').addEventListener('click', () => {
    selectCalendarDate(shiftDateKey(state.selectedDateKey, 1));
  });
  document.getElementById('btnHoursToday').addEventListener('click', () => {
    selectCalendarDate(getTodayKey());
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
          dateKey: getTodayKey(),
          time: suggestedTime,
          type: 'habit',
          habitId: newHabit.id,
          title: newHabit.name,
          completed: false
        });
      }

      showToast(`Hábito "${name}" criado!`);
      switchScreen(category === 'stop' ? 'stop' : 'start');
    }

    saveState();
    closeHabitModal();
    renderAll();
  });

  // Modal de Agendamento
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
    const dateKey = document.getElementById('agendaDateInput').value || state.selectedDateKey;
    const time = document.getElementById('agendaTime').value;
    const type = document.querySelector('input[name="agendaItemType"]:checked').value;
    const title = document.getElementById('agendaTaskTitle').value;
    const habitId = document.getElementById('agendaHabitId').value;

    const ok = addAgendaItem({ dateKey, time, type, title, habitId });
    if (ok) closeScheduleModal();
  });

  // Modal de Recaída
  document.getElementById('btnCancelRelapse').addEventListener('click', () => {
    state.pendingRelapseHabitId = null;
    document.getElementById('relapseModal').classList.add('hidden');
  });
  document.getElementById('btnConfirmRelapse').addEventListener('click', confirmRelapseReset);

  // Filtros de Período da Home 4 (Horários)
  document.querySelectorAll('.period-tabs .period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-tabs .period-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.hoursPeriod = btn.dataset.period;
      renderHomeHours();
    });
  });

  // Atualização em tempo real
  setInterval(() => {
    updateStatusBarClock();
    renderHomeStop();
  }, 20000);
});
