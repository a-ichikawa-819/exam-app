const DATA_URL = "data/questions.csv";
const SETS_KEY = "csv-exam-question-sets-v2";
const ATTEMPTS_KEY = "csv-exam-attempts-v2";
const ACTIVE_KEY = "csv-exam-active-set-v2";
const EXPORT_REMINDER_KEY = "csv-exam-export-reminder-v1";
const PAUSED_EXAM_KEY = "csv-exam-paused-v1";

const state = {
  sets: [],
  attempts: [],
  activeSetId: "",
  activeEditQuestionId: "",
  editingExamQuestionId: "",
  needsExportReminder: false,
  pausedExam: null,
  view: "dashboard",
  exam: null,
};

const $ = (selector) => document.querySelector(selector);

const appTitle = $("#appTitle");
const dashboardButton = $("#dashboardButton");
const dashboardView = $("#dashboardView");
const examView = $("#examView");
const editorView = $("#editorView");
const historyView = $("#historyView");
const setCount = $("#setCount");
const questionTotal = $("#questionTotal");
const averageScore = $("#averageScore");
const setSelect = $("#setSelect");
const activeSetMeta = $("#activeSetMeta");
const setNameInput = $("#setNameInput");
const renameSetButton = $("#renameSetButton");
const createSetButton = $("#createSetButton");
const examModeSelect = $("#examModeSelect");
const flagOnlyOption = $("#flagOnlyOption");
const shuffleChoicesOption = $("#shuffleChoicesOption");
const shuffleQuestionsOption = $("#shuffleQuestionsOption");
const startExamButton = $("#startExamButton");
const openEditButton = $("#openEditButton");
const openHistoryButton = $("#openHistoryButton");
const exportDataButton = $("#exportDataButton");
const importDataButton = $("#importDataButton");
const importDataInput = $("#importDataInput");
const questionCounter = $("#questionCounter");
const answeredCounter = $("#answeredCounter");
const progressFill = $("#progressFill");
const questionNav = $("#questionNav");
const examCard = $("#examCard");
const prevButton = $("#prevButton");
const nextButton = $("#nextButton");
const gradeButton = $("#gradeButton");
const pauseButton = $("#pauseButton");
const summaryPanel = $("#summaryPanel");
const resultTitle = $("#resultTitle");
const resultDetail = $("#resultDetail");
const reviewButton = $("#reviewButton");
const finishButton = $("#finishButton");
const editorList = $("#editorList");
const editorForm = $("#editorForm");
const addQuestionButton = $("#addQuestionButton");
const editQuestionText = $("#editQuestionText");
const choiceEditor = $("#choiceEditor");
const editExplanation = $("#editExplanation");
const deleteQuestionButton = $("#deleteQuestionButton");
const historyList = $("#historyList");
const clearHistoryButton = $("#clearHistoryButton");

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, ""));
  return rows
    .filter((cells) => cells.some(Boolean))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function groupQuestions(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.question_id)) {
      map.set(row.question_id, {
        id: row.question_id,
        text: row.question_text,
        explanation: "",
        flag: "none",
        choices: [],
      });
    }

    const question = map.get(row.question_id);
    const isCorrect = row.is_correct.toLowerCase() === "true";
    if (isCorrect && row.explanation) {
      question.explanation = row.explanation;
    }

    question.choices.push({
      id: row.choice_id,
      text: row.choice_text,
      isCorrect,
    });
  });
  return Array.from(map.values());
}

function activeSet() {
  return state.sets.find((set) => set.id === state.activeSetId) || state.sets[0];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function shuffleItems(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeQuestionFlags() {
  state.sets.forEach((set) => {
    set.questions.forEach((question) => {
      if (!["none", "circle", "triangle", "cross"].includes(question.flag)) {
        question.flag = "none";
      }
    });
  });
}

function saveSets() {
  localStorage.setItem(SETS_KEY, JSON.stringify(state.sets));
  localStorage.setItem(ACTIVE_KEY, state.activeSetId);
}

function saveAttempts() {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state.attempts));
}

function saveExportReminder() {
  localStorage.setItem(EXPORT_REMINDER_KEY, state.needsExportReminder ? "true" : "false");
}

function savePausedExam() {
  if (state.pausedExam) {
    localStorage.setItem(PAUSED_EXAM_KEY, JSON.stringify(state.pausedExam));
  } else {
    localStorage.removeItem(PAUSED_EXAM_KEY);
  }
}

