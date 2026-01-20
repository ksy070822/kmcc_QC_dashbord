/**
 * BigQuery 동기화 API
 * Google Sheets 데이터를 BigQuery로 적재
 *
 * POST: Google Sheets 데이터를 BigQuery에 적재
 * GET: BigQuery 초기화 및 상태 확인
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initializeBigQuery,
  insertEvaluations,
  upsertAgents,
  transformRowForBigQuery,
  RawSheetRow,
  truncateTable,
  getDashboardStats,
} from '@/lib/bigquery';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: BigQuery 초기화 및 상태 확인
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'init') {
      // BigQuery 데이터셋 및 테이블 초기화
      const result = await initializeBigQuery();
      return NextResponse.json(result, { headers: corsHeaders });
    }

    if (action === 'stats') {
      // 오늘 날짜 통계 조회
      const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
      const stats = await getDashboardStats(date);
      return NextResponse.json({
        success: true,
        date,
        stats,
      }, { headers: corsHeaders });
    }

    // 기본 상태 응답
    return NextResponse.json({
      success: true,
      message: 'BigQuery Sync API',
      endpoints: {
        'GET ?action=init': 'Initialize BigQuery dataset and tables',
        'GET ?action=stats&date=YYYY-MM-DD': 'Get dashboard statistics',
        'POST': 'Sync data from Google Sheets to BigQuery',
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('BigQuery API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// POST: Google Sheets 데이터를 BigQuery에 적재
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    console.log('Received BigQuery sync request');

    // 데이터 구조 확인
    const { data, reset, timestamp } = body;

    if (!data) {
      return NextResponse.json({
        success: false,
        error: 'No data provided',
      }, {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 리셋 요청 처리
    if (reset) {
      console.log('Resetting BigQuery tables...');
      await truncateTable('evaluations');
      await truncateTable('agents');
      console.log('Tables reset complete');
    }

    // 데이터 파싱 및 변환
    const allRows: Record<string, unknown>[] = [];
    const agentsMap = new Map<string, {
      agent_id: string;
      agent_name: string;
      center: string;
      service?: string;
      channel?: string;
      hire_date?: string;
      tenure_months?: number;
    }>();

    // 데이터 형식 처리
    // 형식 1: { data: [{ sheet: '용산', headers: [...], rows: [...] }, ...] }
    // 형식 2: { yongsan: [...], gwangju: [...] }
    // 형식 3: { 용산: [...], 광주: [...] }

    let processedSheets = 0;

    if (Array.isArray(data)) {
      // 형식 1: Apps Script에서 전송하는 형식
      for (const sheetData of data) {
        const sheetName = sheetData.sheet || '';
        const headers = sheetData.headers || [];
        const rows = sheetData.rows || [];

        // 센터 판별
        let center: '용산' | '광주' | null = null;
        if (sheetName.includes('용산') || sheetName.toLowerCase().includes('yongsan')) {
          center = '용산';
        } else if (sheetName.includes('광주') || sheetName.toLowerCase().includes('gwangju')) {
          center = '광주';
        }

        if (!center) {
          console.log(`Skipping sheet: ${sheetName} (unknown center)`);
          continue;
        }

        console.log(`Processing sheet: ${sheetName} (${center}), ${rows.length} rows`);

        // 헤더와 행을 객체로 변환
        for (const row of rows) {
          const rowObj: RawSheetRow = {};
          headers.forEach((header: string, idx: number) => {
            const key = header.trim().replace(/\s+/g, '');
            (rowObj as Record<string, unknown>)[key] = row[idx];
          });

          // BigQuery 형식으로 변환
          const transformed = transformRowForBigQuery(rowObj, center);
          if (transformed) {
            allRows.push(transformed);

            // 상담사 정보 수집
            if (rowObj.ID) {
              const agentKey = `${center}_${rowObj.ID}`;
              if (!agentsMap.has(agentKey)) {
                agentsMap.set(agentKey, {
                  agent_id: rowObj.ID,
                  agent_name: rowObj.이름 || '',
                  center,
                  service: rowObj.서비스,
                  channel: rowObj.채널 || rowObj.유선채팅,
                  hire_date: rowObj.입사일,
                  tenure_months: rowObj.근속개월,
                });
              }
            }
          }
        }

        processedSheets++;
      }
    } else if (typeof data === 'object') {
      // 형식 2/3: 센터별 배열
      const centerMappings = [
        { keys: ['용산', 'yongsan', 'yonsan'], center: '용산' as const },
        { keys: ['광주', 'gwangju'], center: '광주' as const },
      ];

      for (const mapping of centerMappings) {
        let centerData: RawSheetRow[] | null = null;

        for (const key of mapping.keys) {
          if (data[key] && Array.isArray(data[key])) {
            centerData = data[key];
            break;
          }
        }

        if (!centerData) continue;

        console.log(`Processing ${mapping.center}: ${centerData.length} rows`);

        for (const rowObj of centerData) {
          const transformed = transformRowForBigQuery(rowObj, mapping.center);
          if (transformed) {
            allRows.push(transformed);

            // 상담사 정보 수집
            if (rowObj.ID) {
              const agentKey = `${mapping.center}_${rowObj.ID}`;
              if (!agentsMap.has(agentKey)) {
                agentsMap.set(agentKey, {
                  agent_id: rowObj.ID,
                  agent_name: rowObj.이름 || '',
                  center: mapping.center,
                  service: rowObj.서비스,
                  channel: rowObj.채널 || rowObj.유선채팅,
                  hire_date: rowObj.입사일,
                  tenure_months: rowObj.근속개월,
                });
              }
            }
          }
        }

        processedSheets++;
      }
    }

    console.log(`Total rows to insert: ${allRows.length}`);
    console.log(`Total unique agents: ${agentsMap.size}`);

    // BigQuery 초기화 (테이블이 없으면 생성)
    await initializeBigQuery();

    // 데이터 삽입
    const evalResult = await insertEvaluations(allRows);
    console.log(`Evaluations inserted: ${evalResult.inserted}`);

    // 상담사 데이터 업서트
    const agents = Array.from(agentsMap.values());
    const agentResult = await upsertAgents(agents);
    console.log(`Agents upserted: ${agentResult.upserted}`);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: timestamp || new Date().toISOString(),
      summary: {
        sheetsProcessed: processedSheets,
        totalRows: allRows.length,
        evaluationsInserted: evalResult.inserted,
        agentsUpserted: agentResult.upserted,
        duration: `${duration}ms`,
      },
      errors: [
        ...evalResult.errors,
        ...agentResult.errors,
      ],
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('BigQuery sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
