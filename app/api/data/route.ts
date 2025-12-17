import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"

// CORS 헤더 설정
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// OPTIONS 요청 처리
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// 대시보드 데이터 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const center = searchParams.get("center") || "all"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // 평가 데이터 조회
    let evaluationsQuery: any = db.collection("evaluations")

    if (startDate && endDate) {
      evaluationsQuery = evaluationsQuery
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
    }

    const evaluationsSnapshot = await evaluationsQuery.get()
    const evaluations = evaluationsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // 센터 필터링
    let filteredEvaluations = evaluations
    if (center !== "all") {
      filteredEvaluations = evaluations.filter((e: any) => e.center === center)
    }

    // 상담사 데이터 조회
    const agentsSnapshot = await db.collection("agents").get()
    const agents = agentsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // 통계 계산
    const stats = {
      totalAgents: agents.length,
      totalEvaluations: filteredEvaluations.length,
      agentsByCenter: {
        용산: agents.filter((a: any) => a.center === "용산").length,
        광주: agents.filter((a: any) => a.center === "광주").length,
      },
      evaluationsByCenter: {
        용산: filteredEvaluations.filter((e: any) => e.center === "용산").length,
        광주: filteredEvaluations.filter((e: any) => e.center === "광주").length,
      },
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          agents,
          evaluations: filteredEvaluations,
          stats,
        },
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("[API] 데이터 조회 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "데이터 조회 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    )
  }
}