function loadLocalState() {
  try {
    state.sets = JSON.parse(localStorage.getItem(SETS_KEY)) || [];
    state.attempts = JSON.parse(localStorage.getItem(ATTEMPTS_KEY)) || [];
    state.activeSetId = localStorage.getItem(ACTIVE_KEY) || "";
    state.needsExportReminder = localStorage.getItem(EXPORT_REMINDER_KEY) === "true";
    state.pausedExam = JSON.parse(localStorage.getItem(PAUSED_EXAM_KEY)) || null;
  } catch {
    state.sets = [];
    state.attempts = [];
    state.activeSetId = "";
    state.needsExportReminder = false;
    state.pausedExam = null;
  }
}

function createDefaultSet(questions) {
  return {
    id: "ai-basic",
    title: "サンプル問題",
    description: "公開用のサンプル問題集",
    questions,
    updatedAt: new Date().toISOString(),
  };
}

function createEmptyQuestionSet(title) {
  const now = Date.now();
  return {
    id: `set-${now}`,
    title,
    description: "ユーザ作成の問題集",
    questions: [],
    updatedAt: new Date().toISOString(),
  };
}

function showView(view) {
  state.view = view;
  dashboardView.classList.toggle("hidden", view !== "dashboard");
  examView.classList.toggle("hidden", view !== "exam");
  editorView.classList.toggle("hidden", view !== "editor");
  historyView.classList.toggle("hidden", view !== "history");
  dashboardButton.classList.toggle("hidden", view === "dashboard");
  render();
}

function answeredCount() {
  if (!state.exam) return 0;
  return state.exam.questions.filter((question) => state.exam.answers[question.id]).length;
}

function isQuestionGraded(questionId) {
  return Boolean(state.exam?.gradedQuestions[questionId] || state.exam?.finished);
}

function selectedChoice(question) {
  const selectedId = state.exam.answers[question.id];
  return question.choices.find((choice) => choice.id === selectedId);
}

function scoreForExam() {
  if (!state.exam) return 0;
  return state.exam.questions.filter((question) => selectedChoice(question)?.isCorrect).length;
}

function startExam() {
  if (examModeSelect.value === "resume") {
    resumePausedExam();
    return;
  }

  const set = activeSet();
  if (!set?.questions.length) return;
  const options = {
    flagOnly: flagOnlyOption.checked,
    shuffleChoices: shuffleChoicesOption.checked,
    shuffleQuestions: shuffleQuestionsOption.checked,
  };
  let questions = clone(set.questions);

  if (options.flagOnly) {
    questions = questions.filter((question) => ["triangle", "cross"].includes(question.flag));
  }
  if (!questions.length) return;
  if (options.shuffleQuestions) {
    questions = shuffleItems(questions);
  }
  if (options.shuffleChoices) {
    questions = questions.map((question) => ({
      ...question,
      choices: shuffleItems(question.choices),
    }));
  }

  state.exam = {
    setId: set.id,
    setTitle: set.title,
    mode: examModeSelect.value,
    options,
    questions,
    currentIndex: 0,
    answers: {},
    gradedQuestions: {},
    finished: false,
    startedAt: new Date().toISOString(),
  };
  showView("exam");
}

function resumePausedExam() {
  if (!state.pausedExam?.exam) return;
  state.exam = clone(state.pausedExam.exam);
  state.needsExportReminder = Boolean(state.pausedExam.needsExportReminder);
  state.editingExamQuestionId = "";
  showView("exam");
}

