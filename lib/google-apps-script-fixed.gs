// ============================================
// QC 관리 시스템 - Google Apps Script (수정 버전)
// 용산/광주 센터 로우 데이터 동기화
// ============================================

// 설정값
const WEBAPP_URL = 'https://kmcc-qc-dashbord.vercel.app/api/sync'; // ⚠️ /api/sync 경로 추가 필수!

const YONGSAN_SHEET = '용산';
const GWANGJU_SHEET = '광주';

// 평가 항목 16개 (컬럼 순서)
const EVAL_ITEMS = [
  '첫인사/끝인사 누락',
  '공감표현 누락',
  '사과표현 누락',
  '추가문의 누락',
  '불친절',
  '상담유형 오설정',
  '가이드 미준수',
  '본인확인 누락',
  '필수탐색 누락',
  '오안내',
  '전산 처리 누락',
  '전산 처리 미흡/정정',
  '전산 조작 미흡/오류',
  '콜/픽/트립ID 매핑누락&오기재',
  '플래그/키워드 누락&오기재',
  '상담이력 기재 미흡'
];

// 태도 항목 인덱스 (앞 5개)
const ATTITUDE_INDICES = [0, 1, 2, 3, 4];

// 업무 항목 인덱스 (뒤 11개)
const BUSINESS_INDICES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/**
 * 메뉴 추가
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('QC 대시보드')
    .addItem('지금 동기화', 'syncData')
    .addItem('연결 테스트', 'testConnection')
    .addToUi();
}

/**
 * 데이터 동기화 - 배치 전송으로 로우 데이터를 웹앱으로 전송
 */
function syncData() {
  try {
    Logger.log('[v0] ===== 동기화 시작 =====');
    
    // 용산 데이터 읽기
    const yonsanData = readSheetData(YONGSAN_SHEET, '용산');
    Logger.log(`[v0] 용산 데이터: ${yonsanData.length}건`);
    
    // 광주 데이터 읽기
    const gwangjuData = readSheetData(GWANGJU_SHEET, '광주');
    Logger.log(`[v0] 광주 데이터: ${gwangjuData.length}건`);
    
    const totalRecords = yonsanData.length + gwangjuData.length;
    Logger.log(`[v0] 총 데이터: ${totalRecords}건`);
    
    // 배치 전송 (각 배치는 최대 2MB로 제한 - Vercel 제한 고려)
    const BATCH_SIZE = 1000; // 한 번에 전송할 레코드 수 (더 작게 설정)
    const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024; // 2MB (안전 마진)
    
    let totalProcessed = 0;
    let batchNumber = 0;
    
    // 용산 데이터 배치 전송
    for (let i = 0; i < yonsanData.length; i += BATCH_SIZE) {
      batchNumber++;
      const batch = yonsanData.slice(i, i + BATCH_SIZE);
      const payload = {
        batch: batchNumber,
        isLast: false,
        timestamp: new Date().toISOString(),
        yonsan: batch,
        gwangju: [],
        totalRecords: totalRecords,
        processedSoFar: totalProcessed
      };
      
      const payloadSize = JSON.stringify(payload).length;
      Logger.log(`[v0] 배치 ${batchNumber} (용산): ${batch.length}건, 크기: ${(payloadSize / 1024).toFixed(2)}KB`);
      Logger.log(`[v0] 페이로드 구조: batch=${payload.batch}, yonsan.length=${payload.yonsan.length}, gwangju.length=${payload.gwangju.length}`);
      
      if (payloadSize > MAX_PAYLOAD_SIZE) {
        // 배치가 너무 크면 더 작게 나눔
        const smallerBatch = Math.floor(BATCH_SIZE / 2);
        Logger.log(`[v0] 배치 크기 조정: ${BATCH_SIZE} -> ${smallerBatch}`);
        i -= BATCH_SIZE; // 현재 배치 다시 처리
        continue;
      }
      
      const response = sendToWebApp(payload);
      totalProcessed += batch.length;
      Logger.log(`[v0] 배치 ${batchNumber} 완료: ${response}`);
      
      // API 호출 제한을 피하기 위해 짧은 대기
      Utilities.sleep(100);
    }
    
    // 광주 데이터 배치 전송
    for (let i = 0; i < gwangjuData.length; i += BATCH_SIZE) {
      batchNumber++;
      const batch = gwangjuData.slice(i, i + BATCH_SIZE);
      const isLast = (i + BATCH_SIZE >= gwangjuData.length);
      
      const payload = {
        batch: batchNumber,
        isLast: isLast,
        timestamp: new Date().toISOString(),
        yonsan: [],
        gwangju: batch,
        totalRecords: totalRecords,
        processedSoFar: totalProcessed
      };
      
      const payloadSize = JSON.stringify(payload).length;
      Logger.log(`[v0] 배치 ${batchNumber} (광주): ${batch.length}건, 크기: ${(payloadSize / 1024).toFixed(2)}KB`);
      
      if (payloadSize > MAX_PAYLOAD_SIZE) {
        const smallerBatch = Math.floor(BATCH_SIZE / 2);
        Logger.log(`[v0] 배치 크기 조정: ${BATCH_SIZE} -> ${smallerBatch}`);
        i -= BATCH_SIZE;
        continue;
      }
      
      const response = sendToWebApp(payload);
      totalProcessed += batch.length;
      Logger.log(`[v0] 배치 ${batchNumber} 완료: ${response}`);
      
      Utilities.sleep(100);
    }
    
    Logger.log(`[v0] ===== 동기화 완료: 총 ${totalProcessed}건 처리 =====`);
    
    const successMessage = `✅ 동기화 완료!\n총 ${totalProcessed}건 처리됨\n${batchNumber}개 배치 전송`;
    
    // UI는 시트 메뉴에서 실행할 때만 표시
    try {
      SpreadsheetApp.getUi().alert(successMessage);
    } catch (uiError) {
      Logger.log('[v0] UI 알림 스킵 (에디터에서 실행 중)');
    }
  } catch (e) {
    Logger.log('[v0] ❌ 오류: ' + e.message);
    Logger.log('[v0] 스택: ' + e.stack);
    
    // UI는 시트 메뉴에서 실행할 때만 표시
    try {
      SpreadsheetApp.getUi().alert('❌ 오류 발생\n' + e.message);
    } catch (uiError) {
      Logger.log('[v0] UI 알림 스킵 (에디터에서 실행 중)');
    }
  }
}

