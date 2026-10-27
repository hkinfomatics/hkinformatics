/**
 * 데이터 분석 탐정 - 메인 애플리케이션 스크립트
 * 교육 현장(수업, 평가, 기록)을 위한 데이터 입력, 시각화, 다각도 분석 및 레포트 생성
 */

// ==========================================
// 1. Firebase (Firestore) 설정 (CDN 호환)
// ==========================================
const firebaseConfig = {
  apiKey: "여기에_API_KEY",
  authDomain: "여기에_AUTH_DOMAIN",
  projectId: "여기에_PROJECT_ID",
  storageBucket: "여기에_STORAGE_BUCKET",
  messagingSenderId: "여기에_SENDER_ID",
  appId: "여기에_APP_ID"
};

let db = null;
let isFirebaseActive = false;

// Firebase 초기화 시도 (유효한 키가 아닐 경우 안전하게 로컬 저장소 모드로 폴백)
function initFirebase() {
  try {
    if (typeof firebase !== 'undefined') {
      const isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("여기에_");
      if (!isPlaceholder) {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        isFirebaseActive = true;
        updateFirebaseStatusUI(true, "Firebase Firestore가 정상 연결되었습니다.");
        return;
      }
    }
  } catch (err) {
    console.warn("Firebase 초기화 대기 또는 오류:", err);
  }
  isFirebaseActive = false;
  updateFirebaseStatusUI(false, "Firebase 미연동 (브라우저 로컬 저장소 모드로 동작 중)");
}

function updateFirebaseStatusUI(connected, message) {
  const badge = document.getElementById("firebase-status-badge");
  if (badge) {
    if (connected) {
      badge.className = "btn btn-sm btn-secondary";
      badge.innerHTML = `☁️ Firestore 연결됨`;
      badge.title = message;
    } else {
      badge.className = "btn btn-sm btn-outline";
      badge.innerHTML = `💾 로컬 모드 (Firebase 설정 가능)`;
      badge.title = message;
    }
  }
}

// ==========================================
// 2. 전역 상태 관리 (App State) & 테마 팔레트
// ==========================================
const PALETTES = {
  rainbow: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6'],
  ocean: ['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#0284C7', '#0EA5E9', '#38BDF8'],
  forest: ['#047857', '#059669', '#10B981', '#34D399', '#6EE7B7', '#15803D', '#16A34A', '#22C55E'],
  sunset: ['#C2410C', '#EA580C', '#F97316', '#FB923C', '#F59E0B', '#FBBF24', '#E11D48', '#BE123C'],
  violet: ['#6D28D9', '#7C3AED', '#8B5CF6', '#A78BFA', '#C084FC', '#D946EF', '#4F46E5', '#6366F1'],
  rose: ['#BE185D', '#DB2777', '#EC4899', '#F472B6', '#F9A8D4', '#FB7185', '#E11D48', '#FDA4AF']
};

const state = {
  caseTitle: "우리 반 주간 독서 시간 탐정 분석",
  fileName: "sample_reading_detective.csv",
  headers: [],
  rows: [],
  labelColumn: "",
  valueColumn: "",
  valueColumns: [], // 다중 Y축 수치 컬럼 목록 (배열)
  chartType: "bar", // 'line', 'bar', 'pie'
  chartUnit: "분",
  customYMin: "",
  customYMax: "",
  sliceStart: 1,
  sliceEnd: 10,
  activePalette: "rainbow",
  customItemColors: {}, // { [itemLabel]: '#HEX' }
  showDataLabels: true, // 그래프 위 수치 데이터 레이블 표시
  labelFontSize: 14, // 그래프 내부 데이터 레이블 글씨 크기 (px)
  editingRowIndex: null,
  detectiveNotes: "분석관 소견: 주말에 가까워질수록 학생들의 독서 시간이 급격히 증가하는 양상을 보이며, 수요일에 일시적으로 감소하는 특이 패턴이 발견되었습니다.",
  reportChartWidth: 850,
  reportChartHeight: 450,
  activeStep: 1
};

let mainChart = null;

// 교육용 사건 단서 샘플 데이터셋
const SAMPLE_DATASETS = {
  reading: {
    title: "우리 반 주간 독서 시간 탐정 분석",
    unit: "분",
    csv: `요일,독서시간(분),읽은책(권)
월요일,35,1
화요일,42,2
수요일,20,1
목요일,45,2
금요일,60,3
토요일,85,4
일요일,90,5`
  },
  club: {
    title: "교실 동아리 선호도 조사 사건",
    unit: "명",
    csv: `동아리명,선택학생수(명),만족도(점)
코딩탐정단,18,92
데이터분석반,15,88
미술창작부,12,85
보드게임부,14,90
독서토론반,8,78
체육활동부,21,95`
  },
  recycling: {
    title: "교내 쓰레기 분리배출 비중 사건",
    unit: "%",
    csv: `품목,비율(%),수거량(kg)
종이류,38,45
플라스틱,28,32
비닐류,18,20
캔고철류,10,12
유리병,6,8`
  },
  energy: {
    title: "월별 학급 에너지 절약 챌린지",
    unit: "kWh",
    csv: `월,절감량(kWh),참여학생(명)
3월,45,25
4월,52,26
5월,68,28
6월,80,30
7월,95,30`
  }
};

// ==========================================
// 3. 초기화 & 이벤트 리스너
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
  setupEventListeners();
  loadSampleData('reading');
});

function setupEventListeners() {
  // 스텝 네비게이션
  document.querySelectorAll(".step-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.dataset.step);
      switchStep(step);
    });
  });

  // 파일 업로드 드롭존
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("csv-file-input");

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  // 샘플 데이터 버튼
  document.querySelectorAll("[data-sample]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.sample;
      loadSampleData(key);
      showToast(`샘플 [${SAMPLE_DATASETS[key].title}] 단서 데이터를 불러왔습니다.`);
    });
  });

  // 그래프 유형 버튼들
  document.querySelectorAll(".graph-type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".graph-type-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.chartType = btn.dataset.type;
      renderChart();
      updateGraphRecommendation();
      updateDetectiveAnalysis();
    });
  });

  // 단위 및 범위 입력
  const unitInput = document.getElementById("chart-unit-input");
  if (unitInput) {
    unitInput.addEventListener("input", (e) => {
      state.chartUnit = e.target.value.trim() || "";
      const unitBadge = document.getElementById("chart-unit-badge");
      if (unitBadge) unitBadge.textContent = state.chartUnit ? `단위: ${state.chartUnit}` : "단위 미지정";
      renderChart();
      updateDetectiveAnalysis();
    });
  }

  const yMinInput = document.getElementById("chart-ymin-input");
  const yMaxInput = document.getElementById("chart-ymax-input");
  const applyRangeBtn = document.getElementById("btn-apply-range");
  const resetRangeBtn = document.getElementById("btn-reset-range");

  if (applyRangeBtn) {
    applyRangeBtn.addEventListener("click", () => {
      state.customYMin = yMinInput.value !== "" ? parseFloat(yMinInput.value) : "";
      state.customYMax = yMaxInput.value !== "" ? parseFloat(yMaxInput.value) : "";
      renderChart();
      showToast("그래프 Y축 범위가 적용되었습니다.");
    });
  }

  if (resetRangeBtn) {
    resetRangeBtn.addEventListener("click", () => {
      state.customYMin = "";
      state.customYMax = "";
      if (yMinInput) yMinInput.value = "";
      if (yMaxInput) yMaxInput.value = "";
      renderChart();
      showToast("그래프 범위가 자동(Auto)으로 초기화되었습니다.");
    });
  }

  // 데이터 슬라이스(행 범위 지정)
  const sliceStart = document.getElementById("slice-start");
  const sliceEnd = document.getElementById("slice-end");
  const applySliceBtn = document.getElementById("btn-apply-slice");

  if (applySliceBtn) {
    applySliceBtn.addEventListener("click", () => {
      const s = parseInt(sliceStart.value) || 1;
      const e = parseInt(sliceEnd.value) || state.rows.length;
      if (s > e) {
        showToast("시작 행이 종료 행보다 클 수 없습니다.", true);
        return;
      }
      state.sliceStart = Math.max(1, s);
      state.sliceEnd = Math.min(state.rows.length, e);
      renderChart();
      updateDetectiveAnalysis();
      showToast(`${state.sliceStart}행 ~ ${state.sliceEnd}행 데이터가 그래프에 반영되었습니다.`);
    });
  }

  // 데이터 수치 레이블 표시 토글
  const toggleDataLabels = document.getElementById("toggle-data-labels");
  if (toggleDataLabels) {
    toggleDataLabels.addEventListener("change", (e) => {
      state.showDataLabels = e.target.checked;
      renderChart();
      updateReportChartImage();
      showToast(state.showDataLabels ? "그래프 수치 데이터 레이블이 활성화되었습니다." : "데이터 레이블이 숨김 처리되었습니다.");
    });
  }

  // 데이터 레이블 글씨 크기 조절 (기능 2 컨트롤 패널)
  const step2FontSizeSlider = document.getElementById("step2-fontsize-slider");
  const step2FontSizeDisplay = document.getElementById("step2-fontsize-display");
  const step2FontSizeBtns = document.querySelectorAll(".step2-fontsize-btn");

  if (step2FontSizeSlider) {
    step2FontSizeSlider.addEventListener("input", (e) => {
      const size = parseInt(e.target.value);
      setLabelFontSize(size);
    });
  }

  step2FontSizeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const size = parseInt(btn.dataset.size);
      setLabelFontSize(size);
      showToast(`레이블 글씨 크기가 [${btn.textContent.trim()}]으로 변경되었습니다.`);
    });
  });

  // 컬럼 선택 변경
  const labelSelect = document.getElementById("select-label-col");

  if (labelSelect) {
    labelSelect.addEventListener("change", (e) => {
      state.labelColumn = e.target.value;
      // 가로축으로 선택된 컬럼이 Y축 목록에 체크되어 있다면 자동 해제
      if (state.valueColumns && state.valueColumns.includes(state.labelColumn)) {
        state.valueColumns = state.valueColumns.filter(c => c !== state.labelColumn);
        if (state.valueColumns.length === 0) {
          const fallbackCol = state.headers.find(h => h !== state.labelColumn) || state.headers[0];
          state.valueColumns = [fallbackCol];
        }
        state.valueColumn = state.valueColumns[0];
      }
      renderMultiYCheckboxes();
      renderChart();
      updateGraphRecommendation();
      updateDetectiveAnalysis();
    });
  }

  // 사건 제목 및 탐정 노트 편집
  const titleInput = document.getElementById("case-title-input");
  if (titleInput) {
    titleInput.addEventListener("input", (e) => {
      state.caseTitle = e.target.value.trim() || "데이터 분석 보고서";
      const reportTitle = document.getElementById("report-title-display");
      if (reportTitle) reportTitle.textContent = state.caseTitle;
    });
  }

  const notesInput = document.getElementById("detective-notes-input");
  if (notesInput) {
    notesInput.addEventListener("input", (e) => {
      state.detectiveNotes = e.target.value;
      const reportNotes = document.getElementById("report-notes-display");
      if (reportNotes) reportNotes.textContent = state.detectiveNotes || "작성된 분석관 소견이 없습니다.";
    });
  }

  // 기능 4: 마우스로 그래프 크기 조절 기능 (슬라이더, 프리셋 버튼, 드래그 핸들)
  setupReportChartMouseResize();

  // 테마 팔레트 프리셋 선택
  document.querySelectorAll(".palette-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".palette-preset-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activePalette = btn.dataset.palette || "rainbow";
      state.customItemColors = {}; // 테마 변경 시 개별 지정값 리셋하여 새 테마 반영
      renderChart();
      renderItemColorPickers();
      showToast(`[${btn.textContent.trim()}] 팔레트로 색상이 변경되었습니다.`);
    });
  });

  // 색상 초기화 버튼
  const btnResetColors = document.getElementById("btn-reset-colors");
  if (btnResetColors) {
    btnResetColors.addEventListener("click", () => {
      state.customItemColors = {};
      renderChart();
      renderItemColorPickers();
      showToast("모든 항목의 색상이 팔레트 기본값으로 초기화되었습니다.");
    });
  }

  // 모달 행 수정 저장 버튼
  const btnSaveRowEdit = document.getElementById("btn-save-row-edit");
  if (btnSaveRowEdit) {
    btnSaveRowEdit.addEventListener("click", saveEditRowModal);
  }

  // 액션 버튼들
  const btnDownloadPdf = document.getElementById("btn-download-pdf");
  if (btnDownloadPdf) btnDownloadPdf.addEventListener("click", exportReportPdf);

  const btnSaveChartImg = document.getElementById("btn-save-chart-img");
  if (btnSaveChartImg) btnSaveChartImg.addEventListener("click", saveChartAsImage);

  const btnCopyAnalysis = document.getElementById("btn-copy-analysis");
  if (btnCopyAnalysis) btnCopyAnalysis.addEventListener("click", copyAnalysisText);

  const btnSaveFirebase = document.getElementById("btn-save-firebase");
  if (btnSaveFirebase) btnSaveFirebase.addEventListener("click", saveToFirebase);

  const btnOpenLoadModal = document.getElementById("btn-open-load-modal");
  if (btnOpenLoadModal) btnOpenLoadModal.addEventListener("click", openLoadReportsModal);

  const btnFirebaseHelp = document.getElementById("btn-firebase-help");
  if (btnFirebaseHelp) btnFirebaseHelp.addEventListener("click", openFirebaseModal);

  const btnAddRow = document.getElementById("btn-add-row");
  if (btnAddRow) btnAddRow.addEventListener("click", addNewTableRow);

  const btnClearData = document.getElementById("btn-clear-data");
  if (btnClearData) btnClearData.addEventListener("click", clearCurrentData);

  const btnApplyCleansing = document.getElementById("btn-apply-cleansing");
  if (btnApplyCleansing) btnApplyCleansing.addEventListener("click", applyDataCleansing);
}