function renderDashboard() {
  const set = activeSet();
  appTitle.textContent = "試験アプリ";
  setCount.textContent = state.sets.length;
  questionTotal.textContent = state.sets.reduce((sum, item) => sum + item.questions.length, 0);
  const scores = state.attempts.map((attempt) => attempt.percent);
  averageScore.textContent = scores.length
    ? `${Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length)}%`
    : "-";

  setSelect.innerHTML = state.sets
    .map(
      (item) => `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.title)} (${item.questions.length} 問)</option>`,
    )
    .join("");
  setSelect.value = state.activeSetId;
  setNameInput.value = set?.title || "";
  activeSetMeta.textContent = set
    ? `${set.description} / ${set.questions.length} 問 / 更新: ${formatDateTime(set.updatedAt)}`
    : "問題集がありません。";

  const filteredCount = set?.questions.filter((question) => ["triangle", "cross"].includes(question.flag)).length || 0;
  const isResumeMode = examModeSelect.value === "resume";
  startExamButton.disabled = isResumeMode
    ? !state.pausedExam?.exam
    : !set?.questions.length || (flagOnlyOption.checked && !filteredCount);
  startExamButton.textContent = isResumeMode
    ? state.pausedExam?.exam
      ? "再開"
      : "中断データなし"
    : flagOnlyOption.checked && !filteredCount
      ? "対象フラグなし"
      : "スタート";
  flagOnlyOption.disabled = isResumeMode;
  shuffleChoicesOption.disabled = isResumeMode;
  shuffleQuestionsOption.disabled = isResumeMode;
  openEditButton.disabled = !set;
  renameSetButton.disabled = !set;

  const existingReminder = dashboardView.querySelector(".export-reminder");
  if (existingReminder) existingReminder.remove();
  if (state.needsExportReminder) {
    dashboardView.insertAdjacentHTML(
      "afterbegin",
      '<div class="export-reminder">問題を編集しました。忘れずに JSONエクスポート してください。</div>',
    );
  }
}

function renderExam() {
  if (!state.exam) return;

  const total = state.exam.questions.length;
  const current = state.exam.questions[state.exam.currentIndex];
  const answered = answeredCount();
  const modeLabel = state.exam.mode === "instant" ? "都度採点" : "一括採点";
  appTitle.textContent = `${state.exam.setTitle} / ${modeLabel}`;
  questionCounter.textContent = `問題 ${state.exam.currentIndex + 1} / ${total}`;
  answeredCounter.textContent = `${answered} 問回答済み`;
  progressFill.style.width = `${(answered / total) * 100}%`;

  renderQuestion(current);
  renderQuestionNav();
  renderExamControls();
  renderSummary();
}

function renderQuestion(question) {
  if (state.editingExamQuestionId === question.id) {
    renderExamQuestionEditor(question);
    return;
  }

  const selectedId = state.exam.answers[question.id];
  const graded = isQuestionGraded(question.id);
  const choicesHtml = question.choices
    .map((choice, index) => {
      const selected = selectedId === choice.id;
      const resultClass = graded ? (choice.isCorrect ? " correct" : selected ? " incorrect" : "") : "";
      return `
        <button class="choice${selected ? " selected" : ""}${resultClass}" type="button" data-choice-id="${choice.id}">
          <span class="choice-marker">${index + 1}</span>
          <span>${escapeHtml(choice.text)}</span>
        </button>
      `;
    })
    .join("");

  const stateLabel = graded ? (selectedChoice(question)?.isCorrect ? "正解" : "不正解") : selectedId ? "回答済み" : "未回答";
  const flagHtml = `
    <div class="flag-controls" aria-label="問題フラグ">
      ${flagButtonHtml(question, "circle", "〇")}
      ${flagButtonHtml(question, "triangle", "△")}
      ${flagButtonHtml(question, "cross", "×")}
    </div>
  `;
  const explanationHtml = graded
    ? `<div class="explanation">${escapeHtml(question.explanation || "解説はありません。")}</div>`
    : "";

  examCard.innerHTML = `
    <div class="question-header">
      <span>${question.id.toUpperCase()}</span>
      <span>${stateLabel}</span>
    </div>
    <div class="question-tools">
      <button class="secondary-button compact" id="editExamQuestionButton" type="button">編集</button>
    </div>
    <div class="question-text">${escapeHtml(question.text)}</div>
    <div class="choices">${choicesHtml}</div>
    ${explanationHtml}
    ${flagHtml}
  `;

  examCard.querySelectorAll(".choice").forEach((button) => {
    button.addEventListener("click", () => {
      if (graded) return;
      state.exam.answers[question.id] = button.dataset.choiceId;
      render();
    });
  });

  examCard.querySelectorAll(".flag-button").forEach((button) => {
    button.addEventListener("click", () => {
      setQuestionFlag(question.id, button.dataset.flag);
    });
  });

  examCard.querySelector("#editExamQuestionButton").addEventListener("click", () => {
    state.editingExamQuestionId = question.id;
    render();
  });
}

