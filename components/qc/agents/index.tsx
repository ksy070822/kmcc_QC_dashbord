"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AgentFilters } from "./agent-filters"
import { AgentTable } from "./agent-table"
import { AgentDetailModal } from "./agent-detail-modal"
import { useAgents } from "@/hooks/use-agents"
import { Users, TrendingDown, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"

export function AgentAnalysis() {
  const [search, setSearch] = useState("")
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedServiceGroup, setSelectedServiceGroup] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // BigQuery에서 데이터 가져오기
  const { data: agents, loading, error } = useAgents({
    center: selectedCenter,
    service: selectedServiceGroup,
    channel: selectedChannel,
    tenure: selectedTenure,
  })

  const agentRows = useMemo(() => {
    return (agents || []).map((agent) => {
      const errorRate = agent.overallErrorRate
      return {
        id: agent.id,
        name: agent.name,
        center: agent.center,
        group: `${agent.service}/${agent.channel}`,
        tenure: agent.tenureGroup,
        errorRate,
        trend: 0, // TODO: 전주 대비 계산
        totalCalls: agent.totalEvaluations,
        totalErrors: Math.floor((agent.attitudeErrorRate + agent.opsErrorRate) / 2),
        topIssue: "분석 중", // TODO: 항목별 오류 집계
        status: (errorRate > 4 ? "위험" : "양호") as "양호" | "위험",
      }
    })
  }, [agents])

  const filteredAgents = useMemo(() => {
    return agentRows.filter((agent) => {
      if (search && !agent.name.toLowerCase().includes(search.toLowerCase())) return false
      if (selectedCenter !== "all" && agent.center !== selectedCenter) return false
      if (selectedChannel !== "all" && !agent.group.includes(selectedChannel === "유선" ? "유선" : "채팅")) return false
      if (selectedServiceGroup !== "all" && !agent.group.includes(selectedServiceGroup)) return false
      // tenure 필터는 데이터가 없으므로 주석 처리
      // if (selectedTenure !== "all" && agent.tenure !== selectedTenure) return false
      return true
    })
  }, [agentRows, search, selectedCenter, selectedChannel, selectedServiceGroup])

  const handleSelectAgent = (agent: any) => {
    setSelectedAgent(agent)
    setDetailModalOpen(true)
  }

  const stats = useMemo(() => {
    const avgErrorRate =
      filteredAgents.length > 0 ? filteredAgents.reduce((sum, a) => sum + a.errorRate, 0) / filteredAgents.length : 0
    const riskCount = filteredAgents.filter((a) => a.status === "위험").length
    const safeCount = filteredAgents.filter((a) => a.status === "양호").length
    return { avgErrorRate, riskCount, safeCount }
  }, [filteredAgents])

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">상담사 분석</h1>
        <p className="text-sm text-slate-500">센터별, 서비스별, 채널별, 근속기간별 상담사 현황을 확인합니다.</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          <strong>데이터 로드 오류:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>데이터 로딩 중...</span>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white border border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">필터된 상담사</p>
                <p className="text-3xl font-bold text-slate-900">{filteredAgents.length}<span className="text-lg font-normal text-slate-500">명</span></p>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">평균 오류율</p>
                <p className="text-3xl font-bold text-slate-900">{stats.avgErrorRate.toFixed(2)}<span className="text-lg font-normal text-slate-500">%</span></p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 border border-red-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">위험</p>
                <p className="text-3xl font-bold text-red-600">{stats.riskCount}<span className="text-lg font-normal text-slate-500">명</span></p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 border border-green-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">양호</p>
                <p className="text-3xl font-bold text-green-600">{stats.safeCount}<span className="text-lg font-normal text-slate-500">명</span></p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 상담사 목록 */}
      <Card className="bg-white border border-slate-200">
        <CardHeader className="pb-4 border-b border-slate-100">
          <CardTitle className="text-lg text-slate-900">상담사 목록</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <AgentFilters
            search={search}
            onSearchChange={setSearch}
            selectedCenter={selectedCenter}
            onCenterChange={setSelectedCenter}
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            selectedServiceGroup={selectedServiceGroup}
            onServiceGroupChange={setSelectedServiceGroup}
            selectedTenure={selectedTenure}
            onTenureChange={setSelectedTenure}
          />
          <AgentTable agents={filteredAgents} onSelectAgent={handleSelectAgent} />
        </CardContent>
      </Card>

      <AgentDetailModal open={detailModalOpen} onOpenChange={setDetailModalOpen} agent={selectedAgent} />
    </div>
  )
}
