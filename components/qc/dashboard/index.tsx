"use client"

import { useState, useMemo } from "react"
import { OverviewSection } from "./overview-section"
import { CenterComparison } from "./center-comparison"
import { ErrorTrendChart } from "./error-trend-chart"
import { ItemAnalysis } from "./item-analysis"
import { DashboardFilters } from "./dashboard-filters"
import { GoalStatusBoard } from "./goal-status-board"
import { DailyErrorTable } from "./daily-error-table"
import { WeeklyErrorTable } from "./weekly-error-table"
import { TenureErrorTable } from "./tenure-error-table"
import { ServiceWeeklyTable } from "./service-weekly-table"
import { useQCData } from "@/hooks/use-qc-data"
import { groups } from "@/lib/mock-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

interface DashboardProps {
  onNavigateToFocus: () => void
}

export function Dashboard({ onNavigateToFocus }: DashboardProps) {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")

  const { data, loading, error } = useQCData(selectedCenter)

  // 실제 데이터에서 통계 계산
  const stats = useMemo(() => {
    if (!data) return null

    const evaluations = data.evaluations || []
    const agents = data.agents || []

    // 오류율 계산
    const attitudeErrors = evaluations.reduce((sum: number, e: any) => sum + (e.attitudeErrors || 0), 0)
    const businessErrors = evaluations.reduce((sum: number, e: any) => sum + (e.businessErrors || 0), 0)
    const totalErrors = attitudeErrors + businessErrors
    const totalCalls = evaluations.reduce((sum: number, e: any) => sum + (e.totalCalls || 1), 0)

    const attitudeErrorRate = totalCalls > 0 ? (attitudeErrors / totalCalls) * 100 : 0
    const businessErrorRate = totalCalls > 0 ? (businessErrors / totalCalls) * 100 : 0
    const overallErrorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0

    return {
      totalAgents: agents.length,
      totalEvaluations: evaluations.length,
      attitudeErrorRate: Number(attitudeErrorRate.toFixed(2)),
      businessErrorRate: Number(businessErrorRate.toFixed(2)),
      overallErrorRate: Number(overallErrorRate.toFixed(2)),
      agentsByCenter: data.stats.agentsByCenter,
      evaluationsByCenter: data.stats.evaluationsByCenter,
    }
  }, [data])

  // 센터별 데이터 계산
  const centerData = useMemo(() => {
    if (!data) return []

    const evaluations = data.evaluations || []
    const agents = data.agents || []

    return ["용산", "광주"].map((centerName) => {
      const centerEvaluations = evaluations.filter((e: any) => e.center === centerName)
      const centerAgents = agents.filter((a: any) => a.center === centerName)

      const totalErrors = centerEvaluations.reduce((sum: number, e: any) => sum + (e.totalErrors || 0), 0)
      const totalCalls = centerEvaluations.reduce((sum: number, e: any) => sum + (e.totalCalls || 1), 0)
      const errorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0

      return {
        name: centerName,
        errorRate: Number(errorRate.toFixed(2)),
        trend: 0, // TODO: 이전 기간과 비교
        targetRate: 3.0,
        groups: groups[centerName as "용산" | "광주"].map((g) => {
          const groupAgents = centerAgents.filter((a: any) => a.group === g)
          const groupEvaluations = centerEvaluations.filter((e: any) => groupAgents.some((a: any) => a.id === e.agentId))
          const groupErrors = groupEvaluations.reduce((sum: number, e: any) => sum + (e.totalErrors || 0), 0)
          const groupCalls = groupEvaluations.reduce((sum: number, e: any) => sum + (e.totalCalls || 1), 0)
          const groupErrorRate = groupCalls > 0 ? (groupErrors / groupCalls) * 100 : 0

          return {
            name: g,
            errorRate: Number(groupErrorRate.toFixed(2)),
            agentCount: groupAgents.length,
            trend: 0, // TODO: 이전 기간과 비교
          }
        }),
      }
    })
  }, [data])

  const filteredCenters = selectedCenter === "all" ? centerData : centerData.filter((c) => c.name === selectedCenter)

  // 로딩 상태
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // 에러 상태
  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">데이터를 불러올 수 없습니다: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 상단 통계 요약 */}
      <OverviewSection
        totalAgentsYongsan={stats?.agentsByCenter.용산 || 0}
        totalAgentsGwangju={stats?.agentsByCenter.광주 || 0}
        totalEvaluations={stats?.totalEvaluations || 0}
        watchlistYongsan={7} // TODO: 실제 유의상담사 데이터 계산
        watchlistGwangju={5} // TODO: 실제 유의상담사 데이터 계산
        attitudeErrorRate={stats?.attitudeErrorRate || 0}
        attitudeErrorTrend={-0.12} // TODO: 이전 기간과 비교
        consultErrorRate={stats?.businessErrorRate || 0}
        consultErrorTrend={0.08} // TODO: 이전 기간과 비교
        overallErrorRate={stats?.overallErrorRate || 0}
        overallErrorTrend={-0.04} // TODO: 이전 기간과 비교
        onWatchlistClick={onNavigateToFocus}
      />

      {/* 목표 달성 현황 전광판 */}
      <GoalStatusBoard />

      {/* 필터 */}
      <DashboardFilters
        selectedCenter={selectedCenter}
        setSelectedCenter={setSelectedCenter}
        selectedService={selectedService}
        setSelectedService={setSelectedService}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        selectedTenure={selectedTenure}
        setSelectedTenure={setSelectedTenure}
      />

      {/* 센터별 오류율 추이 (위로 이동) */}
      <ErrorTrendChart 
        data={useMemo(() => {
          // 실제 데이터에서 추이 데이터 생성
          if (!data?.evaluations) return []
          
          const evaluations = data.evaluations
          const dates = [...new Set(evaluations.map((e: any) => e.date))].sort()
          
          return dates.slice(-14).map((date: string) => {
            const dateEvaluations = evaluations.filter((e: any) => e.date === date)
            const yonsanEvals = dateEvaluations.filter((e: any) => e.center === "용산")
            const gwangjuEvals = dateEvaluations.filter((e: any) => e.center === "광주")
            
            const calcErrorRate = (evals: any[]) => {
              const totalErrors = evals.reduce((sum, e) => sum + (e.totalErrors || 0), 0)
              const totalCalls = evals.reduce((sum, e) => sum + (e.totalCalls || 1), 0)
              return totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0
            }
            
            const calcAttitudeRate = (evals: any[]) => {
              const attitudeErrors = evals.reduce((sum, e) => sum + (e.attitudeErrors || 0), 0)
              const totalCalls = evals.reduce((sum, e) => sum + (e.totalCalls || 1), 0)
              return totalCalls > 0 ? (attitudeErrors / totalCalls) * 100 : 0
            }
            
            const calcBusinessRate = (evals: any[]) => {
              const businessErrors = evals.reduce((sum, e) => sum + (e.businessErrors || 0), 0)
              const totalCalls = evals.reduce((sum, e) => sum + (e.totalCalls || 1), 0)
              return totalCalls > 0 ? (businessErrors / totalCalls) * 100 : 0
            }
            
            return {
              date,
              용산_태도: Number(calcAttitudeRate(yonsanEvals).toFixed(2)),
              용산_오상담: Number(calcBusinessRate(yonsanEvals).toFixed(2)),
              용산_합계: Number(calcErrorRate(yonsanEvals).toFixed(2)),
              광주_태도: Number(calcAttitudeRate(gwangjuEvals).toFixed(2)),
              광주_오상담: Number(calcBusinessRate(gwangjuEvals).toFixed(2)),
              광주_합계: Number(calcErrorRate(gwangjuEvals).toFixed(2)),
              목표: 3.0,
            }
          })
        }, [data])} 
        targetRate={3.0} 
      />

      {/* 서비스별 현황 (아래로 이동) */}
      <CenterComparison centers={filteredCenters} />

      {/* 상세 분석 탭 */}
      <Tabs defaultValue="item" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="item" className="text-xs py-2">
            항목별 현황
          </TabsTrigger>
          <TabsTrigger value="daily" className="text-xs py-2">
            일자별 현황
          </TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs py-2">
            주차별 현황
          </TabsTrigger>
          <TabsTrigger value="tenure" className="text-xs py-2">
            근속기간별
          </TabsTrigger>
          <TabsTrigger value="service" className="text-xs py-2">
            서비스별 주간
          </TabsTrigger>
        </TabsList>

        <TabsContent value="item" className="mt-4">
          <ItemAnalysis
            selectedCenter={selectedCenter}
            selectedService={selectedService}
            selectedChannel={selectedChannel}
            selectedTenure={selectedTenure}
          />
        </TabsContent>

        <TabsContent value="daily" className="mt-4">
          <DailyErrorTable />
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <WeeklyErrorTable />
        </TabsContent>

        <TabsContent value="tenure" className="mt-4">
          <TenureErrorTable />
        </TabsContent>

        <TabsContent value="service" className="mt-4">
          <ServiceWeeklyTable
            selectedCenter={selectedCenter}
            selectedService={selectedService}
            selectedChannel={selectedChannel}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
