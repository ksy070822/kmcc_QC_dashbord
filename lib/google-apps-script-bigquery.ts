/**
 * Google Apps Script - BigQuery 연동용
 * 이 코드를 구글 시트 > 도구 > Apps Script에 붙여넣으세요
 *
 * 구글 시트: https://docs.google.com/spreadsheets/d/14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o
 * 시트: 용산, 광주
 */
export const appsScriptForBigQuery = `
/**
 * QC 품질관리 - BigQuery 연동 Google Apps Script
 *
 * 설정 방법:
 * 1. 구글 시트에서 도구 > Apps Script 클릭
 * 2. 아래 코드 전체를 복사하여 붙여넣기
 * 3. WEBAPP_URL을 실제 배포된 URL로 변경
 * 4. RAW_DATA_SHEETS의 시트 이름을 확인/수정
 * 5. 저장 후 onOpen 함수 실행 (최초 1회)
 */

// ============== 설정 영역 ==============
// Vercel 배포 후 실제 URL로 변경하세요
const WEBAPP_URL = "https://your-app.vercel.app/api/bigquery-sync";

// 용산, 광주 시트 이름 (실제 시트 이름과 일치해야 함)
const RAW_DATA_SHEETS = ["용산", "광주"];

// 배치 크기 (한 번에 전송할 행 수, 대량 데이터 시 조정)
const BATCH_SIZE = 500;

// ============== 메뉴 설정 ==============
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📊 QC BigQuery")
    .addItem("🔄 BigQuery로 전체 동기화", "syncAllToBigQuery")
    .addItem("🔄 용산 데이터만 동기화", "syncYongsanToBigQuery")
    .addItem("🔄 광주 데이터만 동기화", "syncGwangjuToBigQuery")
    .addSeparator()
    .addItem("🗑️ BigQuery 데이터 초기화 후 전체 동기화", "resetAndSyncAll")
    .addSeparator()
    .addItem("⚙️ BigQuery 테이블 초기화", "initBigQuery")
    .addItem("🔗 연결 테스트", "testConnection")
    .addItem("⏰ 자동 동기화 설정 (15분마다)", "setupAutoSync")
    .addItem("❌ 자동 동기화 중지", "removeAutoSync")
    .addToUi();
}

// ============== 데이터 읽기 함수 ==============
/**
 * 시트에서 데이터 읽기
 * @param {string} sheetName - 시트 이름
 * @returns {Object} - { sheet, headers, rows }
 */
function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("시트를 찾을 수 없음: " + sheetName);
    return null;
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log("데이터가 없음: " + sheetName);
    return null;
  }

  return {
    sheet: sheetName,
    headers: data[0],
    rows: data.slice(1).filter(row => row.some(cell => cell !== "" && cell !== null))
  };
}

/**
 * 모든 시트 데이터 읽기
 */
function getAllSheetsData() {
  const allData = [];

  for (const sheetName of RAW_DATA_SHEETS) {
    const sheetData = getSheetData(sheetName);
    if (sheetData && sheetData.rows.length > 0) {
      allData.push(sheetData);
      Logger.log("시트 로드: " + sheetName + " (" + sheetData.rows.length + "행)");
    }
  }

  return allData;
}

// ============== 동기화 함수 ==============
/**
 * 데이터를 BigQuery API로 전송
 */
function sendToBigQuery(data, reset = false) {
  const payload = {
    timestamp: new Date().toISOString(),
    data: data,
    reset: reset
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: 120 // 2분 타임아웃
  };

  try {
    Logger.log("BigQuery API 호출 시작...");
    const response = UrlFetchApp.fetch(WEBAPP_URL, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log("응답 코드: " + statusCode);
    Logger.log("응답 내용: " + responseText.substring(0, 500));

    if (statusCode === 200) {
      const result = JSON.parse(responseText);
      return result;
    } else {
      throw new Error("API 오류 (코드: " + statusCode + "): " + responseText);
    }
  } catch (error) {
    Logger.log("전송 오류: " + error);
    throw error;
  }
}

/**
 * 전체 데이터 동기화
 */
function syncAllToBigQuery() {
  const ui = SpreadsheetApp.getUi();

  try {
    ui.alert("동기화 시작", "BigQuery로 데이터를 전송합니다...\\n잠시 기다려주세요.", ui.ButtonSet.OK);

    const data = getAllSheetsData();

    if (data.length === 0) {
      ui.alert("오류", "동기화할 데이터가 없습니다.", ui.ButtonSet.OK);
      return;
    }

    const totalRows = data.reduce((sum, d) => sum + d.rows.length, 0);
    Logger.log("총 " + totalRows + "행 전송 시작");

    const result = sendToBigQuery(data, false);

    const message = "✅ 동기화 완료!\\n\\n" +
      "처리된 시트: " + result.summary.sheetsProcessed + "개\\n" +
      "총 행 수: " + result.summary.totalRows + "\\n" +
      "BigQuery 삽입: " + result.summary.evaluationsInserted + "건\\n" +
      "상담사 업데이트: " + result.summary.agentsUpserted + "명\\n" +
      "소요 시간: " + result.summary.duration;

    ui.alert("동기화 완료", message, ui.ButtonSet.OK);
    appendLog("성공", message);

  } catch (error) {
    ui.alert("동기화 실패", "오류: " + error.toString(), ui.ButtonSet.OK);
    appendLog("실패", error.toString());
  }
}

/**
 * 용산 데이터만 동기화
 */
function syncYongsanToBigQuery() {
  const ui = SpreadsheetApp.getUi();

  try {
    const sheetData = getSheetData("용산");
    if (!sheetData) {
      ui.alert("오류", "'용산' 시트를 찾을 수 없습니다.", ui.ButtonSet.OK);
      return;
    }

    const result = sendToBigQuery([sheetData], false);

    ui.alert("동기화 완료", "✅ 용산 데이터 동기화 완료\\n" +
      "삽입된 행: " + result.summary.evaluationsInserted, ui.ButtonSet.OK);
    appendLog("성공 (용산)", result.summary.evaluationsInserted + "건");

  } catch (error) {
    ui.alert("동기화 실패", "오류: " + error.toString(), ui.ButtonSet.OK);
    appendLog("실패 (용산)", error.toString());
  }
}

/**
 * 광주 데이터만 동기화
 */
function syncGwangjuToBigQuery() {
  const ui = SpreadsheetApp.getUi();

  try {
    const sheetData = getSheetData("광주");
    if (!sheetData) {
      ui.alert("오류", "'광주' 시트를 찾을 수 없습니다.", ui.ButtonSet.OK);
      return;
    }

    const result = sendToBigQuery([sheetData], false);

    ui.alert("동기화 완료", "✅ 광주 데이터 동기화 완료\\n" +
      "삽입된 행: " + result.summary.evaluationsInserted, ui.ButtonSet.OK);
    appendLog("성공 (광주)", result.summary.evaluationsInserted + "건");

  } catch (error) {
    ui.alert("동기화 실패", "오류: " + error.toString(), ui.ButtonSet.OK);
    appendLog("실패 (광주)", error.toString());
  }
}

/**
 * BigQuery 데이터 초기화 후 전체 동기화
 */
function resetAndSyncAll() {
  const ui = SpreadsheetApp.getUi();

  const confirm = ui.alert(
    "⚠️ 주의",
    "BigQuery의 모든 기존 데이터를 삭제하고 다시 동기화합니다.\\n계속하시겠습니까?",
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    return;
  }

  try {
    const data = getAllSheetsData();

    if (data.length === 0) {
      ui.alert("오류", "동기화할 데이터가 없습니다.", ui.ButtonSet.OK);
      return;
    }

    const result = sendToBigQuery(data, true); // reset = true

    ui.alert("초기화 및 동기화 완료", "✅ BigQuery 데이터가 초기화되고 새로 동기화되었습니다.\\n" +
      "삽입된 행: " + result.summary.evaluationsInserted, ui.ButtonSet.OK);
    appendLog("초기화 후 동기화 성공", result.summary.evaluationsInserted + "건");

  } catch (error) {
    ui.alert("실패", "오류: " + error.toString(), ui.ButtonSet.OK);
    appendLog("초기화 후 동기화 실패", error.toString());
  }
}

// ============== 유틸리티 함수 ==============
/**
 * BigQuery 테이블 초기화 (데이터셋/테이블 생성)
 */
function initBigQuery() {
  const ui = SpreadsheetApp.getUi();

  try {
    const response = UrlFetchApp.fetch(WEBAPP_URL + "?action=init", {
      method: "get",
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (result.success) {
      ui.alert("초기화 완료", "✅ " + result.message, ui.ButtonSet.OK);
    } else {
      ui.alert("초기화 실패", "❌ " + result.message, ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert("오류", error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * 연결 테스트
 */
function testConnection() {
  const ui = SpreadsheetApp.getUi();

  try {
    const response = UrlFetchApp.fetch(WEBAPP_URL, {
      method: "get",
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (statusCode === 200 && result.success) {
      ui.alert("✅ 연결 성공", "BigQuery API와 정상 연결되었습니다.\\n\\nURL: " + WEBAPP_URL, ui.ButtonSet.OK);
    } else {
      ui.alert("❌ 연결 실패", "상태 코드: " + statusCode + "\\n응답: " + JSON.stringify(result), ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert("❌ 연결 오류", error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * 자동 동기화 설정 (15분마다)
 */
function setupAutoSync() {
  // 기존 트리거 삭제
  removeAutoSync();

  // 15분마다 동기화
  ScriptApp.newTrigger("autoSyncToBigQuery")
    .timeBased()
    .everyMinutes(15)
    .create();

  SpreadsheetApp.getUi().alert("✅ 자동 동기화 설정 완료", "15분마다 BigQuery로 자동 동기화됩니다.", SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 자동 동기화 중지
 */
function removeAutoSync() {
  const triggers = ScriptApp.getProjectTriggers();

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "autoSyncToBigQuery") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  SpreadsheetApp.getUi().alert("❌ 자동 동기화 중지됨", "자동 동기화가 비활성화되었습니다.", SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 자동 동기화 실행 (트리거용)
 */
function autoSyncToBigQuery() {
  try {
    const data = getAllSheetsData();
    if (data.length === 0) {
      Logger.log("자동 동기화: 데이터 없음");
      return;
    }

    const result = sendToBigQuery(data, false);
    Logger.log("자동 동기화 완료: " + result.summary.evaluationsInserted + "건");
    appendLog("자동 동기화 성공", result.summary.evaluationsInserted + "건");

  } catch (error) {
    Logger.log("자동 동기화 실패: " + error);
    appendLog("자동 동기화 실패", error.toString());
  }
}

/**
 * 동기화 로그 기록
 */
function appendLog(status, message) {
  let logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("📋 BigQuery 로그");

  if (!logSheet) {
    logSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("📋 BigQuery 로그");
    logSheet.appendRow(["시간", "상태", "메시지"]);
    logSheet.getRange("1:1").setFontWeight("bold");
  }

  logSheet.appendRow([new Date(), status, message]);

  // 최대 1000행 유지
  const lastRow = logSheet.getLastRow();
  if (lastRow > 1000) {
    logSheet.deleteRows(2, lastRow - 1000);
  }
}

/**
 * ===== 시트 구조 안내 =====
 *
 * 이 스크립트는 다음 시트를 읽습니다:
 *
 * 1. "용산" 시트 (용산 센터 QC 데이터)
 * 2. "광주" 시트 (광주 센터 QC 데이터)
 *
 * 필수 컬럼:
 * - 서비스: 택시, 대리, 퀵 등
 * - 채널: 유선, 채팅
 * - 이름: 상담사 이름
 * - ID: 상담사 ID
 * - 입사일: 입사일자
 * - 근속개월: 근속 기간 (개월)
 * - 평가회차: 평가 회차
 * - 평가일: 평가 날짜 (YYYY-MM-DD 형식 권장)
 * - 상담ID: 상담 고유 ID
 * - 16개 평가항목 (Y/N):
 *   - 첫인사끝인사누락
 *   - 공감표현누락
 *   - 사과표현누락
 *   - 추가문의누락
 *   - 불친절
 *   - 상담유형오설정
 *   - 가이드미준수
 *   - 본인확인누락
 *   - 필수탐색누락
 *   - 오안내
 *   - 전산처리누락
 *   - 전산처리미흡정정
 *   - 전산조작미흡오류
 *   - 콜픽트립ID매핑누락오기재
 *   - 플래그키워드누락오기재
 *   - 상담이력기재미흡
 * - 항목별오류건: 총 오류 수
 * - 태도미흡: 태도 관련 오류 수
 * - 오상담오처리: 업무 관련 오류 수
 */
`;

export default appsScriptForBigQuery;