function renderExamQuestionEditor(question) {
  const choicesHtml = question.choices
    .map(
      (choice, index) => `
        <label class="choice-edit-row">
          <input type="radio" name="examCorrectChoice" value="${choice.id}" ${choice.isCorrect ? "checked" : ""}>
          <span>${index + 1}</span>
          <input type="text" value="${escapeAttribute(choice.text)}" data-choice-id="${choice.id}">
        </label>
      `,
    )
    .join("");

  examCard.innerHTML = `
    <form class="exam-edit-form" id="examEditForm">
      <div class="question-header">
        <span>${question.id.toUpperCase()} / 編集中</span>
        <span>保存または破棄してください</span>
      </div>
      <label>
        問題文
        <textarea id="examEditQuestionText" rows="5">${escapeHtml(question.text)}</textarea>
      </label>
      <div class="choice-editor">${choicesHtml}</div>
      <label>
        解説
        <textarea id="examEditExplanation" rows="8">${escapeHtml(question.explanation || "")}</textarea>
      </label>
      <div class="summary-actions">
        <button class="primary-button" type="submit">保存</button>
        <button class="secondary-button" id="discardExamEditButton" type="button">破棄</button>
      </div>
    </form>
  `;

  examCard.querySelector("#examEditForm").addEventListener("submit", saveExamQuestionEdit);
  examCard.querySelector("#discardExamEditButton").addEventListener("click", () => {
    state.editingExamQuestionId = "";
    render();
  });
}

function saveExamQuestionEdit(event) {
  event.preventDefault();
  const question = state.exam.questions.find((item) => item.id === state.editingExamQuestionId);
  if (!question) return;

  const form = event.currentTarget;
  const text = form.querySelector("#examEditQuestionText").value.trim() || "未入力の問題";
  const explanation = form.querySelector("#examEditExplanation").value.trim();
  const correctId = form.elements.examCorrectChoice.value;

  question.text = text;
  question.explanation = explanation;
  form.querySelectorAll("input[type='text'][data-choice-id]").forEach((input) => {
    const choice = question.choices.find((item) => item.id === input.dataset.choiceId);
    if (choice) {
      choice.text = input.value.trim() || "未入力の選択肢";
      choice.isCorrect = choice.id === correctId;
    }
  });

  const set = state.sets.find((item) => item.id === state.exam.setId);
  const sourceQuestion = set?.questions.find((item) => item.id === question.id);
  if (sourceQuestion) {
    sourceQuestion.text = question.text;
    sourceQuestion.explanation = question.explanation;
    question.choices.forEach((choice) => {
      const sourceChoice = sourceQuestion.choices.find((item) => item.id === choice.id);
      if (sourceChoice) {
        sourceChoice.text = choice.text;
        sourceChoice.isCorrect = choice.isCorrect;
      }
    });
    set.updatedAt = new Date().toISOString();
    saveSets();
  }

  state.exam.hasEdits = true;
  state.needsExportReminder = true;
  saveExportReminder();
  state.editingExamQuestionId = "";
  render();
}

function flagButtonHtml(question, flag, label) {
  return `
    <button class="flag-button ${question.flag === flag ? "active" : ""}" type="button" data-flag="${flag}">
      ${label}フラグ
    </button>
  `;
}

function setQuestionFlag(questionId, flag) {
  const question = state.exam.questions.find((item) => item.id === questionId);
  if (!question) return;
  question.flag = question.flag === flag ? "none" : flag;

  const set = state.sets.find((item) => item.id === state.exam.setId);
  const sourceQuestion = set?.questions.find((item) => item.id === questionId);
  if (sourceQuestion) {
    sourceQuestion.flag = question.flag;
    set.updatedAt = new Date().toISOString();
    saveSets();
  }
  render();
}

function renderQuestionNav() {
  questionNav.innerHTML = state.exam.questions
    .map((question, index) => {
      const selected = selectedChoice(question);
      const graded = isQuestionGraded(question.id);
      const resultClass = graded && selected ? (selected.isCorrect ? " correct" : " incorrect") : "";
      const answeredClass = selected ? " answered" : "";
      const currentClass = index === state.exam.currentIndex ? " current" : "";
      return `<button class="question-jump${answeredClass}${resultClass}${currentClass}" type="button" data-index="${index}">${index + 1}</button>`;
    })
    .join("");

  questionNav.querySelectorAll(".question-jump").forEach((button) => {
    button.addEventListener("click", () => {
      state.exam.currentIndex = Number(button.dataset.index);
      render();
    });
  });
}