// 스텝 전환 (1단계 -> 2단계 -> 3단계 -> 4단계)
function switchStep(stepNumber) {
  state.activeStep = stepNumber;
  document.querySelectorAll(".step-nav-btn").forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.step) === stepNumber);
  });

  if (stepNumber === 4) {
    updateDetectiveAnalysis();
    updateReportChartImage();
  }

  const stepIds = ["step-input-card", "step-vis-card", "step-analysis-card", "step-report-card"];
  stepIds.forEach((id, index) => {
    const card = document.getElementById(id);
    if (card) {
      // 뷰포트에서 해당 스텝으로 부드럽게 스크롤
      if (index + 1 === stepNumber) {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
}

// ==========================================
// 4. 데이터 입력 및 파싱 (기능 1)
// ==========================================
function loadSampleData(sampleKey) {
  const sample = SAMPLE_DATASETS[sampleKey];
  if (!sample) return;

  state.caseTitle = sample.title;
  state.chartUnit = sample.unit || "";
  state.fileName = `${sampleKey}_detective_data.csv`;

  const titleInput = document.getElementById("case-title-input");
  if (titleInput) titleInput.value = state.caseTitle;

  const unitInput = document.getElementById("chart-unit-input");
  if (unitInput) unitInput.value = state.chartUnit;

  parseCsvContent(sample.csv);
}

// 임시 정제 검사 대기용 객체
let pendingCleansingData = null;

function handleFileSelect(file) {
  if (!file) return;
  if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
    showToast("CSV 파일 형식(.csv)만 업로드 가능합니다.", true);
    return;
  }

  state.fileName = file.name;
  state.caseTitle = file.name.replace(/\.[^/.]+$/, "") + " 데이터 분석";
  const titleInput = document.getElementById("case-title-input");
  if (titleInput) titleInput.value = state.caseTitle;

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    parseCsvContent(content);
  };
  reader.onerror = () => {
    showToast("파일을 읽는 중 오류가 발생했습니다.", true);
  };
  reader.readAsText(file, "UTF-8");
}

function parseCsvContent(csvString) {
  if (typeof Papa !== 'undefined') {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: function(results) {
        if (results.data && results.data.length > 0) {
          const headers = results.meta.fields || Object.keys(results.data[0]);
          const rawRows = results.data.map((row, idx) => ({ _id: idx + 1, ...row }));
          checkAndProcessDataCleansing(headers, rawRows);
        } else {
          showToast("CSV 파일에 유효한 데이터가 없습니다.", true);
        }
      },
      error: function(err) {
        console.error(err);
        fallbackParseCsv(csvString);
      }
    });
  } else {
    fallbackParseCsv(csvString);
  }
}

// PapaParse 부재 시 자체 파서
function fallbackParseCsv(csvString) {
  const lines = csvString.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    showToast("CSV 데이터 형식이 올바르지 않습니다.", true);
    return;
  }
  const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
  const rawRows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
    const rowObj = { _id: i };
    headers.forEach((h, colIdx) => {
      const val = values[colIdx];
      const num = Number(val);
      rowObj[h] = !isNaN(num) && val !== "" ? num : val;
    });
    rawRows.push(rowObj);
  }
  checkAndProcessDataCleansing(headers, rawRows);
}

// 데이터 이상치(결측치, 비숫자 등) 검사 및 클렌징 모달 팝업 판별
function checkAndProcessDataCleansing(headers, rawRows) {
  // 각 열별로 숫자 데이터가 주로 있는 열을 파악
  const numericColCandidates = headers.filter(header => {
    let numericCount = 0;
    let nonNumericCount = 0;
    rawRows.forEach(row => {
      const val = row[header];
      if (val !== null && val !== undefined && val !== "") {
        if (typeof val === 'number' && !isNaN(val)) {
          numericCount++;
        } else if (!isNaN(Number(val))) {
          numericCount++;
        } else {
          nonNumericCount++;
        }
      }
    });
    return numericCount > 0 && (numericCount >= nonNumericCount);
  });

  const issues = [];
  let emptyCount = 0;
  let nonNumericCount = 0;
  const affectedRowIndices = new Set();

  rawRows.forEach((row, rowIdx) => {
    headers.forEach(h => {
      const val = row[h];
      const isCandidateNumeric = numericColCandidates.includes(h);

      // 1. 빈 셀 (null, undefined, 공백 문자열)
      if (val === null || val === undefined || (typeof val === 'string' && val.trim() === "")) {
        emptyCount++;
        affectedRowIndices.add(rowIdx);
        issues.push({
          row: rowIdx + 1,
          col: h,
          type: "빈 셀 (결측치)",
          desc: `${rowIdx + 1}행 [${h}] 열이 비어 있습니다.`,
          val: "(비어있음)"
        });
      }
      // 2. 수치 대상 열인데 숫자로 변환 불가능한 텍스트가 들어있는 경우
      else if (isCandidateNumeric && typeof val !== 'number' && isNaN(Number(val))) {
        nonNumericCount++;
        affectedRowIndices.add(rowIdx);
        issues.push({
          row: rowIdx + 1,
          col: h,
          type: "비수치 데이터",
          desc: `${rowIdx + 1}행 [${h}] 열에 비정상 텍스트가 있습니다.`,
          val: `"${val}"`
        });
      }
    });
  });

  // 이상치가 발견되면 클렌징 모달을 띄워 사용자에게 선택권 제공
  if (issues.length > 0) {
    pendingCleansingData = {
      headers,
      rawRows,
      numericColCandidates,
      issues,
      emptyCount,
      nonNumericCount,
      affectedRows: affectedRowIndices.size
    };
    showDataCleansingModal(pendingCleansingData);
  } else {
    // 이상치가 없으면 즉시 정상 로드
    state.headers = headers;
    state.rows = rawRows;
    onDataLoaded();
    showToast(`단서 파일 [${state.fileName || 'CSV'}]을 성공적으로 불러왔습니다!`);
  }
}

