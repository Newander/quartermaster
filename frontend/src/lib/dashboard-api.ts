import { api } from "@/lib/api-client"

export type DashboardDays = 7 | 30 | 90

export type NewMembersStatistics = {
  as_of: string
  current_month_start: string
  current_month_count: number
  previous_month_start: string
  previous_month_end: string
  previous_month_count: number
  delta_count: number
  delta_percent: number | null
}

export type GroupOccupancyStatistics = {
  start_date: string
  end_date: string
  sessions_count: number
  total_capacity: number
  total_attended: number
  occupancy_percent: number
}

export type ClubLoadPoint = {
  date: string
  trainings: number
  payments: number
}

export type ClubLoadStatistics = {
  start_date: string
  end_date: string
  days: number
  points: ClubLoadPoint[]
}

export type DashboardStatisticsResponse = {
  new_members: NewMembersStatistics
  group_occupancy: GroupOccupancyStatistics
  club_load: ClubLoadStatistics
}

type DashboardStatisticsParams = {
  days?: DashboardDays
  as_of?: string
  occupancy_start_date?: string
  occupancy_end_date?: string
  load_end_date?: string
}

export const getDashboardStatistics = (params: DashboardStatisticsParams = {}) =>
  api.get<DashboardStatisticsResponse>("/statistics/dashboard", {
    query: params,
  })