function renderExamControls() {
  const question = state.exam.questions[state.exam.currentIndex];
  const isLast = state.exam.currentIndex === state.exam.questions.length - 1;
  const graded = isQuestionGraded(question.id);
  const hasAnswer = Boolean(state.exam.answers[question.id]);

  prevButton.disabled = state.exam.currentIndex <= 0;
  nextButton.disabled = state.exam.currentIndex >= state.exam.questions.length - 1;
  pauseButton.disabled = state.exam.finished;

  if (state.exam.mode === "instant") {
    gradeButton.disabled = !hasAnswer || graded;
    gradeButton.textContent = graded ? (isLast ? "結果確認" : "採点済み") : "この問題を採点";
  } else {
    gradeButton.disabled = state.exam.finished;
    gradeButton.textContent = state.exam.finished ? "採点済み" : "まとめて採点";
  }
}

function renderSummary() {
  if (!state.exam?.finished) {
    summaryPanel.classList.add("hidden");
    return;
  }

  const total = state.exam.questions.length;
  const correct = scoreForExam();
  const percent = total ? Math.round((correct / total) * 100) : 0;
  resultTitle.textContent = `${percent}% 正解`;
  resultDetail.textContent = state.exam.hasEdits
    ? `${total} 問中 ${correct} 問正解です。問題を編集したため、終了後に JSONエクスポート してください。`
    : `${total} 問中 ${correct} 問正解です。結果を保存してダッシュボードに戻れます。`;
  summaryPanel.classList.remove("hidden");
}

function gradeCurrentOrExam() {
  if (!state.exam) return;
  if (state.exam.mode === "instant") {
    const question = state.exam.questions[state.exam.currentIndex];
    if (!state.exam.answers[question.id]) return;
    state.exam.gradedQuestions[question.id] = true;
    if (Object.keys(state.exam.gradedQuestions).length === state.exam.questions.length) {
      state.exam.finished = true;
    }
  } else {
    state.exam.questions.forEach((question) => {
      state.exam.gradedQuestions[question.id] = true;
    });
    state.exam.finished = true;
  }
  render();
}

function finishAttempt() {
  if (!state.exam) return;
  const total = state.exam.questions.length;
  const correct = scoreForExam();
  state.attempts.unshift({
    id: `attempt-${Date.now()}`,
    setId: state.exam.setId,
    setTitle: state.exam.setTitle,
    mode: state.exam.mode,
    questions: clone(state.exam.questions),
    editedDuringExam: Boolean(state.exam.hasEdits),
    total,
    correct,
    percent: total ? Math.round((correct / total) * 100) : 0,
    answers: clone(state.exam.answers),
    completedAt: new Date().toISOString(),
  });
  saveAttempts();
  state.pausedExam = null;
  savePausedExam();
  state.exam = null;
  state.editingExamQuestionId = "";
  showView("dashboard");
}

function pauseExam() {
  if (!state.exam) return;
  state.pausedExam = {
    exam: clone(state.exam),
    needsExportReminder: state.needsExportReminder,
    pausedAt: new Date().toISOString(),
  };
  savePausedExam();
  state.editingExamQuestionId = "";
  state.exam = null;
  showView("dashboard");
}

function renderEditor() {
  const set = activeSet();
  appTitle.textContent = `${set.title} / 編集`;
  if (!set.questions.length) {
    state.activeEditQuestionId = "";
  } else if (!set.questions.some((question) => question.id === state.activeEditQuestionId)) {
    state.activeEditQuestionId = set.questions[0].id;
  }

  editorList.innerHTML = set.questions
    .map(
      (question, index) => `
        <button class="editor-item${question.id === state.activeEditQuestionId ? " active" : ""}" type="button" data-question-id="${question.id}">
          <strong>${index + 1}</strong>
          <span>${escapeHtml(question.text)}</span>
        </button>
      `,
    )
    .join("");

  editorList.querySelectorAll(".editor-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeEditQuestionId = button.dataset.questionId;
      render();
    });
  });

  const question = set.questions.find((item) => item.id === state.activeEditQuestionId);
  editorForm.classList.toggle("hidden", !question);
  if (!question) return;

  editQuestionText.value = question.text;
  editExplanation.value = question.explanation || "";
  choiceEditor.innerHTML = question.choices
    .map(
      (choice, index) => `
        <label class="choice-edit-row">
          <input type="radio" name="correctChoice" value="${choice.id}" ${choice.isCorrect ? "checked" : ""}>
          <span>${index + 1}</span>
          <input type="text" value="${escapeAttribute(choice.text)}" data-choice-id="${choice.id}">
        </label>
      `,
    )
    .join("");
}

