/**
 * BigQuery 연결 및 데이터 관리 모듈
 * GCP 프로젝트: csopp-25f2
 * 데이터셋: QC
 */

import { BigQuery } from '@google-cloud/bigquery';

// BigQuery 설정
const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID || 'csopp-25f2';
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'QC';
const LOCATION = process.env.BIGQUERY_LOCATION || 'asia-northeast3'; // 서울 리전

// BigQuery 클라이언트 초기화
let bigqueryClient: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (!bigqueryClient) {
    // 서비스 계정 키가 JSON 문자열로 제공된 경우
    if (process.env.BIGQUERY_CREDENTIALS) {
      const credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
      bigqueryClient = new BigQuery({
        projectId: PROJECT_ID,
        credentials,
      });
    } else {
      // 환경의 기본 인증 사용 (GCE, Cloud Run 등)
      bigqueryClient = new BigQuery({
        projectId: PROJECT_ID,
      });
    }
  }
  return bigqueryClient;
}

// 테이블 스키마 정의
export const QC_EVALUATIONS_SCHEMA = [
  { name: 'id', type: 'STRING', mode: 'REQUIRED', description: '고유 ID (센터_날짜_상담ID)' },
  { name: 'center', type: 'STRING', mode: 'REQUIRED', description: '센터 (용산/광주)' },
  { name: 'evaluation_date', type: 'DATE', mode: 'REQUIRED', description: '평가일' },
  { name: 'service', type: 'STRING', mode: 'NULLABLE', description: '서비스 (택시/대리/퀵 등)' },
  { name: 'channel', type: 'STRING', mode: 'NULLABLE', description: '채널 (유선/채팅)' },
  { name: 'agent_id', type: 'STRING', mode: 'REQUIRED', description: '상담사 ID' },
  { name: 'agent_name', type: 'STRING', mode: 'NULLABLE', description: '상담사 이름' },
  { name: 'hire_date', type: 'STRING', mode: 'NULLABLE', description: '입사일' },
  { name: 'tenure_months', type: 'INTEGER', mode: 'NULLABLE', description: '근속개월' },
  { name: 'evaluation_round', type: 'STRING', mode: 'NULLABLE', description: '평가회차' },
  { name: 'consultation_id', type: 'STRING', mode: 'NULLABLE', description: '상담ID' },
  { name: 'consultation_datetime', type: 'STRING', mode: 'NULLABLE', description: '상담일시' },
  // 상담유형 뎁스
  { name: 'depth1_1', type: 'STRING', mode: 'NULLABLE', description: '상담유형 1뎁스-1' },
  { name: 'depth1_2', type: 'STRING', mode: 'NULLABLE', description: '상담유형 1뎁스-2' },
  { name: 'depth1_3', type: 'STRING', mode: 'NULLABLE', description: '상담유형 1뎁스-3' },
  { name: 'depth1_4', type: 'STRING', mode: 'NULLABLE', description: '상담유형 1뎁스-4' },
  { name: 'depth2_1', type: 'STRING', mode: 'NULLABLE', description: '상담유형 2뎁스-1' },
  { name: 'depth2_2', type: 'STRING', mode: 'NULLABLE', description: '상담유형 2뎁스-2' },
  { name: 'depth2_3', type: 'STRING', mode: 'NULLABLE', description: '상담유형 2뎁스-3' },
  { name: 'depth2_4', type: 'STRING', mode: 'NULLABLE', description: '상담유형 2뎁스-4' },
  // 16개 평가항목 (Y/N -> BOOLEAN)
  { name: 'first_last_greeting_missing', type: 'BOOLEAN', mode: 'NULLABLE', description: '첫인사/끝인사 누락' },
  { name: 'empathy_missing', type: 'BOOLEAN', mode: 'NULLABLE', description: '공감표현 누락' },
  { name: 'apology_missing', type: 'BOOLEAN', mode: 'NULLABLE', description: '사과표현 누락' },
  { name: 'additional_inquiry_missing', type: 'BOOLEAN', mode: 'NULLABLE', description: '추가문의 누락' },
  { name: 'unfriendly', type: 'BOOLEAN', mode: 'NULLABLE', description: '불친절' },
  { name: 'consultation_type_error', type: 'BOOLEAN', mode: 'NULLABLE', description: '상담유형 오설정' },
  { name: 'guide_non_compliance', type: 'BOOLEAN', mode: 'NULLABLE', description: '가이드 미준수' },
  { name: 'identity_verification_missing', type: 'BOOLEAN', mode: 'NULLABLE', description: '본인확인 누락' },
  { name: 'required_search_missing', type: 'BOOLEAN', mode: 'NULLABLE', description: '필수탐색 누락' },
  { name: 'wrong_guidance', type: 'BOOLEAN', mode: 'NULLABLE', description: '오안내' },
  { name: 'system_processing_missing', type: 'BOOLEAN', mode: 'NULLABLE', description: '전산처리 누락' },
  { name: 'system_processing_insufficient', type: 'BOOLEAN', mode: 'NULLABLE', description: '전산처리 미흡/정정' },
  { name: 'system_operation_error', type: 'BOOLEAN', mode: 'NULLABLE', description: '전산조작 미흡/오류' },
  { name: 'call_pickup_id_mapping_error', type: 'BOOLEAN', mode: 'NULLABLE', description: '콜픽/트립ID 매핑 누락/오기재' },
  { name: 'flag_keyword_error', type: 'BOOLEAN', mode: 'NULLABLE', description: '플래그/키워드 누락/오기재' },
  { name: 'consultation_history_insufficient', type: 'BOOLEAN', mode: 'NULLABLE', description: '상담이력 기재 미흡' },
  // 합계 및 분류
  { name: 'total_errors', type: 'INTEGER', mode: 'NULLABLE', description: '항목별 오류건' },
  { name: 'attitude_errors', type: 'INTEGER', mode: 'NULLABLE', description: '태도미흡 오류 수' },
  { name: 'business_errors', type: 'INTEGER', mode: 'NULLABLE', description: '오상담/오처리 오류 수' },
  // 메타데이터
  { name: 'comment', type: 'STRING', mode: 'NULLABLE', description: '코멘트' },
  { name: 'ai_evaluation', type: 'BOOLEAN', mode: 'NULLABLE', description: 'AI평가여부' },
  { name: 'ai_error', type: 'BOOLEAN', mode: 'NULLABLE', description: 'AI오류여부' },
  { name: 'content', type: 'STRING', mode: 'NULLABLE', description: '내용' },
  { name: 'process_date', type: 'STRING', mode: 'NULLABLE', description: '진행일' },
  { name: 'processor', type: 'STRING', mode: 'NULLABLE', description: '진행자' },
  // 시스템 메타데이터
  { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED', description: '데이터 생성 시간' },
  { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED', description: '데이터 수정 시간' },
];

// 상담사 마스터 테이블 스키마
export const QC_AGENTS_SCHEMA = [
  { name: 'agent_id', type: 'STRING', mode: 'REQUIRED', description: '상담사 ID' },
  { name: 'agent_name', type: 'STRING', mode: 'NULLABLE', description: '상담사 이름' },
  { name: 'center', type: 'STRING', mode: 'REQUIRED', description: '센터 (용산/광주)' },
  { name: 'service', type: 'STRING', mode: 'NULLABLE', description: '서비스' },
  { name: 'channel', type: 'STRING', mode: 'NULLABLE', description: '채널' },
  { name: 'hire_date', type: 'STRING', mode: 'NULLABLE', description: '입사일' },
  { name: 'tenure_months', type: 'INTEGER', mode: 'NULLABLE', description: '근속개월' },
  { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED', description: '생성 시간' },
  { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED', description: '수정 시간' },
];

/**
 * 데이터셋 생성 (없는 경우)
 */
export async function ensureDatasetExists(): Promise<void> {
  const bigquery = getBigQueryClient();
  const dataset = bigquery.dataset(DATASET_ID);

  const [exists] = await dataset.exists();

  if (!exists) {
    console.log(`Creating dataset ${DATASET_ID}...`);
    await bigquery.createDataset(DATASET_ID, {
      location: LOCATION,
    });
    console.log(`Dataset ${DATASET_ID} created.`);
  }
}

/**
 * 테이블 생성 (없는 경우)
 */
export async function ensureTableExists(
  tableId: string,
  schema: typeof QC_EVALUATIONS_SCHEMA
): Promise<void> {
  const bigquery = getBigQueryClient();
  const dataset = bigquery.dataset(DATASET_ID);
  const table = dataset.table(tableId);

  const [exists] = await table.exists();

  if (!exists) {
    console.log(`Creating table ${tableId}...`);
    await dataset.createTable(tableId, {
      schema: schema,
      timePartitioning: tableId === 'evaluations' ? {
        type: 'DAY',
        field: 'evaluation_date',
      } : undefined,
    });
    console.log(`Table ${tableId} created.`);
  }
}

/**
 * 초기화: 데이터셋과 테이블 생성
 */
export async function initializeBigQuery(): Promise<{ success: boolean; message: string }> {
  try {
    await ensureDatasetExists();
    await ensureTableExists('evaluations', QC_EVALUATIONS_SCHEMA);
    await ensureTableExists('agents', QC_AGENTS_SCHEMA);

    return {
      success: true,
      message: `BigQuery 초기화 완료: 프로젝트=${PROJECT_ID}, 데이터셋=${DATASET_ID}`,
    };
  } catch (error) {
    console.error('BigQuery 초기화 실패:', error);
    return {
      success: false,
      message: `BigQuery 초기화 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Y/N 값을 boolean으로 변환
 */
function toBoolean(value: string | undefined): boolean | null {
  if (value === 'Y' || value === 'y') return true;
  if (value === 'N' || value === 'n') return false;
  return null;
}

/**
 * 날짜 문자열 정규화 (YYYY-MM-DD 형식으로)
 */
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // 다양한 날짜 형식 처리
  const cleaned = String(dateStr).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // YYYY.MM.DD
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned)) {
    return cleaned.replace(/\./g, '-');
  }

  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned)) {
    return cleaned.replace(/\//g, '-');
  }

  // Date 객체로 파싱 시도
  try {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // 파싱 실패
  }

  return null;
}

/**
 * 로우 데이터를 BigQuery 형식으로 변환
 */
export interface RawSheetRow {
  서비스?: string;
  채널?: string;
  이름?: string;
  ID?: string;
  입사일?: string;
  근속개월?: number;
  평가회차?: string;
  평가일?: string;
  상담일시?: string;
  상담ID?: string;
  유선채팅?: string;
  뎁스1_1?: string;
  뎁스1_2?: string;
  뎁스1_3?: string;
  뎁스1_4?: string;
  뎁스2_1?: string;
  뎁스2_2?: string;
  뎁스2_3?: string;
  뎁스2_4?: string;
  첫인사끝인사누락?: string;
  공감표현누락?: string;
  사과표현누락?: string;
  추가문의누락?: string;
  불친절?: string;
  상담유형오설정?: string;
  가이드미준수?: string;
  본인확인누락?: string;
  필수탐색누락?: string;
  오안내?: string;
  전산처리누락?: string;
  전산처리미흡정정?: string;
  전산조작미흡오류?: string;
  콜픽트립ID매핑누락오기재?: string;
  플래그키워드누락오기재?: string;
  상담이력기재미흡?: string;
  항목별오류건?: number;
  태도미흡?: number;
  오상담오처리?: number;
  Comment?: string;
  AI평가여부?: string;
  AI오류여부?: string;
  내용?: string;
  진행일?: string;
  진행자?: string;
}

export function transformRowForBigQuery(
  row: RawSheetRow,
  center: '용산' | '광주'
): Record<string, unknown> | null {
  const evaluationDate = normalizeDate(row.평가일 || '');
  if (!evaluationDate || !row.ID) {
    return null; // 필수 필드 누락
  }

  const now = new Date().toISOString();
  const id = `${center}_${evaluationDate}_${row.상담ID || row.ID}_${Date.now()}`;

  return {
    id,
    center,
    evaluation_date: evaluationDate,
    service: row.서비스 || null,
    channel: row.채널 || row.유선채팅 || null,
    agent_id: row.ID,
    agent_name: row.이름 || null,
    hire_date: row.입사일 || null,
    tenure_months: row.근속개월 || null,
    evaluation_round: row.평가회차 || null,
    consultation_id: row.상담ID || null,
    consultation_datetime: row.상담일시 || null,
    depth1_1: row.뎁스1_1 || null,
    depth1_2: row.뎁스1_2 || null,
    depth1_3: row.뎁스1_3 || null,
    depth1_4: row.뎁스1_4 || null,
    depth2_1: row.뎁스2_1 || null,
    depth2_2: row.뎁스2_2 || null,
    depth2_3: row.뎁스2_3 || null,
    depth2_4: row.뎁스2_4 || null,
    first_last_greeting_missing: toBoolean(row.첫인사끝인사누락),
    empathy_missing: toBoolean(row.공감표현누락),
    apology_missing: toBoolean(row.사과표현누락),
    additional_inquiry_missing: toBoolean(row.추가문의누락),
    unfriendly: toBoolean(row.불친절),
    consultation_type_error: toBoolean(row.상담유형오설정),
    guide_non_compliance: toBoolean(row.가이드미준수),
    identity_verification_missing: toBoolean(row.본인확인누락),
    required_search_missing: toBoolean(row.필수탐색누락),
    wrong_guidance: toBoolean(row.오안내),
    system_processing_missing: toBoolean(row.전산처리누락),
    system_processing_insufficient: toBoolean(row.전산처리미흡정정),
    system_operation_error: toBoolean(row.전산조작미흡오류),
    call_pickup_id_mapping_error: toBoolean(row.콜픽트립ID매핑누락오기재),
    flag_keyword_error: toBoolean(row.플래그키워드누락오기재),
    consultation_history_insufficient: toBoolean(row.상담이력기재미흡),
    total_errors: row.항목별오류건 || 0,
    attitude_errors: row.태도미흡 || 0,
    business_errors: row.오상담오처리 || 0,
    comment: row.Comment || null,
    ai_evaluation: toBoolean(row.AI평가여부),
    ai_error: toBoolean(row.AI오류여부),
    content: row.내용 || null,
    process_date: row.진행일 || null,
    processor: row.진행자 || null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 평가 데이터를 BigQuery에 삽입
 */
export async function insertEvaluations(
  rows: Record<string, unknown>[]
): Promise<{ success: boolean; inserted: number; errors: string[] }> {
  if (rows.length === 0) {
    return { success: true, inserted: 0, errors: [] };
  }

  const bigquery = getBigQueryClient();
  const errors: string[] = [];
  let inserted = 0;

  // 배치 크기 설정 (BigQuery 스트리밍 삽입 제한)
  const BATCH_SIZE = 500;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    try {
      await bigquery
        .dataset(DATASET_ID)
        .table('evaluations')
        .insert(batch);
      inserted += batch.length;
      console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows`);
    } catch (error: unknown) {
      const err = error as { name?: string; errors?: Array<{ row: unknown; errors: Array<{ message: string }> }> };
      if (err.name === 'PartialFailureError' && err.errors) {
        // 일부 행만 실패한 경우
        const failedCount = err.errors.length;
        inserted += batch.length - failedCount;
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${failedCount} rows failed`);

        // 상세 오류 로깅
        err.errors.slice(0, 5).forEach((e) => {
          console.error('Insert error:', e.errors);
        });
      } else {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    inserted,
    errors,
  };
}

/**
 * 상담사 데이터를 BigQuery에 업서트
 */
export async function upsertAgents(
  agents: Array<{
    agent_id: string;
    agent_name: string;
    center: string;
    service?: string;
    channel?: string;
    hire_date?: string;
    tenure_months?: number;
  }>
): Promise<{ success: boolean; upserted: number; errors: string[] }> {
  if (agents.length === 0) {
    return { success: true, upserted: 0, errors: [] };
  }

  const bigquery = getBigQueryClient();
  const errors: string[] = [];
  const now = new Date().toISOString();

  // MERGE 쿼리를 위한 임시 테이블 생성
  const tempTableId = `agents_temp_${Date.now()}`;
  const dataset = bigquery.dataset(DATASET_ID);

  try {
    // 임시 테이블 생성
    await dataset.createTable(tempTableId, {
      schema: QC_AGENTS_SCHEMA,
      expirationTime: String(Date.now() + 3600000), // 1시간 후 삭제
    });

    // 임시 테이블에 데이터 삽입
    const rows = agents.map(agent => ({
      ...agent,
      created_at: now,
      updated_at: now,
    }));

    await dataset.table(tempTableId).insert(rows);

    // MERGE 쿼리 실행
    const mergeQuery = `
      MERGE \`${PROJECT_ID}.${DATASET_ID}.agents\` AS target
      USING \`${PROJECT_ID}.${DATASET_ID}.${tempTableId}\` AS source
      ON target.agent_id = source.agent_id AND target.center = source.center
      WHEN MATCHED THEN
        UPDATE SET
          agent_name = source.agent_name,
          service = source.service,
          channel = source.channel,
          hire_date = source.hire_date,
          tenure_months = source.tenure_months,
          updated_at = source.updated_at
      WHEN NOT MATCHED THEN
        INSERT (agent_id, agent_name, center, service, channel, hire_date, tenure_months, created_at, updated_at)
        VALUES (source.agent_id, source.agent_name, source.center, source.service, source.channel, source.hire_date, source.tenure_months, source.created_at, source.updated_at)
    `;

    await bigquery.query(mergeQuery);

    // 임시 테이블 삭제
    await dataset.table(tempTableId).delete();

    return {
      success: true,
      upserted: agents.length,
      errors: [],
    };
  } catch (error) {
    errors.push(`Agent upsert failed: ${error instanceof Error ? error.message : String(error)}`);

    // 임시 테이블 정리 시도
    try {
      await dataset.table(tempTableId).delete();
    } catch {
      // 무시
    }

    return {
      success: false,
      upserted: 0,
      errors,
    };
  }
}

/**
 * 특정 날짜 범위의 데이터 조회
 */
export async function queryEvaluations(
  startDate: string,
  endDate: string,
  center?: '용산' | '광주'
): Promise<Record<string, unknown>[]> {
  const bigquery = getBigQueryClient();

  let query = `
    SELECT *
    FROM \`${PROJECT_ID}.${DATASET_ID}.evaluations\`
    WHERE evaluation_date BETWEEN @startDate AND @endDate
  `;

  const params: Record<string, string> = { startDate, endDate };

  if (center) {
    query += ` AND center = @center`;
    params.center = center;
  }

  query += ` ORDER BY evaluation_date DESC, created_at DESC`;

  const [rows] = await bigquery.query({
    query,
    params,
  });

  return rows;
}

/**
 * 대시보드 통계 조회
 */
export async function getDashboardStats(date: string): Promise<{
  totalEvaluations: number;
  yongsanCount: number;
  gwangjuCount: number;
  overallErrorRate: number;
  attitudeErrorRate: number;
  businessErrorRate: number;
}> {
  const bigquery = getBigQueryClient();

  const query = `
    SELECT
      COUNT(*) as total_evaluations,
      COUNTIF(center = '용산') as yongsan_count,
      COUNTIF(center = '광주') as gwangju_count,
      AVG(total_errors) as avg_total_errors,
      AVG(attitude_errors) as avg_attitude_errors,
      AVG(business_errors) as avg_business_errors,
      COUNTIF(total_errors > 0) as error_count
    FROM \`${PROJECT_ID}.${DATASET_ID}.evaluations\`
    WHERE evaluation_date = @date
  `;

  const [rows] = await bigquery.query({
    query,
    params: { date },
  });

  const row = rows[0] || {};
  const total = Number(row.total_evaluations) || 0;
  const errorCount = Number(row.error_count) || 0;

  return {
    totalEvaluations: total,
    yongsanCount: Number(row.yongsan_count) || 0,
    gwangjuCount: Number(row.gwangju_count) || 0,
    overallErrorRate: total > 0 ? (errorCount / total) * 100 : 0,
    attitudeErrorRate: Number(row.avg_attitude_errors) || 0,
    businessErrorRate: Number(row.avg_business_errors) || 0,
  };
}

/**
 * 기간별 트렌드 조회
 */
export async function getTrend(days: number = 14): Promise<Array<{
  date: string;
  totalEvaluations: number;
  errorRate: number;
  yongsanErrorRate: number;
  gwangjuErrorRate: number;
}>> {
  const bigquery = getBigQueryClient();

  const query = `
    SELECT
      evaluation_date as date,
      COUNT(*) as total_evaluations,
      SAFE_DIVIDE(COUNTIF(total_errors > 0), COUNT(*)) * 100 as error_rate,
      SAFE_DIVIDE(COUNTIF(center = '용산' AND total_errors > 0), COUNTIF(center = '용산')) * 100 as yongsan_error_rate,
      SAFE_DIVIDE(COUNTIF(center = '광주' AND total_errors > 0), COUNTIF(center = '광주')) * 100 as gwangju_error_rate
    FROM \`${PROJECT_ID}.${DATASET_ID}.evaluations\`
    WHERE evaluation_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY evaluation_date
    ORDER BY evaluation_date DESC
  `;

  const [rows] = await bigquery.query({
    query,
    params: { days },
  });

  return rows.map((row: Record<string, unknown>) => ({
    date: String(row.date),
    totalEvaluations: Number(row.total_evaluations) || 0,
    errorRate: Number(row.error_rate) || 0,
    yongsanErrorRate: Number(row.yongsan_error_rate) || 0,
    gwangjuErrorRate: Number(row.gwangju_error_rate) || 0,
  }));
}

/**
 * 테이블의 모든 데이터 삭제 (주의: 데이터 초기화 시에만 사용)
 */
export async function truncateTable(tableId: string): Promise<void> {
  const bigquery = getBigQueryClient();

  const query = `TRUNCATE TABLE \`${PROJECT_ID}.${DATASET_ID}.${tableId}\``;
  await bigquery.query(query);

  console.log(`Table ${tableId} truncated.`);
}

export { PROJECT_ID, DATASET_ID, LOCATION };