/**
 * 시트에서 데이터 읽기
 */
function readSheetData(sheetName, center) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(sheetName + ' 시트를 찾을 수 없습니다.');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const records = [];
  
  // 헤더 인덱스 찾기
  const nameIdx = headers.indexOf('이름');
  const idIdx = headers.indexOf('ID');
  const serviceIdx = headers.indexOf('서비스');
  const channelIdx = headers.indexOf('채널');
  const hireIdx = headers.indexOf('입사일');
  const evalDateIdx = headers.indexOf('평가일');
  const evalIdIdx = headers.indexOf('평가회차');
  
  // 데이터 행 순회 (헤더 제외)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // 빈 행 스킵
    if (!row[nameIdx]) continue;
    
    // 평가일 날짜 형식 통일 (YYYY-MM-DD)
    // 구글 시트에서 날짜 서식으로 지정된 경우 Date 객체로 읽힘
    let evalDate = '';
    if (row[evalDateIdx]) {
      try {
        const dateValue = row[evalDateIdx];
        let dateObj;
        
        // 이미 Date 객체인 경우 (날짜 서식으로 지정된 경우)
        if (dateValue instanceof Date) {
          dateObj = dateValue;
        }
        // 문자열인 경우 파싱
        else if (typeof dateValue === 'string') {
          const dateStr = dateValue.trim();
          
          // "2025. 12. 16" 형식 처리 (점과 공백 포함)
          if (dateStr.includes('.')) {
            const parts = dateStr.split('.').map(p => p.trim()).filter(p => p);
            if (parts.length >= 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const day = parseInt(parts[2], 10);
              dateObj = new Date(year, month - 1, day);
            } else {
              dateObj = new Date(dateStr);
            }
          }
          // "12/16" 또는 "2024/12/16" 형식 처리
          else if (dateStr.includes('/')) {
            const parts = dateStr.split('/').map(p => p.trim());
            if (parts.length === 2) {
              // "12/16" 형식 -> 올해 12월 16일
              const month = parseInt(parts[0], 10);
              const day = parseInt(parts[1], 10);
              const year = new Date().getFullYear();
              dateObj = new Date(year, month - 1, day);
            } else if (parts.length === 3) {
              // "2024/12/16" 형식
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const day = parseInt(parts[2], 10);
              dateObj = new Date(year, month - 1, day);
            } else {
              dateObj = new Date(dateStr);
            }
          }
          // "2024-12-16" 형식
          else if (dateStr.includes('-')) {
            dateObj = new Date(dateStr);
          }
          // 기타 형식
          else {
            dateObj = new Date(dateStr);
          }
        }
        // 숫자 타임스탬프인 경우
        else if (typeof dateValue === 'number') {
          dateObj = new Date(dateValue);
        }
        // 그 외의 경우
        else {
          dateObj = new Date(dateValue);
        }
        
        // 유효한 날짜인지 확인
        if (isNaN(dateObj.getTime())) {
          Logger.log(`[v0] 잘못된 날짜 형식: ${dateValue} (행 ${i + 1})`);
          continue; // 날짜가 유효하지 않으면 스킵
        }
        
        // YYYY-MM-DD 형식으로 변환
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        evalDate = `${year}-${month}-${day}`;
        
        Logger.log(`[v0] 날짜 변환: ${dateValue} -> ${evalDate} (행 ${i + 1})`);
      } catch (e) {
        Logger.log(`[v0] 날짜 파싱 오류: ${row[evalDateIdx]} (행 ${i + 1}): ${e.message}`);
        continue; // 날짜 파싱 실패 시 스킵
      }
    }
    
    // 평가일이 없으면 스킵
    if (!evalDate) {
      continue;
    }
    
    // 근속 기간 계산
    const hireDate = new Date(row[hireIdx]);
    const tenure = calculateTenure(hireDate);
    
    // 평가 항목 수집
    const evalItems = [];
    let attitudeErrors = 0;
    let businessErrors = 0;
    
    for (let j = 0; j < EVAL_ITEMS.length; j++) {
      const itemIdx = nameIdx + 5 + j; // 평가 항목은 기본정보 5개 이후
      const value = row[itemIdx] === 'Y' || row[itemIdx] === 1 ? 1 : 0;
      evalItems.push(value);
      
      if (ATTITUDE_INDICES.includes(j)) {
        attitudeErrors += value;
      }
      if (BUSINESS_INDICES.includes(j)) {
        businessErrors += value;
      }
    }
    
    records.push({
      center: center,
      name: row[nameIdx],
      id: row[idIdx],
      service: row[serviceIdx],
      channel: row[channelIdx],
      hireDate: row[hireIdx],
      tenure: tenure,
      evalDate: evalDate, // 통일된 날짜 형식 사용
      evalId: row[evalIdIdx],
      evaluationItems: evalItems,
      attitudeErrors: attitudeErrors,
      businessErrors: businessErrors,
      totalErrors: attitudeErrors + businessErrors,
      timestamp: new Date().toISOString()
    });
  }
  
  return records;
}