function saveEditedQuestion(event) {
  event.preventDefault();
  const set = activeSet();
  const question = set.questions.find((item) => item.id === state.activeEditQuestionId);
  if (!question) return;

  question.text = editQuestionText.value.trim() || "未入力の問題";
  question.explanation = editExplanation.value.trim();
  const correctId = editorForm.elements.correctChoice.value;
  choiceEditor.querySelectorAll("input[type='text']").forEach((input) => {
    const choice = question.choices.find((item) => item.id === input.dataset.choiceId);
    choice.text = input.value.trim() || "未入力の選択肢";
    choice.isCorrect = choice.id === correctId;
  });
  set.updatedAt = new Date().toISOString();
  saveSets();
  render();
}

function addQuestion() {
  const set = activeSet();
  const nextNumber = set.questions.length + 1;
  const questionId = `q${String(nextNumber).padStart(3, "0")}-${Date.now()}`;
  const question = {
    id: questionId,
    text: "新しい問題文",
    explanation: "",
    flag: "none",
    choices: [1, 2, 3, 4].map((number) => ({
      id: `${questionId}_c${String(number).padStart(3, "0")}`,
      text: `選択肢 ${number}`,
      isCorrect: number === 1,
    })),
  };
  set.questions.push(question);
  state.activeEditQuestionId = question.id;
  saveSets();
  render();
}

function deleteQuestion() {
  const set = activeSet();
  if (set.questions.length <= 1) return;
  set.questions = set.questions.filter((question) => question.id !== state.activeEditQuestionId);
  state.activeEditQuestionId = set.questions[0]?.id || "";
  saveSets();
  render();
}

function renderHistory() {
  appTitle.textContent = "過去の履歴";
  if (!state.attempts.length) {
    historyList.innerHTML = '<div class="empty">まだ履歴がありません。</div>';
    return;
  }

  historyList.innerHTML = state.attempts
    .map((attempt) => {
      const date = new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(attempt.completedAt));
      const mode = attempt.mode === "instant" ? "都度採点" : "一括採点";
      const questions = attempt.questions || [];
      const answersHtml = questions.length
        ? questions
            .map((question, index) => {
              const choice = question.choices.find((item) => item.id === attempt.answers[question.id]);
              const correct = choice?.isCorrect;
              return `
                <li class="${correct ? "answer-correct" : "answer-incorrect"}">
                  <span>問${index + 1}</span>
                  <strong>${choice ? escapeHtml(choice.text) : "未回答"}</strong>
                  <em>${correct ? "正解" : "不正解"}</em>
                </li>
              `;
            })
            .join("")
        : '<li><span>詳細</span><strong>旧形式の履歴のため回答詳細はありません</strong><em>-</em></li>';
      return `
        <article class="history-card">
          <div class="history-main">
            <div>
              <strong>${escapeHtml(attempt.setTitle)}</strong>
              <small>${date} / ${mode}</small>
            </div>
            <details>
              <summary>回答を見る</summary>
              <ul class="answer-list">${answersHtml}</ul>
            </details>
          </div>
          <div class="history-score">
            <strong>${attempt.percent}%</strong>
            <span>${attempt.correct} / ${attempt.total}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function selectQuestionSet() {
  state.activeSetId = setSelect.value;
  state.activeEditQuestionId = "";
  saveSets();
  render();
}

function createQuestionSet() {
  const title = setNameInput.value.trim();
  if (!title) {
    setNameInput.focus();
    return;
  }

  const newSet = createEmptyQuestionSet(title);
  state.sets.push(newSet);
  state.activeSetId = newSet.id;
  state.activeEditQuestionId = "";
  saveSets();
  showView("editor");
}

function renameQuestionSet() {
  const set = activeSet();
  const title = setNameInput.value.trim();
  if (!set || !title) {
    setNameInput.focus();
    return;
  }

  set.title = title;
  set.updatedAt = new Date().toISOString();
  saveSets();
  render();
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function exportAppData() {
  const exportedAt = new Date().toISOString();
  const data = {
    schema: "csv-exam-app",
    version: 1,
    exportedAt,
    activeSetId: state.activeSetId,
    sets: state.sets,
    attempts: state.attempts,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = exportedAt.slice(0, 10).replaceAll("-", "");
  link.href = url;
  link.download = `exam-app-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  state.needsExportReminder = false;
  saveExportReminder();
  render();
}

function importAppDataFromFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const data = JSON.parse(String(reader.result || ""));
      importAppData(data);
    } catch {
      alert("JSONファイルを読み込めませんでした。");
    }
  });
  reader.readAsText(file);
}