// 데이터 클렌징 모달 열기
function showDataCleansingModal(data) {
  const modal = document.getElementById("data-cleansing-modal");
  const summaryBox = document.getElementById("cleansing-summary-box");
  const issuesList = document.getElementById("cleansing-issues-list");
  if (!modal) return;

  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="cleansing-stat-pill">
        <div class="cleansing-stat-label">총 단서 행</div>
        <div class="cleansing-stat-val">${data.rawRows.length}개</div>
      </div>
      <div class="cleansing-stat-pill" style="border-color: #FCA5A5; background: #FEF2F2;">
        <div class="cleansing-stat-label" style="color: #DC2626;">빈 셀(결측치)</div>
        <div class="cleansing-stat-val" style="color: #DC2626;">${data.emptyCount}개</div>
      </div>
      <div class="cleansing-stat-pill" style="border-color: #FCD34D; background: #FFFBEB;">
        <div class="cleansing-stat-label" style="color: #D97706;">비수치 이상 데이터</div>
        <div class="cleansing-stat-val" style="color: #D97706;">${data.nonNumericCount}개</div>
      </div>
      <div class="cleansing-stat-pill">
        <div class="cleansing-stat-label">영향받는 행</div>
        <div class="cleansing-stat-val">${data.affectedRows}행</div>
      </div>
    `;
  }

  if (issuesList) {
    const previewIssues = data.issues.slice(0, 5);
    issuesList.innerHTML = previewIssues.map(issue => `
      <div class="cleansing-issue-item">
        <span><strong>${issue.desc}</strong> (현재값: ${issue.val})</span>
        <span class="cleansing-issue-badge">${issue.type}</span>
      </div>
    `).join("");

    if (data.issues.length > 5) {
      issuesList.innerHTML += `
        <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding-top: 4px;">
          ...외 ${data.issues.length - 5}개의 추가 이상치가 확인되었습니다.
        </div>
      `;
    }
  }

  modal.style.display = "flex";
}

// 클렌징 옵션 적용 실행
function applyDataCleansing() {
  if (!pendingCleansingData) return;

  const selectedAction = document.querySelector('input[name="cleansing-action"]:checked')?.value || "filter";
  const { headers, rawRows, numericColCandidates, issues } = pendingCleansingData;

  let cleanedRows = [];

  if (selectedAction === "filter") {
    // 1. 문제 있는 행 자체를 삭제(필터링)
    const affectedIndices = new Set();
    issues.forEach(i => affectedIndices.add(i.row - 1));

    cleanedRows = rawRows.filter((_, idx) => !affectedIndices.has(idx)).map((row, newIdx) => ({
      ...row,
      _id: newIdx + 1
    }));

    showToast(`🧹 클렌징 완료: 이상치 포함 ${affectedIndices.size}개 행을 제외하고 정상 데이터를 로드했습니다.`);
  } else if (selectedAction === "zero") {
    // 2. 결측치 및 숫자가 아닌 데이터를 0으로 치환
    cleanedRows = rawRows.map((row, idx) => {
      const newRow = { ...row, _id: idx + 1 };
      headers.forEach(h => {
        const val = newRow[h];
        const isCandidateNumeric = numericColCandidates.includes(h);

        // 빈 셀이거나 수치 컬럼에서 숫자가 아닌 경우 0으로 대체
        if (val === null || val === undefined || (typeof val === 'string' && val.trim() === "")) {
          newRow[h] = isCandidateNumeric ? 0 : "-";
        } else if (isCandidateNumeric && typeof val !== 'number' && isNaN(Number(val))) {
          newRow[h] = 0;
        } else if (isCandidateNumeric && typeof val !== 'number' && !isNaN(Number(val))) {
          newRow[h] = Number(val);
        }
      });
      return newRow;
    });

    showToast(`0️⃣ 클렌징 완료: 결측치 및 비수치 데이터를 '0'으로 안전하게 변환했습니다.`);
  } else {
    // 3. 원본 유지
    cleanedRows = rawRows.map((row, idx) => ({ ...row, _id: idx + 1 }));
    showToast(`⚠️ 원본 데이터 그대로 불러왔습니다.`);
  }

  closeModal("data-cleansing-modal");
  pendingCleansingData = null;

  state.headers = headers;
  state.rows = cleanedRows;
  onDataLoaded();
}

function onDataLoaded() {
  // 슬라이스 범위 초기화
  state.sliceStart = 1;
  state.sliceEnd = state.rows.length;

  const sliceStartInput = document.getElementById("slice-start");
  const sliceEndInput = document.getElementById("slice-end");
  const sliceMaxSpan = document.getElementById("slice-max-count");

  if (sliceStartInput) sliceStartInput.value = 1;
  if (sliceEndInput) sliceEndInput.value = state.rows.length;
  if (sliceMaxSpan) sliceMaxSpan.textContent = state.rows.length;

  // 기본 라벨 컬럼과 값 컬럼 자동 지정
  populateColumnSelectors();
  renderDataTable();
  renderChart();
  updateGraphRecommendation();
  updateDetectiveAnalysis();
}

function populateColumnSelectors() {
  const labelSelect = document.getElementById("select-label-col");
  if (!labelSelect) return;

  labelSelect.innerHTML = "";

  let candidateLabel = state.headers[0];
  let candidateValue = state.headers[1] || state.headers[0];

  state.headers.forEach((header) => {
    // 라벨 셀렉터 옵션
    const optLabel = document.createElement("option");
    optLabel.value = header;
    optLabel.textContent = header;
    labelSelect.appendChild(optLabel);

    // 숫자형 데이터가 많은 열을 기본 값 컬럼으로 추천
    const sampleVal = state.rows[0] ? state.rows[0][header] : null;
    if (typeof sampleVal === 'number' && candidateValue === state.headers[0]) {
      candidateValue = header;
    }
  });

  state.labelColumn = candidateLabel;
  if (!state.valueColumns || state.valueColumns.length === 0) {
    state.valueColumns = [candidateValue];
  }
  state.valueColumn = state.valueColumns[0] || candidateValue;

  labelSelect.value = state.labelColumn;

  // 다중 Y축 체크박스 목록 렌더링
  renderMultiYCheckboxes();
}

// 다중 Y축 수치 데이터 열 체크박스 목록 생성 및 제어 함수
function renderMultiYCheckboxes() {
  const container = document.getElementById("multi-y-checkboxes-container");
  const badge = document.getElementById("multi-y-status-badge");
  const helpText = document.getElementById("multi-y-help-text");
  if (!container) return;

  container.innerHTML = "";

  // 가로축(X축)으로 쓰이는 열은 제외한 나머지 열들 중에서 선택 가능하도록 구성
  const availableColumns = state.headers.filter(h => h !== state.labelColumn);

  // 만약 선택된 valueColumns 중 현재 사용 가능한 컬럼에 없는 것이 있다면 보정
  state.valueColumns = (state.valueColumns || []).filter(c => availableColumns.includes(c));
  if (state.valueColumns.length === 0 && availableColumns.length > 0) {
    state.valueColumns = [availableColumns[0]];
  }
  state.valueColumn = state.valueColumns[0] || (availableColumns[0] || "");

  // Y축 상태 뱃지 업데이트
  if (badge) {
    const isMulti = state.valueColumns.length > 1;
    badge.className = isMulti ? "badge-recommend badge-match" : "badge-recommend badge-hint";
    badge.textContent = isMulti ? `다중 Y축 (${state.valueColumns.length}개 지표)` : "단일 Y축";
  }

  if (helpText) {
    if (state.valueColumns.length > 1) {
      helpText.innerHTML = `* 현재 <strong>${state.valueColumns.length}개</strong>의 수치 지표([${state.valueColumns.join(', ')}])가 한 그래프 안에 다중 범례로 동시 비교됩니다.`;
    } else {
      helpText.innerHTML = `* 체크박스를 여러 개 선택하면 한 그래프 안에 다중 막대/꺾은선으로 수치를 동시에 비교할 수 있습니다.`;
    }
  }

  // 테마 팔레트 색상 매핑
  const palette = PALETTES[state.activePalette] || PALETTES.rainbow;

  availableColumns.forEach((header, idx) => {
    const isChecked = state.valueColumns.includes(header);
    const colorTag = palette[idx % palette.length];

    const item = document.createElement("label");
    item.className = `multi-y-item ${isChecked ? 'checked' : ''}`;

    const left = document.createElement("div");
    left.className = "multi-y-left";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.value = header;
    chk.checked = isChecked;

    const colorDot = document.createElement("span");
    colorDot.className = "multi-y-color-tag";
    colorDot.style.backgroundColor = colorTag;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = header;
    nameSpan.title = header;

    left.appendChild(chk);
    left.appendChild(colorDot);
    left.appendChild(nameSpan);

    const badgeSpan = document.createElement("span");
    badgeSpan.className = "multi-y-badge";
    const sampleVal = state.rows[0] ? state.rows[0][header] : null;
    const isNum = typeof sampleVal === 'number' || !isNaN(parseFloat(sampleVal));
    badgeSpan.textContent = isNum ? "수치 데이터" : "일반 텍스트";

    item.appendChild(left);
    item.appendChild(badgeSpan);

    chk.addEventListener("change", (e) => {
      e.stopPropagation();
      const col = chk.value;
      if (chk.checked) {
        if (!state.valueColumns.includes(col)) {
          state.valueColumns.push(col);
        }
      } else {
        // 최소 1개는 반드시 선택되어 있어야 함
        if (state.valueColumns.length <= 1) {
          showToast("최소 1개 이상의 Y축 수치 열을 선택해야 합니다.", true);
          chk.checked = true;
          return;
        }
        state.valueColumns = state.valueColumns.filter(c => c !== col);
      }

      state.valueColumn = state.valueColumns[0];
      
      // 첫 번째 선택된 열의 괄호 단위 자동 유추
      const unitMatch = state.valueColumn.match(/\((.*?)\)/);
      if (unitMatch && unitMatch[1]) {
        state.chartUnit = unitMatch[1];
        const unitInput = document.getElementById("chart-unit-input");
        if (unitInput) unitInput.value = state.chartUnit;
        const unitBadge = document.getElementById("chart-unit-badge");
        if (unitBadge) unitBadge.textContent = `단위: ${state.chartUnit}`;
      }

      renderMultiYCheckboxes();
      renderChart();
      updateGraphRecommendation();
      updateDetectiveAnalysis();
      showToast(`Y축 지표 설정: [${state.valueColumns.join(', ')}] 반영 완료`);
    });

    container.appendChild(item);
  });
}

// 대화형 데이터 표 렌더링 (인라인 셀 직접 수정 & 행 수정 모달 & 행 삭제 기능)
function renderDataTable() {
  const thead = document.getElementById("data-table-head");
  const tbody = document.getElementById("data-table-body");
  const rowCountBadge = document.getElementById("data-row-count-badge");

  if (!thead || !tbody) return;

  if (rowCountBadge) {
    rowCountBadge.textContent = `총 ${state.rows.length}개 단서 행`;
  }

  // 헤더 생성
  thead.innerHTML = "";
  const headerTr = document.createElement("tr");
  
  const thIndex = document.createElement("th");
  thIndex.textContent = "번호";
  thIndex.style.width = "50px";
  headerTr.appendChild(thIndex);

  state.headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headerTr.appendChild(th);
  });

  const thAction = document.createElement("th");
  thAction.textContent = "수정 / 삭제";
  thAction.style.width = "130px";
  headerTr.appendChild(thAction);

  thead.appendChild(headerTr);

  // 바디 생성
  tbody.innerHTML = "";
  if (state.rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${state.headers.length + 2}" style="text-align: center; padding: 24px; color: var(--text-muted);">표시할 단서 데이터가 없습니다. CSV를 업로드하거나 샘플 데이터를 불러와주세요.</td></tr>`;
    return;
  }

  state.rows.forEach((row, index) => {
    const tr = document.createElement("tr");

    const tdIdx = document.createElement("td");
    tdIdx.textContent = index + 1;
    tdIdx.style.fontWeight = "600";
    tdIdx.style.color = "var(--pink-700)";
    tr.appendChild(tdIdx);

    // 각 데이터 셀 (직접 클릭하여 수정 가능한 input)
    state.headers.forEach(h => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "table-cell-input";
      input.value = row[h] !== undefined ? row[h] : "";
      input.title = "클릭하여 직접 수정 가능 (Enter 또는 다른 곳 클릭 시 자동 저장)";
      
      input.addEventListener("change", (e) => {
        handleCellEdit(index, h, e.target.value);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.target.blur();
        }
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    // 작업 열: 수정 & 삭제 버튼
    const tdAction = document.createElement("td");
    const actionWrap = document.createElement("div");
    actionWrap.className = "table-action-cell";

    const editBtn = document.createElement("button");
    editBtn.className = "row-edit-btn";
    editBtn.innerHTML = "✏️ 수정";
    editBtn.title = "이 단서 행 전체 수정 모달 열기";
    editBtn.addEventListener("click", () => openEditRowModal(index));
    actionWrap.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "row-delete-btn";
    delBtn.innerHTML = "🗑️ 삭제";
    delBtn.title = "이 단서 행 삭제";
    delBtn.addEventListener("click", () => deleteTableRow(index));
    actionWrap.appendChild(delBtn);

    tdAction.appendChild(actionWrap);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}

// 인라인 셀 값 수정 핸들러
function handleCellEdit(rowIndex, headerKey, rawValue) {
  const row = state.rows[rowIndex];
  if (!row) return;

  const trimmed = String(rawValue).trim();
  const num = Number(trimmed);
  const parsedVal = !isNaN(num) && trimmed !== "" ? num : trimmed;
  const oldVal = row[headerKey];

  if (oldVal === parsedVal) return;

  // 만약 현재 X축(라벨) 컬럼의 값이 바뀌었을 때, 기존 커스텀 색상 매핑을 새 라벨로 이전
  if (headerKey === state.labelColumn && state.customItemColors[oldVal]) {
    state.customItemColors[parsedVal] = state.customItemColors[oldVal];
    delete state.customItemColors[oldVal];
  }

  row[headerKey] = parsedVal;

  renderChart();
  renderItemColorPickers();
  updateDetectiveAnalysis();
  showToast(`[수정 완료] ${rowIndex + 1}번 행 '${headerKey}': ${oldVal} → ${parsedVal}`);
}

// 단서 행 전체 수정 모달 열기
function openEditRowModal(rowIndex) {
  const row = state.rows[rowIndex];
  if (!row) return;

  state.editingRowIndex = rowIndex;
  const container = document.getElementById("edit-row-form-fields");
  if (!container) return;

  container.innerHTML = "";
  state.headers.forEach(h => {
    const fieldWrap = document.createElement("div");
    const label = document.createElement("label");
    label.className = "form-label";
    label.textContent = `${h}:`;
    label.style.fontWeight = "700";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-input";
    input.id = `modal-edit-field-${h}`;
    input.value = row[h] !== undefined ? row[h] : "";

    fieldWrap.appendChild(label);
    fieldWrap.appendChild(input);
    container.appendChild(fieldWrap);
  });

  openModal("edit-row-modal");
}

// 단서 행 수정 모달 저장
function saveEditRowModal() {
  if (state.editingRowIndex === null || !state.rows[state.editingRowIndex]) {
    closeModal("edit-row-modal");
    return;
  }

  const row = state.rows[state.editingRowIndex];
  state.headers.forEach(h => {
    const input = document.getElementById(`modal-edit-field-${h}`);
    if (input) {
      const val = input.value.trim();
      const num = Number(val);
      row[h] = !isNaN(num) && val !== "" ? num : val;
    }
  });

  renderDataTable();
  renderChart();
  renderItemColorPickers();
  updateDetectiveAnalysis();
  closeModal("edit-row-modal");
  showToast(`${state.editingRowIndex + 1}번 단서 행의 데이터가 성공적으로 수정되었습니다!`);
}

function deleteTableRow(index) {
  if (state.rows.length <= 1) {
    showToast("최소 1개 이상의 데이터 행이 유지되어야 합니다.", true);
    return;
  }
  const deleted = state.rows.splice(index, 1);
  if (state.sliceEnd > state.rows.length) {
    state.sliceEnd = state.rows.length;
    const sliceEndInput = document.getElementById("slice-end");
    if (sliceEndInput) sliceEndInput.value = state.sliceEnd;
  }
  const sliceMaxSpan = document.getElementById("slice-max-count");
  if (sliceMaxSpan) sliceMaxSpan.textContent = state.rows.length;

  renderDataTable();
  renderChart();
  updateDetectiveAnalysis();
  showToast(`[${deleted[0][state.labelColumn] || (index + 1) + '번'}] 행을 삭제했습니다.`);
}

function addNewTableRow() {
  if (state.headers.length === 0) {
    showToast("먼저 CSV 데이터를 불러와주세요.", true);
    return;
  }
  const newRow = { _id: Date.now() };
  state.headers.forEach((h, idx) => {
    newRow[h] = idx === 0 ? `새 단서 ${state.rows.length + 1}` : 10;
  });
  state.rows.push(newRow);
  state.sliceEnd = state.rows.length;
  const sliceEndInput = document.getElementById("slice-end");
  if (sliceEndInput) sliceEndInput.value = state.sliceEnd;
  const sliceMaxSpan = document.getElementById("slice-max-count");
  if (sliceMaxSpan) sliceMaxSpan.textContent = state.rows.length;

  renderDataTable();
  renderChart();
  updateDetectiveAnalysis();
  showToast("새 단서 행이 추가되었습니다. 표에서 확인하세요!");
}

function clearCurrentData() {
  if (!confirm("현재 단서 데이터를 모두 비우시겠습니까?")) return;
  state.rows = [];
  renderDataTable();
  if (mainChart) mainChart.destroy();
  showToast("단서 데이터가 초기화되었습니다.");
}

// ==========================================
// 5. 데이터 시각화 & 적합성 판별 (기능 2)
// ==========================================
function getProcessedChartData() {
  if (!state.rows.length || !state.labelColumn) {
    return { labels: [], values: [], series: [] };
  }

  const activeValueCols = (state.valueColumns && state.valueColumns.length > 0)
    ? state.valueColumns
    : (state.valueColumn ? [state.valueColumn] : []);

  if (activeValueCols.length === 0) {
    return { labels: [], values: [], series: [] };
  }

  // 행 범위 슬라이스
  const start = Math.max(0, (state.sliceStart || 1) - 1);
  const end = Math.min(state.rows.length, state.sliceEnd || state.rows.length);
  const slicedRows = state.rows.slice(start, end);

  const labels = slicedRows.map(r => String(r[state.labelColumn] ?? ""));
  
  // 첫 번째 Y축 컬럼의 values (기존 단일 축 호환)
  const primaryCol = activeValueCols[0];
  const values = slicedRows.map(r => {
    const val = parseFloat(r[primaryCol]);
    return isNaN(val) ? 0 : val;
  });

  // 모든 선택된 Y축 컬럼별 데이터 시리즈 배열
  const series = activeValueCols.map(col => {
    const data = slicedRows.map(r => {
      const val = parseFloat(r[col]);
      return isNaN(val) ? 0 : val;
    });
    return { column: col, data };
  });

  return { labels, values, series };
}

// Chart.js 공식 DataLabels 플러그인 글로벌 등록 (로드되어 있을 경우)
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
  try {
    Chart.register(ChartDataLabels);
  } catch (e) {
    console.warn("ChartDataLabels 등록 알림:", e);
  }
}

// ChartDataLabels CDN 미로드 또는 오프라인 환경을 위한 네이티브 캔버스 2D 폴백 데이터 레이블 플러그인
const detectiveDataLabelsFallbackPlugin = {
  id: 'detectiveDataLabelsFallback',
  afterDatasetsDraw(chart) {
    // 만약 공식 ChartDataLabels 플러그인이 로드되어 정상 작동 중이면 중복 렌더링 방지
    if (typeof ChartDataLabels !== 'undefined') {
      return;
    }
    if (state.showDataLabels === false) return;

    const ctx = chart.ctx;
    const chartType = state.chartType;

    chart.data.datasets.forEach((dataset, datasetIdx) => {
      const meta = chart.getDatasetMeta(datasetIdx);
      if (!meta || meta.hidden) return;

      const total = dataset.data.reduce((a, b) => a + (Number(b) || 0), 0);

      meta.data.forEach((element, idx) => {
        const val = dataset.data[idx];
        if (val === undefined || val === null) return;

        let labelText = `${Number(val).toLocaleString()}${state.chartUnit}`;
        if (chartType === 'pie') {
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
          labelText = `${labelText} (${pct}%)`;
        }

        let x = 0;
        let y = 0;

        if (chartType === 'bar' || chartType === 'line') {
          x = element.x;
          y = element.y - 14;
        } else if (chartType === 'pie') {
          const pos = element.tooltipPosition();
          x = pos.x;
          y = pos.y;
        }

        const fontSize = state.labelFontSize || 14;
        ctx.save();
        ctx.font = `bold ${fontSize}px 'Pretendard', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textWidth = ctx.measureText(labelText).width;
        const padX = Math.round(fontSize * 0.55);
        const padY = Math.round(fontSize * 0.3);
        const boxW = textWidth + padX * 2;
        const boxH = fontSize + 4 + padY * 2;
        const rectX = x - boxW / 2;
        const rectY = y - boxH / 2;

        if (chartType === 'pie') {
          ctx.fillStyle = "rgba(17, 24, 39, 0.85)";
          ctx.strokeStyle = "transparent";
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.strokeStyle = "#E5E7EB";
          ctx.lineWidth = 1.5;
        }

        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(rectX, rectY, boxW, boxH, 6);
          ctx.fill();
          if (chartType !== 'pie') ctx.stroke();
        } else {
          ctx.fillRect(rectX, rectY, boxW, boxH);
          if (chartType !== 'pie') ctx.strokeRect(rectX, rectY, boxW, boxH);
        }

        ctx.fillStyle = chartType === 'pie' ? '#FFFFFF' : '#111827';
        ctx.fillText(labelText, x, y);
        ctx.restore();
      });
    });
  }
};

if (typeof Chart !== 'undefined') {
  try {
    Chart.register(detectiveDataLabelsFallbackPlugin);
  } catch (e) {}
}

// PDF 및 레포트 시트용 고화질 그래프 이미지 동기화 함수
function updateReportChartImage() {
  const reportChartImg = document.getElementById("report-chart-img");
  if (!reportChartImg || !mainChart) return;
  try {
    const dataUrl = mainChart.toBase64Image('image/png', 1.0);
    if (dataUrl && dataUrl.length > 50) {
      reportChartImg.src = dataUrl;
    }
  } catch (e) {
    console.warn("차트 이미지 변환 알림:", e);
  }
}

function renderChart(updatePickers = true) {
  const ctx = document.getElementById("detective-canvas");
  if (!ctx || typeof Chart === 'undefined') return;

  // 공식 플러그인 로드 보장
  if (typeof ChartDataLabels !== 'undefined') {
    try {
      Chart.register(ChartDataLabels);
    } catch (e) {}
  }

  const { labels, values, series } = getProcessedChartData();

  if (mainChart) {
    mainChart.destroy();
  }

  // 테마 팔레트 및 개별 커스텀 색상 매핑
  const palette = PALETTES[state.activePalette] || PALETTES.rainbow;
  const isMulti = series && series.length > 1;

  const activeValueCols = (state.valueColumns && state.valueColumns.length > 0)
    ? state.valueColumns
    : (state.valueColumn ? [state.valueColumn] : []);

  const chartTitle = isMulti
    ? `${state.caseTitle} (다중 지표: ${activeValueCols.join(', ')})`
    : `${state.caseTitle} (${state.valueColumn} 기준)`;

  const chartTitleEl = document.getElementById("chart-display-title");
  if (chartTitleEl) chartTitleEl.textContent = chartTitle;

  const unitText = state.chartUnit ? ` (${state.chartUnit})` : "";

  let datasets = [];

  if (isMulti) {
    // 다중 Y축인 경우: 각 열(지표)별로 1개씩 dataset 생성
    datasets = series.map((s, seriesIdx) => {
      const seriesColor = palette[seriesIdx % palette.length];
      const colUnitMatch = s.column.match(/\((.*?)\)/);
      const colUnit = colUnitMatch ? ` (${colUnitMatch[1]})` : unitText;

      let ds = {
        label: `${s.column}${colUnit}`,
        data: s.data,
        borderWidth: 2
      };

      if (state.chartType === 'line') {
        ds = {
          ...ds,
          borderColor: seriesColor,
          backgroundColor: seriesColor + '25',
          fill: false,
          tension: 0.35,
          pointBackgroundColor: seriesColor,
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2.5,
          pointRadius: 6,
          pointHoverRadius: 8
        };
      } else if (state.chartType === 'bar') {
        ds = {
          ...ds,
          backgroundColor: seriesColor + 'CC',
          borderColor: seriesColor,
          borderWidth: 1.5,
          borderRadius: 6
        };
      } else if (state.chartType === 'pie') {
        // 원형 그래프는 다중 축일 때 첫 번째 시리즈 항목별 색상 활용
        const itemColors = labels.map((label, idx) => {
          return state.customItemColors[label] || palette[idx % palette.length];
        });
        ds = {
          ...ds,
          backgroundColor: itemColors,
          borderColor: '#FFFFFF',
          borderWidth: 2.5,
          hoverOffset: 10
        };
      }

      return ds;
    });

    // 만약 pie인데 다중 지표가 선택되었다면 첫 번째 시리즈만 원형으로 표시
    if (state.chartType === 'pie') {
      datasets = [datasets[0]];
    }
  } else {
    // 단일 Y축인 경우: 기존과 동일하게 항목별 색상 적용
    const itemColors = labels.map((label, idx) => {
      return state.customItemColors[label] || palette[idx % palette.length];
    });

    let datasetConfig = {
      label: `${state.valueColumn}${unitText}`,
      data: values,
      borderWidth: 2
    };

    if (state.chartType === 'line') {
      const primaryLineColor = itemColors[0] || '#3B82F6';
      datasetConfig = {
        ...datasetConfig,
        borderColor: primaryLineColor,
        backgroundColor: primaryLineColor + '20',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: itemColors,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2.5,
        pointRadius: 7,
        pointHoverRadius: 9
      };
    } else if (state.chartType === 'bar') {
      datasetConfig = {
        ...datasetConfig,
        backgroundColor: itemColors,
        borderColor: itemColors,
        borderRadius: 8
      };
    } else if (state.chartType === 'pie') {
      datasetConfig = {
        ...datasetConfig,
        backgroundColor: itemColors,
        borderColor: '#FFFFFF',
        borderWidth: 2.5,
        hoverOffset: 10
      };
    }

    datasets = [datasetConfig];
  }

  const chartConfig = {
    type: state.chartType,
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2), // 고해상도 2X 렌더링으로 PDF 출력 시 선명도 극대화
      layout: {
        padding: {
          top: Math.max(36, (state.labelFontSize || 14) * 2.4), // 데이터 레이블 크기에 비례하여 상단 여백 넉넉히 확보
          right: 24,
          bottom: 14,
          left: 16
        }
      },
      plugins: {
        legend: {
          display: state.chartType === 'pie' || isMulti,
          position: 'top',
          labels: {
            boxWidth: 16,
            font: { family: "'Pretendard', sans-serif", size: 13, weight: 'bold' },
            color: '#111827',
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: '#1F2937',
          titleFont: { family: "'Pretendard', sans-serif", size: 13, weight: 'bold' },
          bodyFont: { family: "'Pretendard', sans-serif", size: 13 },
          padding: 10,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
              return ` ${context.dataset.label || ''}: ${val.toLocaleString()}${state.chartUnit}`;
            }
          }
        },
        // 데이터 수치 레이블 플러그인 설정 (ChartDataLabels)
        datalabels: {
          display: state.showDataLabels !== false,
          anchor: state.chartType === 'line' ? 'top' : (state.chartType === 'pie' ? 'center' : 'end'),
          align: state.chartType === 'line' ? 'top' : (state.chartType === 'pie' ? 'center' : 'top'),
          offset: state.chartType === 'pie' ? 0 : Math.round((state.labelFontSize || 14) * 0.6),
          color: state.chartType === 'pie' ? '#FFFFFF' : '#111827',
          backgroundColor: state.chartType === 'pie' ? 'rgba(17, 24, 39, 0.85)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: state.chartType === 'pie' ? 'transparent' : '#E5E7EB',
          borderWidth: state.chartType === 'pie' ? 0 : 1.5,
          borderRadius: 6,
          padding: {
            top: Math.round((state.labelFontSize || 14) * 0.25),
            bottom: Math.round((state.labelFontSize || 14) * 0.25),
            left: Math.round((state.labelFontSize || 14) * 0.5),
            right: Math.round((state.labelFontSize || 14) * 0.5)
          },
          font: {
            family: "'Pretendard', sans-serif",
            size: state.labelFontSize || 14,
            weight: 'bold'
          },
          formatter: function(value, context) {
            if (state.chartType === 'pie') {
              const dataset = context.chart.data.datasets[0];
              const total = dataset.data.reduce((a, b) => a + (Number(b) || 0), 0);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${value.toLocaleString()}${state.chartUnit}\n(${pct}%)`;
            }
            return `${value.toLocaleString()}${state.chartUnit}`;
          }
        }
      }
    }
  };

  // 꺾은선/막대 그래프의 경우 X축/Y축 명칭 및 눈금 정밀 커스텀 스케일 적용
  if (state.chartType !== 'pie') {
    const yAxisTitle = isMulti
      ? `세로축 (수치 지표들): ${activeValueCols.join(', ')}`
      : `세로축 (수치): ${state.valueColumn || '측정 지표'}${unitText}`;

    const scalesConfig = {
      x: {
        title: {
          display: true,
          text: `가로축 (항목): ${state.labelColumn || '단서 항목'}`,
          font: { family: "'Pretendard', sans-serif", size: 14, weight: 'bold' },
          color: '#111827',
          padding: { top: 12, bottom: 4 }
        },
        grid: { color: '#FCE7EC' },
        border: { color: '#9CA3AF', width: 1.5 },
        ticks: {
          font: { family: "'Pretendard', sans-serif", size: 13, weight: 'bold' },
          color: '#111827',
          maxRotation: 35,
          minRotation: 0,
          autoSkip: false
        }
      },
      y: {
        grace: '14%', // 최고치 막대/포인트 위에 데이터 레이블이 편안하게 안착하도록 상단 여유 공간 자동 배분
        title: {
          display: true,
          text: yAxisTitle,
          font: { family: "'Pretendard', sans-serif", size: 14, weight: 'bold' },
          color: '#111827',
          padding: { top: 4, bottom: 12 }
        },
        grid: { color: '#FCE7EC' },
        border: { color: '#9CA3AF', width: 1.5 },
        ticks: {
          font: { family: "'Pretendard', sans-serif", size: 13, weight: 'bold' },
          color: '#111827',
          callback: function(value) {
            return value.toLocaleString() + (state.chartUnit ? ' ' + state.chartUnit : '');
          }
        }
      }
    };

    if (state.customYMin !== "") {
      scalesConfig.y.min = state.customYMin;
    }
    if (state.customYMax !== "") {
      scalesConfig.y.max = state.customYMax;
    }

    chartConfig.options.scales = scalesConfig;
  }

  chartConfig.options.animation = {
    onComplete: function() {
      updateReportChartImage();
    }
  };

  mainChart = new Chart(ctx, chartConfig);

  // 렌더링 직후 레포트 이미지 갱신
  setTimeout(updateReportChartImage, 50);

  if (updatePickers) {
    renderItemColorPickers();
  }
}

// 항목별 색상 커스텀 피커 UI 생성
function renderItemColorPickers() {
  const container = document.getElementById("item-color-pickers-container");
  if (!container) return;

  const { labels } = getProcessedChartData();
  if (!labels.length) {
    container.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 8px;">단서 데이터가 비어 있습니다.</div>`;
    return;
  }

  const palette = PALETTES[state.activePalette] || PALETTES.rainbow;
  container.innerHTML = "";

  labels.forEach((label, idx) => {
    const currentColor = state.customItemColors[label] || palette[idx % palette.length];

    const row = document.createElement("div");
    row.className = "item-color-row";

    const labelSpan = document.createElement("span");
    labelSpan.className = "item-color-name";
    labelSpan.textContent = label;
    labelSpan.title = label;

    const controlWrap = document.createElement("div");
    controlWrap.className = "item-color-control";

    const hexCode = document.createElement("span");
    hexCode.className = "item-color-hex";
    hexCode.textContent = currentColor.toUpperCase();

    const input = document.createElement("input");
    input.type = "color";
    input.className = "color-input-native";
    input.value = currentColor;
    input.title = `'${label}' 항목의 그래프 색상 변경`;

    input.addEventListener("input", (e) => {
      const chosen = e.target.value;
      state.customItemColors[label] = chosen;
      hexCode.textContent = chosen.toUpperCase();
      renderChart(false);
    });

    controlWrap.appendChild(hexCode);
    controlWrap.appendChild(input);

    row.appendChild(labelSpan);
    row.appendChild(controlWrap);
    container.appendChild(row);
  });
}

// 학생을 위한 가장 적합한 그래프 선택 조건 & 피드백 판별
function updateGraphRecommendation() {
  const hintTextEl = document.getElementById("detective-hint-text");
  const hintBadgeEl = document.getElementById("detective-hint-badge");
  if (!hintTextEl || !hintBadgeEl) return;

  const labelCol = state.labelColumn.toLowerCase();
  const valCol = state.valueColumn.toLowerCase();

  // 판별 로직:
  // 1) 시계열/연속형 (월, 요일, 일자, 시간, 분, 연도, 회차, 년도) -> 꺾은선 적합
  // 2) 비율/퍼센트/비중 (비율, 비중, %, 점유율, 구성비) -> 원형 적합
  // 3) 범주/항목 간 비교 (이름, 과목, 품목, 항목, 반, 팀, 지역 등) -> 막대 적합

  const isTimeSeries = /월|요일|일|시간|분|연도|년도|주차|회차|date|day|time|month|year/.test(labelCol);
  const isPercentage = /%|비율|비중|점유율|퍼센트|ratio|percent/.test(valCol) || /%|비율/.test(state.chartUnit);
  
  let bestType = 'bar';
  let reasoning = "";

  if (isTimeSeries) {
    bestType = 'line';
    reasoning = `[${state.labelColumn}] 데이터는 시간 흐름이나 연속적인 변화를 나타내므로, 시간에 따른 증감 추세를 한눈에 보는 **'꺾은선 그래프'**가 가장 적합합니다.`;
  } else if (isPercentage) {
    bestType = 'pie';
    reasoning = `[${state.valueColumn}] 데이터는 전체(100%)에서 각 항목이 차지하는 비중을 다루므로, 부분과 전체의 관계를 직관적으로 비교하는 **'원형 그래프'**가 가장 알맞습니다.`;
  } else {
    bestType = 'bar';
    reasoning = `[${state.labelColumn}]별 [${state.valueColumn}]의 크기와 수량을 각각 명확히 비교할 때는 항목 간 차이가 두드러지는 **'막대 그래프'**가 가장 이상적입니다.`;
  }

  const currentType = state.chartType;
  const isMatch = (currentType === bestType);

  if (isMatch) {
    hintBadgeEl.className = "badge-recommend badge-match";
    hintBadgeEl.innerHTML = "🎯 탐정의 판정: 완벽한 그래프 선택!";
    hintTextEl.innerHTML = `학생 탐정님, 훌륭한 추리입니다! ${reasoning}`;
  } else {
    hintBadgeEl.className = "badge-recommend badge-hint";
    hintBadgeEl.innerHTML = `💡 탐정 힌트: '${getChartTypeName(bestType)}' 추천`;
    hintTextEl.innerHTML = `현재 '${getChartTypeName(currentType)}'를 선택하셨습니다. ${reasoning} 필요 시 언제든 다른 그래프로 변경하여 다각도로 단서를 살펴보세요.`;
  }
}

function getChartTypeName(type) {
  if (type === 'line') return '꺾은선 그래프';
  if (type === 'bar') return '막대 그래프';
  if (type === 'pie') return '원형 그래프';
  return '그래프';
}

// ==========================================
// 6. 데이터 분석 & 의미 해석 (기능 3)
// ==========================================
function updateDetectiveAnalysis() {
  const { labels, values } = getProcessedChartData();
  if (values.length === 0) return;

  const count = values.length;
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = sum / count;
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);

  // 최대/최소 항목 라벨 찾기
  const maxIndex = values.indexOf(maxVal);
  const minIndex = values.indexOf(minVal);
  const maxLabel = labels[maxIndex] || "";
  const minLabel = labels[minIndex] || "";

  // 중앙값(Median) 및 사분위수(IQR)
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];
  const iqr = q3 - q1;

  // 분산, 표준편차, 변동계수 (CV %)
  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? (stdDev / avg) * 100 : 0;

  // 상위권 집중도 (Top 2 점유율)
  const top2Sum = sorted.slice(-2).reduce((a, b) => a + b, 0);
  const top2Share = sum > 0 ? (top2Sum / sum) * 100 : 0;

  // 평균 이상 vs 이하 항목 수
  const aboveAvgCount = values.filter(v => v >= avg).length;
  const belowAvgCount = count - aboveAvgCount;

  // UI 기초 통계 카드 업데이트
  const statAvgEl = document.getElementById("stat-avg");
  const statSumEl = document.getElementById("stat-sum");
  const statMaxEl = document.getElementById("stat-max");
  const statMinEl = document.getElementById("stat-min");
  const statCountEl = document.getElementById("stat-count");

  const unit = state.chartUnit ? ` ${state.chartUnit}` : "";

  if (statAvgEl) statAvgEl.textContent = avg.toFixed(1) + unit;
  if (statSumEl) statSumEl.textContent = sum.toLocaleString() + unit;
  if (statMaxEl) statMaxEl.textContent = `${maxVal.toLocaleString()}${unit} (${maxLabel})`;
  if (statMinEl) statMinEl.textContent = `${minVal.toLocaleString()}${unit} (${minLabel})`;
  if (statCountEl) statCountEl.textContent = `${count}개 항목`;

  // UI 보조 심층 통계 업데이트
  const statMedianEl = document.getElementById("stat-median");
  const statIqrEl = document.getElementById("stat-iqr");
  const statCvEl = document.getElementById("stat-cv");
  const statCvDescEl = document.getElementById("stat-cv-desc");
  const statTopShareEl = document.getElementById("stat-top-share");

  if (statMedianEl) statMedianEl.textContent = median.toFixed(1) + unit;
  if (statIqrEl) statIqrEl.textContent = iqr.toFixed(1) + unit;
  if (statCvEl) statCvEl.textContent = `${cv.toFixed(1)}%`;
  if (statTopShareEl) statTopShareEl.textContent = `${top2Share.toFixed(1)}%`;

  if (statCvDescEl) {
    if (cv < 15) {
      statCvDescEl.textContent = "변동성 매우 낮음 (집단 내 수치 균일)";
    } else if (cv <= 35) {
      statCvDescEl.textContent = "변동성 보통 (자연스러운 산포)";
    } else {
      statCvDescEl.textContent = "변동성 높음 (항목 간 큰 편차/양극화)";
    }
  }

  // 최고 vs 최저 격차 및 배수
  const gap = maxVal - minVal;
  const ratio = minVal > 0 ? (maxVal / minVal).toFixed(1) : "N/A";

  // 평균 vs 중앙값 왜곡 진단 (평균의 함정 분석)
  let skewDiagnosis = "";
  if (avg > median * 1.08) {
    skewDiagnosis = `산술평균(${avg.toFixed(1)}${unit})이 중앙값(${median.toFixed(1)}${unit})보다 현저히 높습니다. 이는 일부 상위권의 높은 수치('${maxLabel}' 등)가 전체 평균을 인위적으로 끌어올리는 '평균의 착시(Right-skewed)' 현상이 나타나고 있음을 의미합니다.`;
  } else if (avg < median * 0.92) {
    skewDiagnosis = `산술평균(${avg.toFixed(1)}${unit})이 중앙값(${median.toFixed(1)}${unit})보다 낮습니다. 하위권의 저조한 단서('${minLabel}' 등)가 전체 평균을 깎아내리고 있는 좌측 꼬리(Left-skewed) 분포입니다.`;
  } else {
    skewDiagnosis = `산술평균(${avg.toFixed(1)}${unit})과 중앙값(${median.toFixed(1)}${unit})이 거의 일치하여, 특정 극단값의 왜곡 없이 전반적으로 대칭적이고 균형 잡힌 분포를 나타냅니다.`;
  }

  // 추세 및 변화 흐름 파악
  let trendDetail = "";
  if (values.length >= 3) {
    const firstHalfAvg = values.slice(0, Math.ceil(values.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(values.length / 2);
    const secondHalfAvg = values.slice(Math.floor(values.length / 2)).reduce((a, b) => a + b, 0) / (values.length - Math.floor(values.length / 2));
    const growthRate = firstHalfAvg > 0 ? (((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100).toFixed(1) : 0;

    if (secondHalfAvg > firstHalfAvg * 1.15) {
      trendDetail = `전반부(평균 ${firstHalfAvg.toFixed(1)}${unit}) 대비 후반부(평균 ${secondHalfAvg.toFixed(1)}${unit})가 약 <strong>${growthRate}% 증가</strong>하는 뚜렷한 상승 흐름을 보입니다. 시간의 경과 또는 단계가 진행됨에 따라 단서의 강도가 점진적으로 강화되는 양상입니다.`;
    } else if (secondHalfAvg < firstHalfAvg * 0.85) {
      trendDetail = `전반부(평균 ${firstHalfAvg.toFixed(1)}${unit}) 대비 후반부(평균 ${secondHalfAvg.toFixed(1)}${unit})가 약 <strong>${Math.abs(growthRate)}% 감소</strong>하는 하강 흐름이 관찰됩니다. 후반부로 갈수록 참여나 수치가 둔화되는 원인을 규명할 필요가 있습니다.`;
    } else {
      trendDetail = `전반부(평균 ${firstHalfAvg.toFixed(1)}${unit})와 후반부(평균 ${secondHalfAvg.toFixed(1)}${unit})의 차이가 미미하여, 시기나 순서에 따른 편차 없이 일정한 안정성을 유지하고 있습니다.`;
    }
  } else {
    trendDetail = "표본 단서가 3개 미만으로 장기적인 추세보다는 개별 항목의 절대 비교에 집중해야 합니다.";
  }

  // 이상치(Outlier) 과학적 분석 (IQR 및 표준편차 복합 검증)
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const outliers = [];

  values.forEach((v, i) => {
    if (v < lowerBound || v > upperBound || Math.abs(v - avg) > stdDev * 1.65) {
      outliers.push(`'${labels[i]}' (${v.toLocaleString()}${unit})`);
    }
  });

  const outlierDetail = outliers.length > 0
    ? `통계적 임계 범위를 벗어난 특이 단서 항목이 <strong>${outliers.length}건</strong> 감지되었습니다: ${outliers.join(', ')}. 이 데이터들은 우연한 계기나 특별한 외부 요인이 작용했을 가능성이 높으므로 집중 분석이 필요합니다.`
    : `사분위범위(IQR) 기준 극단적인 이상치 없이 데이터가 허용 신뢰 구간 내에 조화롭게 위치하고 있습니다.`;

  // 다각도 정밀 분석 패널 (5개 심층 분석 카드 생성)
  const comparisonBox = document.getElementById("analysis-comparison-content");
  if (comparisonBox) {
    comparisonBox.innerHTML = `
      <div class="insight-detail-card">
        <div class="insight-card-header">
          <span class="insight-card-tag">분석 1</span>
          <span class="insight-card-title">⚖️ 대표값의 균형과 중심화 경향 (평균 vs 중앙값)</span>
        </div>
        <div class="insight-card-body">
          ${skewDiagnosis} (전체 ${count}개 중 평균 이상 항목: <strong>${aboveAvgCount}개</strong>, 평균 미만 항목: <strong>${belowAvgCount}개</strong>)
        </div>
      </div>

      <div class="insight-detail-card">
        <div class="insight-card-header">
          <span class="insight-card-tag">분석 2</span>
          <span class="insight-card-title">📊 변동성 및 산포도 진단 (변동계수 & IQR 구간)</span>
        </div>
        <div class="insight-card-body">
          표준편차는 <strong>${stdDev.toFixed(1)}${unit}</strong>, 변동계수(CV)는 <strong>${cv.toFixed(1)}%</strong>입니다. 
          데이터의 핵심 50%는 사분위범위 <strong>${q1.toFixed(1)}${unit} ~ ${q3.toFixed(1)}${unit}</strong> (폭 ${iqr.toFixed(1)}${unit}) 사이에 밀집되어 있습니다.
        </div>
      </div>

      <div class="insight-detail-card">
        <div class="insight-card-header">
          <span class="insight-card-tag">분석 3</span>
          <span class="insight-card-title">👑 상위권 점유율 및 항목별 양극화 진단</span>
        </div>
        <div class="insight-card-body">
          최상위 단서 '${maxLabel}'(${maxVal.toLocaleString()}${unit})은(는) 최저 단서 '${minLabel}'(${minVal.toLocaleString()}${unit})보다 <strong>${gap.toLocaleString()}${unit}</strong> 더 많으며, <strong>약 ${ratio}배</strong>에 달합니다. 
          또한 상위 2개 항목이 전체 합계의 <strong>${top2Share.toFixed(1)}%</strong>를 점유하고 있습니다.
        </div>
      </div>

      <div class="insight-detail-card">
        <div class="insight-card-header">
          <span class="insight-card-tag">분석 4</span>
          <span class="insight-card-title">📈 흐름, 순서열 및 구간별 변화율 분석</span>
        </div>
        <div class="insight-card-body">
          ${trendDetail}
        </div>
      </div>

      <div class="insight-detail-card">
        <div class="insight-card-header">
          <span class="insight-card-tag">분석 5</span>
          <span class="insight-card-title">🚨 통계적 이상치(Outlier) 과학 분석</span>
        </div>
        <div class="insight-card-body">
          ${outlierDetail}
        </div>
      </div>
    `;
  }

  // 3. 탐정의 종합 데이터 의미 해석 보고서 (체계적 5단계 내러티브)
  let detailedInterpretation = `[데이터 분석 탐정 종합 분석 보고서]\n\n`;
  
  detailedInterpretation += `■ 1. 사건 개요 및 데이터 규모\n`;
  detailedInterpretation += `수집된 사건 단서는 총 ${count}개 항목으로 구성되어 있으며, 세로축 '${state.valueColumn}'의 총합계는 ${sum.toLocaleString()}${unit}입니다. 전체 항목의 산술평균은 ${avg.toFixed(1)}${unit}, 크기 순 중앙값은 ${median.toFixed(1)}${unit}로 확인되었습니다.\n\n`;

  detailedInterpretation += `■ 2. 중심 경향과 분포 특성 ('평균의 함정' 진단)\n`;
  detailedInterpretation += `${skewDiagnosis}\n항목의 ${aboveAvgCount}개(${(aboveAvgCount/count*100).toFixed(0)}%)가 평균 이상이며, ${belowAvgCount}개(${(belowAvgCount/count*100).toFixed(0)}%)가 평균 이하에 머물러 있습니다. 따라서 정책이나 지표를 세울 때 단순 평균값만 신뢰하기보다는 중앙값(${median.toFixed(1)}${unit})을 함께 고려해야 왜곡된 판단을 방지할 수 있습니다.\n\n`;

  detailedInterpretation += `■ 3. 핵심 단서와 격차 분석\n`;
  detailedInterpretation += `이번 분석에서 가장 주목할 최고치는 '${maxLabel}'(${maxVal.toLocaleString()}${unit})이며, 가장 취약하거나 관심이 필요한 항목은 '${minLabel}'(${minVal.toLocaleString()}${unit})입니다. 최고치와 최저치의 격차는 ${gap.toLocaleString()}${unit}(비율 약 ${ratio}배)로 나타났습니다. 특히 상위 2개 항목이 전체의 ${top2Share.toFixed(1)}%를 점유하고 있어 자원의 쏠림 현상을 유의해야 합니다.\n\n`;

  detailedInterpretation += `■ 4. 원인 가설 및 맥락적 추론\n`;
  detailedInterpretation += `${trendDetail}\n${outlierDetail}\n이러한 결과는 학생들의 활동 시간대, 요일별 학사 일정, 혹은 개인적 관심사의 차이가 직접적인 영향을 미쳤을 가능성이 높습니다.\n\n`;

  detailedInterpretation += `■ 5. 교육적 시사점 및 맞춤형 피드백\n`;
  detailedInterpretation += `1) 벤치마킹 전략: 최상위 항목인 '${maxLabel}'에서 나타난 성공 요인(흥미 유발, 시간 확보 비결 등)을 탐색하여 타 항목으로 확산시킬 필요가 있습니다.\n`;
  detailedInterpretation += `2) 집중 지원 전략: 최하위 항목 '${minLabel}'의 수치가 정체된 원인을 파악하고, 장애 요소를 제거하기 위한 맞춤형 피드백을 제공해야 합니다.\n`;
  detailedInterpretation += `3) 격차 완화: 변동계수(${cv.toFixed(1)}%)를 낮추어 집단 구성원 전반이 고른 성취를 경험할 수 있도록 점진적인 보완 프로그램을 설계하는 것이 바람직합니다.`;

  const interpretationEl = document.getElementById("detective-interpretation-content");
  if (interpretationEl) {
    interpretationEl.textContent = detailedInterpretation;
  }

  // 4. 모둠 토의 질문 3선 생성
  const discussionEl = document.getElementById("detective-discussion-content");
  if (discussionEl) {
    discussionEl.innerHTML = `
      <div class="discussion-item">
        <span class="discussion-q-badge">질문 1</span>
        <div>최고치인 <strong>'${maxLabel}'</strong>과 최저치인 <strong>'${minLabel}'</strong> 사이에 <strong>${gap.toLocaleString()}${unit}</strong>의 격차가 발생한 진짜 까닭은 무엇일까요? 우리 생활 경험과 연계해 토의해봅시다.</div>
      </div>
      <div class="discussion-item">
        <span class="discussion-q-badge">질문 2</span>
        <div>우리 반의 실제 상황을 더 잘 설명해주는 대표값은 <strong>산술평균(${avg.toFixed(1)}${unit})</strong>일까요, 아니면 <strong>중앙값(${median.toFixed(1)}${unit})</strong>일까요? 그 이유는 무엇인가요?</div>
      </div>
      <div class="discussion-item">
        <span class="discussion-q-badge">질문 3</span>
        <div>이 분석 결과를 바탕으로 다음 주 우리 반의 '${state.valueColumn}'을 더 발전시키기 위한 구체적인 <strong>실천 행동 규칙 1가지</strong>를 정한다면 무엇이 좋을까요?</div>
      </div>
    `;
  }

  // 레포트 미리보기 갱신
  updateReportSheetContent({
    count, sum, avg, maxVal, minVal, maxLabel, minLabel, median, cv, top2Share, unit, detailedInterpretation
  });
}

function updateReportSheetContent(stats) {
  const titleDisplay = document.getElementById("report-title-display");
  const dateDisplay = document.getElementById("report-date-display");
  const statsSummary = document.getElementById("report-stats-summary");
  const notesDisplay = document.getElementById("report-notes-display");
  const interpretationDisplay = document.getElementById("report-interpretation-display");

  if (titleDisplay) titleDisplay.textContent = state.caseTitle;
  if (dateDisplay) {
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    dateDisplay.textContent = `분석 기록일자: ${today} | 탐정 파일: ${state.fileName}`;
  }

  if (statsSummary) {
    statsSummary.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 12px 0;">
        <div style="padding: 10px; background: #FFF5F7; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.76rem; color: #DB2777; font-weight: 700;">항목 수</div>
          <div style="font-size: 1.05rem; font-weight: 800;">${stats.count}개</div>
        </div>
        <div style="padding: 10px; background: #FFF5F7; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.76rem; color: #DB2777; font-weight: 700;">산술평균</div>
          <div style="font-size: 1.05rem; font-weight: 800;">${stats.avg.toFixed(1)}${stats.unit}</div>
        </div>
        <div style="padding: 10px; background: #FFF5F7; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.76rem; color: #DB2777; font-weight: 700;">중앙값</div>
          <div style="font-size: 1.05rem; font-weight: 800;">${stats.median ? stats.median.toFixed(1) + stats.unit : '-'}</div>
        </div>
        <div style="padding: 10px; background: #FFF5F7; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.76rem; color: #DB2777; font-weight: 700;">최댓값</div>
          <div style="font-size: 1.05rem; font-weight: 800;">${stats.maxVal.toLocaleString()}${stats.unit}</div>
        </div>
        <div style="padding: 10px; background: #FFF5F7; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.76rem; color: #DB2777; font-weight: 700;">변동계수</div>
          <div style="font-size: 1.05rem; font-weight: 800;">${stats.cv ? stats.cv.toFixed(1) + '%' : '-'}</div>
        </div>
        <div style="padding: 10px; background: #FFF5F7; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.76rem; color: #DB2777; font-weight: 700;">총합계</div>
          <div style="font-size: 1.05rem; font-weight: 800;">${stats.sum.toLocaleString()}${stats.unit}</div>
        </div>
      </div>
    `;
  }

  if (interpretationDisplay) {
    interpretationDisplay.textContent = stats.detailedInterpretation || stats.meaningInterpretation || "";
  }

  if (notesDisplay) {
    notesDisplay.textContent = state.detectiveNotes || "작성된 분석관 의견이 없습니다.";
  }

  // 보고서 내 시각화 증거 카드 메타데이터 동기화
  const chartTitleTag = document.getElementById("report-chart-title-tag");
  if (chartTitleTag) {
    chartTitleTag.textContent = `📈 분석 단서 시각화 증거도 (${state.caseTitle})`;
  }

  const chartTypeBadge = document.getElementById("report-chart-type-badge");
  if (chartTypeBadge) {
    const typeMap = { bar: "막대 그래프", line: "꺾은선 그래프", pie: "원형(파이) 그래프" };
    chartTypeBadge.textContent = typeMap[state.chartType] || "그래프";
  }

  const chartUnitBadge = document.getElementById("report-chart-unit-badge");
  if (chartUnitBadge) {
    chartUnitBadge.textContent = state.chartUnit ? `단위: ${state.chartUnit}` : "단위 미지정";
  }

  const xAxisLabel = document.getElementById("report-chart-xaxis-label");
  if (xAxisLabel) {
    xAxisLabel.textContent = state.labelColumn || "단서 항목";
  }

  const yAxisLabel = document.getElementById("report-chart-yaxis-label");
  if (yAxisLabel) {
    const isMultiY = state.valueColumns && state.valueColumns.length > 1;
    if (isMultiY) {
      yAxisLabel.textContent = `다중 지표: ${state.valueColumns.join(', ')}`;
    } else {
      yAxisLabel.textContent = `${state.valueColumn || "수치 지표"}${state.chartUnit ? ` (${state.chartUnit})` : ""}`;
    }
  }

  // 보고서 내 시각화 그래프 이미지 고해상도 갱신
  updateReportChartImage();
}

// 전역 데이터 레이블 글씨 크기 설정 및 동기화 함수
function setLabelFontSize(newSize) {
  const minSize = 8;
  const maxSize = 32;
  const clampedSize = Math.max(minSize, Math.min(maxSize, parseInt(newSize) || 14));
  state.labelFontSize = clampedSize;

  // 1) 기능 4 레포트 툴바 UI 동기화
  const reportSlider = document.getElementById("report-chart-fontsize-slider");
  const reportDisplay = document.getElementById("report-chart-fontsize-val");
  const reportBtns = document.querySelectorAll(".report-fontsize-btn");

  if (reportSlider) reportSlider.value = clampedSize;
  if (reportDisplay) reportDisplay.textContent = clampedSize + "px";
  reportBtns.forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.size) === clampedSize);
  });

  // 2) 기능 2 시각화 컨트롤 UI 동기화
  const step2Slider = document.getElementById("step2-fontsize-slider");
  const step2Display = document.getElementById("step2-fontsize-display");
  const step2Btns = document.querySelectorAll(".step2-fontsize-btn");

  if (step2Slider) step2Slider.value = clampedSize;
  if (step2Display) step2Display.textContent = clampedSize + "px";
  step2Btns.forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.size) === clampedSize);
  });

  // 3) 차트 즉시 재렌더링 및 레포트 고해상도 이미지 업데이트
  renderChart();
  updateReportChartImage();
}

// ==========================================
// 7-1. 기능 4: 마우스로 그래프 크기 조절 기능
// ==========================================
function setupReportChartMouseResize() {
  const container = document.getElementById("report-chart-resizable-container");
  const handle = document.querySelector(".report-resize-handle");
  const widthSlider = document.getElementById("report-chart-width-slider");
  const widthValDisplay = document.getElementById("report-chart-width-val");
  const resetBtn = document.getElementById("btn-reset-report-chart-size");
  const presetBtns = document.querySelectorAll(".report-size-preset-btn");

  // 레이블 폰트 크기 관련 컨트롤
  const fontSlider = document.getElementById("report-chart-fontsize-slider");
  const fontBtns = document.querySelectorAll(".report-fontsize-btn");

  if (!container) return;

  function applySize(width, height) {
    const minW = 360;
    const maxW = 1050;
    const clampedW = Math.max(minW, Math.min(maxW, width));
    
    container.style.width = clampedW + "px";
    container.style.maxWidth = clampedW + "px";
    
    if (height) {
      const minH = 260;
      const maxH = 800;
      const clampedH = Math.max(minH, Math.min(maxH, height));
      container.style.height = clampedH + "px";
      state.reportChartHeight = clampedH;
    }
    
    state.reportChartWidth = clampedW;

    if (widthSlider) {
      widthSlider.value = clampedW;
    }
    if (widthValDisplay) {
      widthValDisplay.textContent = clampedW + "px";
    }

    // 프리셋 버튼 활성화 상태 동기화
    presetBtns.forEach(btn => {
      const pW = parseInt(btn.dataset.width);
      if (Math.abs(pW - clampedW) < 20) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    updateReportChartImage();
  }

  // 1) 가로폭 슬라이더 마우스 조절
  if (widthSlider) {
    widthSlider.addEventListener("input", (e) => {
      const w = parseInt(e.target.value);
      applySize(w, null);
    });
  }

  // 2) 크기 프리셋 버튼들 (보통, 크게, 최대)
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetW = parseInt(btn.dataset.width);
      const targetH = parseInt(btn.dataset.height);
      applySize(targetW, targetH);
      showToast(`그래프 크기가 [${btn.textContent.trim()}]으로 조절되었습니다.`);
    });
  });

  // 3) 글씨 크기 슬라이더 및 프리셋 버튼 조절
  if (fontSlider) {
    fontSlider.addEventListener("input", (e) => {
      const size = parseInt(e.target.value);
      setLabelFontSize(size);
    });
  }

  fontBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const size = parseInt(btn.dataset.size);
      setLabelFontSize(size);
      showToast(`레이블 글씨 크기가 [${btn.textContent.trim()}]으로 변경되었습니다.`);
    });
  });

  // 4) 기본값 초기화 버튼 (그래프 크기 850px, 레이블 글씨 14px 복원)
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      applySize(850, 450);
      setLabelFontSize(14);
      showToast("그래프 크기와 레이블 글씨 크기가 기본값으로 초기화되었습니다.");
    });
  }

  // 4) 마우스 우측하단 핸들 드래그(drag-to-resize) 조절
  if (handle) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = container.offsetWidth;
      startHeight = container.offsetHeight;
      container.classList.add("is-resizing");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "nwse-resize";
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newWidth = startWidth + deltaX;
      const newHeight = startHeight + deltaY;
      applySize(newWidth, newHeight);
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        container.classList.remove("is-resizing");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        updateReportChartImage();
      }
    });

    // 터치 디바이스 지원
    handle.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        isDragging = true;
        startX = touch.clientX;
        startY = touch.clientY;
        startWidth = container.offsetWidth;
        startHeight = container.offsetHeight;
        container.classList.add("is-resizing");
      }
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      applySize(startWidth + deltaX, startHeight + deltaY);
    }, { passive: true });

    window.addEventListener("touchend", () => {
      if (isDragging) {
        isDragging = false;
        container.classList.remove("is-resizing");
        updateReportChartImage();
      }
    });
  }

  // 5) 브라우저 기본 CSS resize 이벤트 감지 (ResizeObserver)
  if (window.ResizeObserver) {
    const ro = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0 && Math.abs(cr.width - state.reportChartWidth) > 10) {
          state.reportChartWidth = Math.round(cr.width);
          state.reportChartHeight = Math.round(cr.height);
          if (widthSlider) widthSlider.value = state.reportChartWidth;
          if (widthValDisplay) widthValDisplay.textContent = state.reportChartWidth + "px";
        }
      }
    });
    ro.observe(container);
  }
}

// ==========================================
// 7. 레포트 저장 및 출력 (기능 4)
// ==========================================

// 1. PDF 레포트 다운로드 (html2pdf 지원 및 인쇄 모드 지원)
function exportReportPdf() {
  const reportElement = document.getElementById("printable-report-sheet");
  if (!reportElement) return;

  showToast("📄 PDF 탐정 분석 보고서를 생성하는 중입니다...");

  // PDF 출력 직전 최신 고해상도 차트 이미지 동기화
  updateReportChartImage();

  if (typeof html2pdf !== 'undefined') {
    const opt = {
      margin: [8, 8, 8, 8],
      filename: `${state.caseTitle.replace(/\s+/g, '_')}_탐정보고서.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    html2pdf().set(opt).from(reportElement).save().then(() => {
      showToast("✅ PDF 레포트 다운로드가 완료되었습니다!");
    }).catch(err => {
      console.warn("html2pdf 오류, 브라우저 기본 인쇄로 대체:", err);
      window.print();
    });
  } else {
    window.print();
  }
}

// 2. 그래프만 따로 이미지(PNG)로 저장
function saveChartAsImage() {
  if (!mainChart) {
    showToast("저장할 그래프가 없습니다.", true);
    return;
  }
  try {
    const imgUrl = mainChart.toBase64Image('image/png', 1.0);
    const link = document.createElement("a");
    link.download = `${state.caseTitle}_${state.chartType}_그래프.png`;
    link.href = imgUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📊 그래프 이미지가 PNG 파일로 다운로드되었습니다!");
  } catch (err) {
    showToast("그래프 이미지 저장 중 오류가 발생했습니다.", true);
  }
}

// 3. 텍스트 데이터 분석 복사 (클립보드)
function copyAnalysisText() {
  const interpretationEl = document.getElementById("detective-interpretation-content");
  if (!interpretationEl) return;

  let fullAnalysisText = `[데이터 분석 탐정 - 분석 레포트 요약]\n`;
  fullAnalysisText += `사건명: ${state.caseTitle}\n`;
  fullAnalysisText += `단서 파일: ${state.fileName}\n`;
  fullAnalysisText += `----------------------------------------\n`;
  fullAnalysisText += interpretationEl.textContent + `\n`;
  fullAnalysisText += `----------------------------------------\n`;
  fullAnalysisText += `[분석관 특별 소견]\n${state.detectiveNotes}\n`;

  navigator.clipboard.writeText(fullAnalysisText).then(() => {
    showToast("📋 데이터 분석 텍스트가 클립보드에 복사되었습니다!");
  }).catch(() => {
    // 대체 복사
    const textarea = document.createElement("textarea");
    textarea.value = fullAnalysisText;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showToast("📋 데이터 분석 텍스트가 복사되었습니다!");
  });
}

// ==========================================
// 8. Firebase Firestore 저장 & 불러오기
// ==========================================
async function saveToFirebase() {
  const reportData = {
    caseTitle: state.caseTitle,
    fileName: state.fileName,
    headers: state.headers,
    rows: state.rows,
    chartType: state.chartType,
    chartUnit: state.chartUnit,
    labelColumn: state.labelColumn,
    valueColumn: state.valueColumn,
    detectiveNotes: state.detectiveNotes,
    savedAt: new Date().toISOString()
  };

  if (isFirebaseActive && db) {
    try {
      showToast("☁️ Firebase Firestore에 저장하는 중...");
      await db.collection("detective_reports").add(reportData);
      showToast("🎉 Firestore [detective_reports] 컬렉션에 성공적으로 보관되었습니다!");
      return;
    } catch (err) {
      console.error("Firestore 저장 실패:", err);
      showToast("Firestore 저장 중 오류 발생. 로컬 스토리지에 백업 저장합니다.", true);
    }
  }

  // 로컬 스토리지 모드 폴백
  saveToLocalStorage(reportData);
  showToast("💾 브라우저 로컬 저장소에 레포트가 안전하게 저장되었습니다! (Firebase 키 설정 시 클라우드 연동 가능)");
}

function saveToLocalStorage(reportData) {
  try {
    const list = JSON.parse(localStorage.getItem("detective_reports_cache") || "[]");
    list.unshift(reportData);
    if (list.length > 20) list.pop(); // 최근 20개 유지
    localStorage.setItem("detective_reports_cache", JSON.stringify(list));
  } catch (e) {
    console.warn("로컬 스토리지 저장 오류:", e);
  }
}

async function openLoadReportsModal() {
  const modal = document.getElementById("load-reports-modal");
  const listContainer = document.getElementById("reports-list-container");
  if (!modal || !listContainer) return;

  modal.style.display = "flex";
  listContainer.innerHTML = "<p style='color: var(--text-muted); text-align: center;'>저장된 탐정 보고서를 검색하는 중...</p>";

  let reports = [];

  if (isFirebaseActive && db) {
    try {
      const snapshot = await db.collection("detective_reports").orderBy("savedAt", "desc").limit(15).get();
      snapshot.forEach(doc => {
        reports.push({ id: doc.id, ...doc.data(), source: 'Firestore' });
      });
    } catch (e) {
      console.warn("Firestore 불러오기 실패, 로컬 캐시 조회:", e);
    }
  }

  // 로컬 스토리지에서도 합치기
  try {
    const localList = JSON.parse(localStorage.getItem("detective_reports_cache") || "[]");
    localList.forEach((item, idx) => {
      reports.push({ id: 'local_' + idx, ...item, source: '로컬 브라우저' });
    });
  } catch (e) {}

  if (reports.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-muted);">
        <div style="font-size: 32px; margin-bottom: 8px;">📂</div>
        <p>저장된 탐정 분석 보고서가 아직 없습니다.</p>
        <p style="font-size: 0.85rem; margin-top: 4px;">상단의 'Firebase/로컬에 저장' 버튼으로 현재 분석을 보관해보세요.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = "";
  reports.forEach(report => {
    const item = document.createElement("div");
    item.style.cssText = "padding: 12px 14px; border: 1px solid var(--pink-200); border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; background: #FFF5F7;";

    const info = document.createElement("div");
    info.innerHTML = `
      <div style="font-weight: 700; color: var(--pink-800); font-size: 0.95rem;">${report.caseTitle}</div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">저장위치: ${report.source} | 일시: ${new Date(report.savedAt).toLocaleString()}</div>
    `;

    const loadBtn = document.createElement("button");
    loadBtn.className = "btn btn-sm btn-primary";
    loadBtn.textContent = "불러오기";
    loadBtn.addEventListener("click", () => {
      loadSavedReport(report);
      closeModal("load-reports-modal");
      showToast(`'${report.caseTitle}' 보고서를 성공적으로 불러왔습니다!`);
    });

    item.appendChild(info);
    item.appendChild(loadBtn);
    listContainer.appendChild(item);
  });
}

function loadSavedReport(report) {
  state.caseTitle = report.caseTitle || state.caseTitle;
  state.fileName = report.fileName || state.fileName;
  state.headers = report.headers || [];
  state.rows = report.rows || [];
  state.chartType = report.chartType || 'bar';
  state.chartUnit = report.chartUnit || '';
  state.labelColumn = report.labelColumn || state.headers[0];
  state.valueColumn = report.valueColumn || state.headers[1];
  state.detectiveNotes = report.detectiveNotes || '';

  const titleInput = document.getElementById("case-title-input");
  if (titleInput) titleInput.value = state.caseTitle;

  const notesInput = document.getElementById("detective-notes-input");
  if (notesInput) notesInput.value = state.detectiveNotes;

  const unitInput = document.getElementById("chart-unit-input");
  if (unitInput) unitInput.value = state.chartUnit;

  document.querySelectorAll(".graph-type-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === state.chartType);
  });

  populateColumnSelectors();
  renderDataTable();
  renderChart();
  updateGraphRecommendation();
  updateDetectiveAnalysis();
}

// ==========================================
// 9. Firebase 설정 팝업 및 도움말
// ==========================================
function openFirebaseModal() {
  const modal = document.getElementById("firebase-help-modal");
  if (modal) modal.style.display = "flex";
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}

// 토스트 메시지
function showToast(message, isError = false) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  if (isError) {
    toast.style.borderLeftColor = "#EF4444";
  }
  toast.innerHTML = `<span>${isError ? '⚠️' : '🔍'}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