/**
 * 근속 기간 계산
 */
function calculateTenure(hireDate) {
  const today = new Date();
  const months = (today.getFullYear() - hireDate.getFullYear()) * 12 + 
                 (today.getMonth() - hireDate.getMonth());
  
  if (months < 3) return '3개월 미만';
  if (months < 6) return '3개월 이상';
  if (months < 12) return '6개월 이상';
  return '12개월 이상';
}

/**
 * 웹앱으로 데이터 전송 (수정 버전)
 */
function sendToWebApp(payload) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true // HTTP 에러도 예외로 던지지 않음
    };
    
    Logger.log('[v0] 웹앱 URL: ' + WEBAPP_URL);
    Logger.log('[v0] 페이로드 크기: ' + JSON.stringify(payload).length + ' bytes');
    
    const response = UrlFetchApp.fetch(WEBAPP_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('[v0] 응답 코드: ' + responseCode);
    Logger.log('[v0] 응답 본문 (처음 200자): ' + responseText.substring(0, 200));
    
    // 응답 코드 확인
    if (responseCode !== 200) {
      // 에러 응답 파싱 시도
      let errorMessage = 'HTTP ' + responseCode + ' 오류';
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch (e) {
        // JSON이 아니면 원본 텍스트 사용 (처음 500자만)
        errorMessage = responseText.substring(0, 500);
      }
      throw new Error(errorMessage);
    }
    
    // 성공 응답 파싱
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      Logger.log('[v0] JSON 파싱 실패: ' + parseError.message);
      Logger.log('[v0] 응답 본문: ' + responseText);
      throw new Error('서버 응답이 유효한 JSON이 아닙니다: ' + responseText.substring(0, 100));
    }
    
    // 응답 형식 확인
    if (result.success === false) {
      throw new Error(result.error || '서버에서 오류를 반환했습니다');
    }
    
    // 성공 메시지 반환
    if (result.batch) {
      // 배치 응답
      const batchInfo = result.batch;
      return `배치 ${batchInfo.batchNumber}: ${batchInfo.currentBatch.evaluations}건 처리 (전체 진행: ${batchInfo.processedSoFar}/${batchInfo.totalRecords})`;
    } else if (result.message) {
      return result.message;
    } else if (result.summary) {
      return `총 ${result.summary.evaluations || result.summary.totalRecords || 0}건 처리됨`;
    } else {
      return '동기화 완료';
    }
    
  } catch (e) {
    // 네트워크 오류나 기타 예외
    Logger.log('[v0] sendToWebApp 오류: ' + e.message);
    Logger.log('[v0] 스택: ' + e.stack);
    throw new Error('웹앱 연결 실패: ' + e.message);
  }
}