function importAppData(data) {
  if (!data || data.schema !== "csv-exam-app" || !Array.isArray(data.sets)) {
    alert("このアプリのバックアップJSONではありません。");
    return;
  }

  const sets = data.sets.filter(isValidQuestionSet);
  if (!sets.length) {
    alert("取り込める問題集がありません。");
    return;
  }

  state.sets = sets;
  state.attempts = Array.isArray(data.attempts) ? data.attempts : [];
  state.activeSetId = sets.some((set) => set.id === data.activeSetId) ? data.activeSetId : sets[0].id;
  state.activeEditQuestionId = "";
  state.editingExamQuestionId = "";
  state.exam = null;
  state.pausedExam = null;
  state.needsExportReminder = false;
  normalizeQuestionFlags();
  saveSets();
  saveAttempts();
  savePausedExam();
  saveExportReminder();
  showView("dashboard");
}

function isValidQuestionSet(set) {
  return (
    set &&
    typeof set.id === "string" &&
    typeof set.title === "string" &&
    Array.isArray(set.questions) &&
    set.questions.every(
      (question) =>
        question &&
        typeof question.id === "string" &&
        typeof question.text === "string" &&
        Array.isArray(question.choices) &&
        question.choices.length > 0,
    )
  );
}

function render() {
  if (state.view === "dashboard") renderDashboard();
  if (state.view === "exam") renderExam();
  if (state.view === "editor") renderEditor();
  if (state.view === "history") renderHistory();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

dashboardButton.addEventListener("click", () => showView("dashboard"));
setSelect.addEventListener("change", selectQuestionSet);
createSetButton.addEventListener("click", createQuestionSet);
renameSetButton.addEventListener("click", renameQuestionSet);
startExamButton.addEventListener("click", startExam);
flagOnlyOption.addEventListener("change", render);
examModeSelect.addEventListener("change", render);
openEditButton.addEventListener("click", () => showView("editor"));
openHistoryButton.addEventListener("click", () => showView("history"));
exportDataButton.addEventListener("click", exportAppData);
importDataButton.addEventListener("click", () => importDataInput.click());
importDataInput.addEventListener("change", importAppDataFromFile);
gradeButton.addEventListener("click", gradeCurrentOrExam);
pauseButton.addEventListener("click", pauseExam);
reviewButton.addEventListener("click", () => examCard.scrollIntoView({ behavior: "smooth", block: "start" }));
finishButton.addEventListener("click", finishAttempt);
editorForm.addEventListener("submit", saveEditedQuestion);
addQuestionButton.addEventListener("click", addQuestion);
deleteQuestionButton.addEventListener("click", deleteQuestion);
clearHistoryButton.addEventListener("click", () => {
  state.attempts = [];
  saveAttempts();
  render();
});

prevButton.addEventListener("click", () => {
  state.exam.currentIndex -= 1;
  render();
});

nextButton.addEventListener("click", () => {
  state.exam.currentIndex += 1;
  render();
});

async function init() {
  loadLocalState();
  if (!state.sets.length) {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`CSV を読み込めませんでした: ${response.status}`);
    state.sets = [createDefaultSet(groupQuestions(parseCsv(await response.text())))];
    state.activeSetId = state.sets[0].id;
    saveSets();
  }
  if (!state.activeSetId || !state.sets.some((set) => set.id === state.activeSetId)) {
    state.activeSetId = state.sets[0]?.id || "";
  }
  normalizeQuestionFlags();
  saveSets();
  showView("dashboard");
}

init().catch((error) => {
  dashboardView.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
