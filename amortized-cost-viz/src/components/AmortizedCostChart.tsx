import { useMemo, useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ReferenceDot } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Edit } from "lucide-react"

interface AmortizedCostParams {
  startingSalary: number
  level: number
  maxWeeks: number
}

interface HiringCostData {
  [level: number]: {
    [salary: number]: number | null
  }
}

interface HiringCostFormula {
  type: 'interpolated' | 'manual'
  formula: string
  parameters: { [level: number]: { points: Array<{salary: number, cost: number}> } }
  rSquared?: number
}

interface ChartDataPoint {
  week: number
  amortizedCost: number
  cumulativeCost: number
  weeklyMaintenance: number
}

const chartConfig = {
  amortizedCost: {
    label: "Amortized Cost",
    color: "var(--chart-1)",
  },
  cumulativeCost: {
    label: "Cumulative Cost", 
    color: "var(--chart-2)",
  },
  weeklyMaintenance: {
    label: "Weekly Maintenance",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

// Growth factor function: g(ell) = (ell-1) * 0.25%
// Level 1 (minimal): 1%, Level 2 (basic): 1.25%, Level 3 (competent): 1.5%, 
// Level 4 (advanced): 1.75%, Level 5 (superior): 2%, Level 6 (exceptional): 2.25%, Level 7 (world-renowned): 2.5%
function growthFactor(level: number): number {
  return 0.01 + (level - 1) * 0.0025 // 1% base + 0.25% per level above 1
}

// Market data from your observations
const INITIAL_HIRING_DATA: HiringCostData = {
  3: {
    6000: 30000,
    7000: 10000,
    8000: 1000,
    9000: 1000,
    10000: 1000,
    11000: 1000,
    12000: 1000,
  },
  4: {
    9000: 40000,
    10000: 20000,
    11000: 5000,
    12000: 1000,
    13000: 1000,
    14000: 1000,
  }
}

// Linear interpolation with logical extrapolation
function interpolateHiringCost(salary: number, points: Array<{salary: number, cost: number}>): number | null {
  if (points.length === 0) return null
  if (points.length === 1) return points[0].cost
  
  // Sort points by salary
  const sortedPoints = [...points].sort((a, b) => a.salary - b.salary)
  
  // Check if salary is exactly at a data point
  const exactMatch = sortedPoints.find(p => p.salary === salary)
  if (exactMatch) return exactMatch.cost
  
  // Extrapolate below the lowest data point using the slope of the first two points
  if (salary < sortedPoints[0].salary && sortedPoints.length >= 2) {
    const p1 = sortedPoints[0]
    const p2 = sortedPoints[1]
    const slope = (p2.cost - p1.cost) / (p2.salary - p1.salary)
    return p1.cost + slope * (salary - p1.salary)
  }
  
  // Extrapolate above the highest data point using the slope of the last two points
  if (salary > sortedPoints[sortedPoints.length - 1].salary && sortedPoints.length >= 2) {
    const p1 = sortedPoints[sortedPoints.length - 2]
    const p2 = sortedPoints[sortedPoints.length - 1]
    const slope = (p2.cost - p1.cost) / (p2.salary - p1.salary)
    return p2.cost + slope * (salary - p2.salary)
  }
  
  // Interpolate between data points
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const p1 = sortedPoints[i]
    const p2 = sortedPoints[i + 1]
    
    if (salary >= p1.salary && salary <= p2.salary) {
      // Linear interpolation
      const ratio = (salary - p1.salary) / (p2.salary - p1.salary)
      return p1.cost + ratio * (p2.cost - p1.cost)
    }
  }
  
  return null
}

// Generate interpolation-based formula for all levels
function generateHiringFormula(data: HiringCostData): HiringCostFormula {
  const parameters: { [level: number]: { points: Array<{salary: number, cost: number}> } } = {}
  
  for (const [levelStr, salaryData] of Object.entries(data)) {
    const level = parseInt(levelStr)
    const entries = Object.entries(salaryData).filter(([, cost]) => cost !== null)
    
    if (entries.length >= 1) {
      const points = entries.map(([salaryStr, cost]) => ({
        salary: parseInt(salaryStr),
        cost: cost!
      }))
      parameters[level] = { points }
    }
  }
  
  return {
    type: 'interpolated',
    formula: 'Linear interpolation between data points',
    parameters
  }
}

// Hiring cost function using interpolation
function hiringCost(startingSalary: number, level: number, formula: HiringCostFormula): number {
  const params = formula.parameters[level]
  if (!params || !params.points || params.points.length === 0) {
    // Fallback for levels without data
    return 1000
  }
  
  const interpolated = interpolateHiringCost(startingSalary, params.points)
  return interpolated !== null ? Math.max(1000, interpolated) : 1000
}

// Amortized cost calculation: A(S,T,ell) = (h(S, ell) + S * ((1+g(ell))^(T+1)-1)/g(ell)) / T
function calculateAmortizedCost(S: number, T: number, level: number, hiringFormula: HiringCostFormula): number {
  const g = growthFactor(level)
  const h = hiringCost(S, level, hiringFormula)
  
  if (g === 0) {
    // Handle edge case where growth factor is 0
    return (h + S * (T + 1)) / T
  }
  
  const maintenanceSum = S * (Math.pow(1 + g, T + 1) - 1) / g
  return (h + maintenanceSum) / T
}

// Find the minimum of the amortized cost function analytically
function findAmortizedCostMinimum(S: number, level: number, hiringFormula: HiringCostFormula): { week: number; cost: number } | null {
  const g = growthFactor(level)
  const h = hiringCost(S, level, hiringFormula)
  
  if (g === 0) {
    // For g=0, function is monotonically decreasing, no minimum
    return null
  }
  
  // Derivative of A(S,T,ell) with respect to T equals 0 at minimum
  // This requires solving a transcendental equation, so we'll use numerical approximation
  // The minimum typically occurs when the derivative changes sign
  
  let minWeek = 1
  let minCost = calculateAmortizedCost(S, 1, level, hiringFormula)
  
  // Search for minimum in reasonable range (1 to 500 weeks)
  for (let t = 1; t <= 500; t++) {
    const cost = calculateAmortizedCost(S, t, level, hiringFormula)
    if (cost < minCost) {
      minCost = cost
      minWeek = t
    }
  }
  
  return { week: minWeek, cost: minCost }
}

export function AmortizedCostChart() {
  const [params, setParams] = useState<AmortizedCostParams>({
    startingSalary: 8000,
    level: 3,
    maxWeeks: 52,
  })
  
  const [hiringData, setHiringData] = useState<HiringCostData>(INITIAL_HIRING_DATA)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showAdvancedLevels, setShowAdvancedLevels] = useState(false)
  
  const hiringFormula = useMemo(() => generateHiringFormula(hiringData), [hiringData])

  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = []
    const g = growthFactor(params.level)
    const h = hiringCost(params.startingSalary, params.level, hiringFormula)
    
    for (let week = 1; week <= params.maxWeeks; week++) {
      const amortizedCost = calculateAmortizedCost(params.startingSalary, week, params.level, hiringFormula)
      
      // Calculate cumulative cost up to this week
      let cumulativeCost = h
      for (let w = 0; w <= week; w++) {
        cumulativeCost += params.startingSalary * Math.pow(1 + g, w)
      }
      
      // Current week's maintenance cost
      const weeklyMaintenance = params.startingSalary * Math.pow(1 + g, week)
      
      data.push({
        week,
        amortizedCost,
        cumulativeCost,
        weeklyMaintenance,
      })
    }
    
    return data
  }, [params, hiringFormula])

  const minimum = useMemo(() => {
    return findAmortizedCostMinimum(params.startingSalary, params.level, hiringFormula)
  }, [params.startingSalary, params.level, hiringFormula])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Starting Salary ($)</label>
          <input
            type="number"
            step="500"
            min={(() => {
              if (params.level === 3) return 4000
              else if (params.level === 4) return 7000
              else if (params.level === 5) return 10000
              else return 8000
            })()}
            max={(() => {
              if (params.level === 3) return 8000
              else if (params.level === 4) return 11000
              else if (params.level === 5) return 20000
              else return 16000
            })()}
            value={params.startingSalary}
            onChange={(e) => setParams(prev => ({...prev, startingSalary: Number(e.target.value)}))}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Asset Level</label>
          <input
            type="number"
            min="1"
            max="10"
            value={params.level}
            onChange={(e) => setParams(prev => ({...prev, level: Number(e.target.value)}))}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Max Weeks</label>
          <input
            type="number"
            min="1"
            max="104"
            value={params.maxWeeks}
            onChange={(e) => setParams(prev => ({...prev, maxWeeks: Number(e.target.value)}))}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <strong>Growth Factor g(ℓ):</strong> {(growthFactor(params.level) * 100).toFixed(2)}%
        </div>
        <div className="flex items-center gap-2">
          <div>
            <strong>Hiring Cost h(S,ℓ):</strong> ${(Math.round(hiringCost(params.startingSalary, params.level, hiringFormula) / 1000) * 1000).toLocaleString()}
            <div className="text-xs text-muted-foreground mt-1">
              {hiringFormula.formula}
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="!max-w-[80vw] !w-[80vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Hiring Cost Data</DialogTitle>
                <DialogDescription>
                  Edit market data with linear interpolation between points
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setHiringData(INITIAL_HIRING_DATA)}
                  >
                    Reset to Market Data
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAdvancedLevels(!showAdvancedLevels)}
                  >
                    {showAdvancedLevels ? 'Hide' : 'Show'} Levels 5-7
                  </Button>
                  <Button onClick={() => setDialogOpen(false)}>
                    Apply Changes
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {(showAdvancedLevels ? [3, 4, 5, 6, 7] : [3, 4]).map(level => (
                    <div key={level} className="space-y-3">
                      <h4 className="font-medium">Level {level}</h4>
                      {hiringFormula.parameters[level] && (
                        <div className="text-xs text-muted-foreground mb-2">
                          {hiringFormula.parameters[level].points.length} data points, linear interpolation
                        </div>
                      )}
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left">Salary</th>
                              <th className="p-2 text-right">Hiring Cost</th>
                              <th className="p-2 text-right">Interpolated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              let salaryRange = []
                              if (level === 3) salaryRange = [4000, 5000, 6000, 7000, 8000]
                              else if (level === 4) salaryRange = [7000, 8000, 9000, 10000, 11000]
                              else if (level === 5) salaryRange = [10000, 12000, 14000, 16000, 18000, 20000]
                              else salaryRange = [8000, 10000, 12000, 14000, 16000]
                              return salaryRange
                            })().map(salary => {
                              const currentValue = hiringData[level]?.[salary]
                              const interpolatedValue = hiringFormula.parameters[level] 
                                ? hiringCost(salary, level, hiringFormula)
                                : null
                              
                              return (
                                <tr key={salary} className="border-t">
                                  <td className="p-2 font-medium">${salary.toLocaleString()}</td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      step="1000"
                                      value={currentValue || ''}
                                      placeholder="No data"
                                      onChange={(e) => {
                                        const value = e.target.value ? Number(e.target.value) : null
                                        setHiringData(prev => ({
                                          ...prev,
                                          [level]: {
                                            ...prev[level],
                                            [salary]: value
                                          }
                                        }))
                                      }}
                                      className="w-full px-2 py-1 text-right text-xs border rounded"
                                    />
                                  </td>
                                  <td className="p-2 text-right text-xs text-muted-foreground">
                                    {interpolatedValue ? `$${Math.round(interpolatedValue).toLocaleString()}` : '-'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {minimum && minimum.week <= params.maxWeeks && (
          <div>
            <strong>Optimal Duration:</strong> {minimum.week} weeks (${Math.round(minimum.cost).toLocaleString()}/week)
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Amortized Cost Analysis</CardTitle>
          <CardDescription>
            Interactive visualization of A(S,T,ℓ) = (h(S,ℓ) + S × ((1+g(ℓ))^(T+1)-1)/g(ℓ)) / T
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `Week ${value}`}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
                formatter={(value, name) => [
                  `$${Number(value).toLocaleString()}`,
                  chartConfig[name as keyof typeof chartConfig]?.label || name
                ]}
              />
              <Line
                dataKey="amortizedCost"
                type="monotone"
                stroke="var(--color-amortizedCost)"
                strokeWidth={3}
                dot={false}
              />
              <Line
                dataKey="weeklyMaintenance"
                type="monotone"
                stroke="var(--color-weeklyMaintenance)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
              {minimum && minimum.week <= params.maxWeeks && (
                <ReferenceDot
                  x={minimum.week}
                  y={minimum.cost}
                  r={6}
                  fill="var(--color-amortizedCost)"
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}