/**
 * 연결 테스트 (수정 버전)
 */
function testConnection() {
  try {
    Logger.log('[v0] ===== 연결 테스트 시작 =====');
    Logger.log('[v0] 테스트 URL: ' + WEBAPP_URL);
    
    const options = {
      method: 'get', // GET 요청으로 테스트
      muteHttpExceptions: true
    };
    
    const startTime = new Date().getTime();
    const response = UrlFetchApp.fetch(WEBAPP_URL, options);
    const endTime = new Date().getTime();
    const responseTime = endTime - startTime;
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('[v0] 응답 시간: ' + responseTime + 'ms');
    Logger.log('[v0] 응답 코드: ' + responseCode);
    Logger.log('[v0] 응답 본문: ' + responseText);
    
    if (responseCode === 200) {
      let result;
      try {
        result = JSON.parse(responseText);
        Logger.log('[v0] ✅ 연결 성공!');
        Logger.log('[v0] 응답 데이터: ' + JSON.stringify(result, null, 2));
        
        // UI는 시트 메뉴에서 실행할 때만 표시 (에디터에서 직접 실행 시 스킵)
        // 주석 해제하여 사용 가능:
        // try {
        //   SpreadsheetApp.getUi().alert(
        //     '✅ 연결 성공!\n\n' +
        //     'URL: ' + WEBAPP_URL + '\n' +
        //     '상태: ' + responseCode + '\n' +
        //     '응답 시간: ' + responseTime + 'ms'
        //   );
        // } catch (uiError) {
        //   Logger.log('[v0] UI 알림 스킵 (에디터에서 실행 중)');
        // }
      } catch (e) {
        Logger.log('[v0] ⚠️ JSON 파싱 실패: ' + e.message);
        Logger.log('[v0] 원본 응답: ' + responseText);
      }
    } else {
      Logger.log('[v0] ❌ 연결 실패 - 상태 코드: ' + responseCode);
      Logger.log('[v0] 응답: ' + responseText.substring(0, 500));
      
      // UI는 시트 메뉴에서 실행할 때만 표시
      // try {
      //   SpreadsheetApp.getUi().alert(
      //     '❌ 연결 실패\n\n' +
      //     '상태 코드: ' + responseCode + '\n' +
      //     '응답: ' + responseText.substring(0, 200)
      //   );
      // } catch (uiError) {
      //   // UI가 없으면 무시
      // }
    }
    
    Logger.log('[v0] ===== 연결 테스트 완료 =====');
  } catch (e) {
    Logger.log('[v0] ❌ 오류 발생: ' + e.message);
    Logger.log('[v0] 스택: ' + e.stack);
    
    // UI는 시트 메뉴에서 실행할 때만 표시
    // try {
    //   SpreadsheetApp.getUi().alert('❌ 오류: ' + e.message);
    // } catch (uiError) {
    //   // UI가 없으면 무시
    // }
  }
}

/**
 * 자동 동기화 (매일 밤 12시)
 */
function scheduleAutoSync() {
  // 트리거 생성 (Apps Script 에디터에서 수동으로 설정 권장)
  // 메뉴: 트리거 → 새 트리거 → syncData, 시간 기반, 날마다, 오전 12시~1시
}

