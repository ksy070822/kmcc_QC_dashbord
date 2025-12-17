import { type NextRequest, NextResponse } from "next/server"
import { db, COLLECTIONS } from "@/lib/firebase-admin"

// CORS 헤더 설정
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// Google Apps Script에서 POST로 데이터를 받는 API
export async function POST(request: NextRequest) {
  try {
    // 요청 본문 읽기
    let data
    try {
      const body = await request.text()
      if (!body) {
        return NextResponse.json(
          { success: false, error: "Request body is empty" },
          { status: 400, headers: corsHeaders }
        )
      }
      data = JSON.parse(body)

      console.log("[API] 수신된 데이터 타입:", typeof data)
      console.log("[API] 데이터 키:", Object.keys(data || {}))
    } catch (parseError) {
      console.error("[API] JSON parse error:", parseError)
      return NextResponse.json(
        { success: false, error: "Invalid JSON format", details: String(parseError) },
        { status: 400, headers: corsHeaders }
      )
    }

    // 데이터 형식 확인 및 처리
    let parsedData

    const hasYonsan = data && typeof data === 'object' && !Array.isArray(data) && 'yonsan' in data
    const hasGwangju = data && typeof data === 'object' && !Array.isArray(data) && 'gwangju' in data

    if (hasYonsan || hasGwangju) {
      const batchNumber = data.batch || 0
      const isLast = data.isLast === true
      const processedSoFar = data.processedSoFar || 0
      const totalRecords = data.totalRecords || 0

      console.log(`[API] Apps Script 배치 데이터 수신: 배치 ${batchNumber}`)

      const yonsanRecords = Array.isArray(data.yonsan) ? data.yonsan : []
      const gwangjuRecords = Array.isArray(data.gwangju) ? data.gwangju : []

      if (yonsanRecords.length === 0 && gwangjuRecords.length === 0) {
        return NextResponse.json(
          {
            success: true,
            message: `배치 ${batchNumber}: 빈 배치 (스킵)`,
            timestamp: new Date().toISOString(),
            batch: {
              batchNumber,
              isLast,
              processedSoFar,
              totalRecords,
              currentBatch: { evaluations: 0, agents: 0 },
            },
          },
          { headers: corsHeaders }
        )
      }

      // 데이터 파싱
      parsedData = parseAppsScriptData(yonsanRecords, gwangjuRecords)

      // Firestore에 데이터 저장
      let savedCount = 0
      const batch = db.batch()

      for (const evaluation of parsedData.evaluations) {
        // 고유 ID 생성: agentId_evalDate_consultId
        const docId = `${evaluation.agentId}_${evaluation.evalDate}_${evaluation.consultId || Date.now()}`
        const docRef = db.collection(COLLECTIONS.EVALUATIONS).doc(docId)

        batch.set(docRef, {
          ...evaluation,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true })

        savedCount++
      }

      // 상담사 정보 저장
      for (const agent of parsedData.agents) {
        const agentRef = db.collection(COLLECTIONS.AGENTS).doc(agent.id)
        batch.set(agentRef, {
          ...agent,
          updatedAt: new Date().toISOString(),
        }, { merge: true })
      }

      // 배치 커밋
      await batch.commit()

      console.log(`[API] Firestore 저장 완료: ${savedCount}건`)

      // 동기화 로그 저장
      if (isLast) {
        await db.collection(COLLECTIONS.SYNC_LOGS).add({
          timestamp: new Date().toISOString(),
          totalRecords: totalRecords,
          status: 'completed',
        })
      }

      return NextResponse.json(
        {
          success: true,
          message: `배치 ${batchNumber} 처리 완료: ${savedCount}건`,
          timestamp: new Date().toISOString(),
          batch: {
            batchNumber,
            isLast,
            processedSoFar: processedSoFar + savedCount,
            totalRecords,
            currentBatch: {
              evaluations: savedCount,
              agents: parsedData.agents.length,
            },
          },
        },
        { headers: corsHeaders }
      )
    }
    // 테스트 요청
    else if (data.test === true) {
      return NextResponse.json(
        {
          success: true,
          message: "연결 테스트 성공",
          timestamp: new Date().toISOString(),
          received: data,
        },
        { headers: corsHeaders }
      )
    }
    else {
      return NextResponse.json(
        { success: false, error: "Invalid data format: expected {yonsan, gwangju}" },
        { status: 400, headers: corsHeaders }
      )
    }
  } catch (error) {
    console.error("[API] Sync error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: "데이터 동기화 중 오류가 발생했습니다.",
        details: errorMessage,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}

// GET 요청으로 동기화 상태 확인
export async function GET() {
  try {
    // 최근 동기화 로그 조회
    const syncLogsSnapshot = await db.collection(COLLECTIONS.SYNC_LOGS)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get()

    let lastSync = null
    if (!syncLogsSnapshot.empty) {
      lastSync = syncLogsSnapshot.docs[0].data()
    }

    // 전체 평가 데이터 수 조회
    const evaluationsSnapshot = await db.collection(COLLECTIONS.EVALUATIONS).count().get()
    const totalEvaluations = evaluationsSnapshot.data().count

    return NextResponse.json(
      {
        status: "ready",
        lastSync: lastSync?.timestamp || null,
        totalEvaluations,
        message: "동기화 API가 정상 작동 중입니다.",
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("[API] GET error:", error)
    return NextResponse.json(
      {
        status: "ready",
        lastSync: new Date().toISOString(),
        message: "동기화 API가 정상 작동 중입니다.",
      },
      { headers: corsHeaders }
    )
  }
}

// Apps Script 형식 데이터 파싱
function parseAppsScriptData(yonsanRecords: any[], gwangjuRecords: any[]) {
  const agents: any[] = []
  const evaluations: any[] = []
  const agentMap = new Map()

  const allRecords = [
    ...yonsanRecords.map(r => ({ ...r, center: '용산' })),
    ...gwangjuRecords.map(r => ({ ...r, center: '광주' }))
  ]

  allRecords.forEach((record, index) => {
    try {
      const agentId = record.id || `AGT${index}`
      const agentName = record.name || ""

      // 상담사 정보 저장
      if (!agentMap.has(agentId) && agentName) {
        agentMap.set(agentId, {
          id: agentId,
          name: agentName,
          center: record.center || "",
          service: record.service || "",
          channel: record.channel || "",
          tenure: record.tenure || "",
          hireDate: record.hireDate || "",
        })
      }

      // 평가 항목 매핑
      const itemNames = [
        "첫인사/끝인사 누락",
        "공감표현 누락",
        "사과표현 누락",
        "추가문의 누락",
        "불친절",
        "상담유형 오설정",
        "가이드 미준수",
        "본인확인 누락",
        "필수탐색 누락",
        "오안내",
        "전산 처리 누락",
        "전산 처리 미흡/정정",
        "전산 조작 미흡/오류",
        "콜/픽/트립ID 매핑누락&오기재",
        "플래그/키워드 누락&오기재",
        "상담이력 기재 미흡",
      ]

      const evaluationItems: Record<string, number> = {}
      if (Array.isArray(record.evaluationItems)) {
        record.evaluationItems.forEach((value: number, idx: number) => {
          if (idx < itemNames.length) {
            evaluationItems[itemNames[idx]] = value || 0
          }
        })
      }

      // 평가 데이터 추가
      if (record.evalDate && agentId) {
        evaluations.push({
          agentId,
          agentName,
          center: record.center || "",
          service: record.service || "",
          channel: record.channel || "",
          evalDate: record.evalDate,
          evalId: record.evalId || "",
          consultId: record.consultId || "",
          evaluationItems,
          attitudeErrors: record.attitudeErrors || 0,
          businessErrors: record.businessErrors || 0,
          totalErrors: record.totalErrors || 0,
        })
      }
    } catch (e) {
      console.error(`[API] Record ${index} parsing error:`, e)
    }
  })

  return {
    agents: Array.from(agentMap.values()),
    evaluations,
  }
}
