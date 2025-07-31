import { useMemo, useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Legend } from "recharts"
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

interface MaxHiringFeeParams {
  level: number
}

interface SalaryHiringFeePoint {
  salary: number
  [key: string]: number // Dynamic keys for different target costs like "cost6000", "cost7000", etc.
}

// Dynamic chart config will be generated based on target costs
const generateChartConfig = (targetCosts: number[]): ChartConfig => {
  const config: ChartConfig = {}
  const colors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-1", "--chart-2"]
  
  // For legend: natural order (lowest to highest)
  // For colors: consistent with original order
  targetCosts.forEach((cost, index) => {
    config[`cost${cost}`] = {
      label: `$${cost.toLocaleString()}/week`,
      color: `var(${colors[index % colors.length]})`
    }
  })
  
  return config
}

// Growth factor function: g(ell) = (ell-1) * 0.25%
function growthFactor(level: number): number {
  return 0.01 + (level - 1) * 0.0025 // 1% base + 0.25% per level above 1
}

// Calculate optimal duration given hiring cost h, salary S, and level ℓ
// Taking derivative of A(S,T,ℓ) = (h + S × ((1+g(ℓ))^(T+1)-1)/g(ℓ)) / T with respect to T
// Setting to 0 and solving gives us the optimal T as a function of h
function findOptimalDuration(hiringCost: number, salary: number, level: number): number {
  const g = growthFactor(level)
  
  if (g === 0) {
    // For g=0, amortized cost = (h + S*(T+1))/T = h/T + S + S/T
    // Derivative = -h/T² - S/T² = -(h+S)/T²
    // Always negative, so function is decreasing - no minimum exists in practice
    return 100 // Return reasonable default
  }
  
  // For the general case, we need to solve numerically since the derivative equation is transcendental
  // dA/dT = 0 leads to: h/T² = S*(1+g)^(T+1) * ln(1+g) / T - S*((1+g)^(T+1)-1)/(g*T²)
  
  let bestT = 1
  let minCost = Infinity
  
  for (let T = 1; T <= 500; T++) {
    const maintenanceSum = salary * (Math.pow(1 + g, T + 1) - 1) / g
    const amortizedCost = (hiringCost + maintenanceSum) / T
    
    if (amortizedCost < minCost) {
      minCost = amortizedCost
      bestT = T
    }
  }
  
  return bestT
}

// Calculate amortized cost at optimal duration for given hiring cost
function calculateOptimalAmortizedCost(hiringCost: number, salary: number, level: number): { cost: number; duration: number } {
  const optimalDuration = findOptimalDuration(hiringCost, salary, level)
  const g = growthFactor(level)
  
  let maintenanceSum: number
  if (g === 0) {
    maintenanceSum = salary * (optimalDuration + 1)
  } else {
    maintenanceSum = salary * (Math.pow(1 + g, optimalDuration + 1) - 1) / g
  }
  
  const amortizedCost = (hiringCost + maintenanceSum) / optimalDuration
  
  return { cost: amortizedCost, duration: optimalDuration }
}

// Find hiring cost that achieves target amortized cost at optimal duration
function findHiringCostForTarget(targetCost: number, salary: number, level: number): { hiringCost: number; duration: number } {
  // Binary search for the hiring cost that gives us the target amortized cost
  let low = 1000
  let high = 1000000 // 1M max hiring cost
  let bestHiringCost = 1000
  let bestDuration = 1
  
  for (let iter = 0; iter < 50; iter++) { // Binary search iterations
    const mid = (low + high) / 2
    const result = calculateOptimalAmortizedCost(mid, salary, level)
    
    if (Math.abs(result.cost - targetCost) < 1) { // Close enough
      bestHiringCost = mid
      bestDuration = result.duration
      break
    }
    
    if (result.cost > targetCost) {
      high = mid // Too expensive, reduce hiring cost
    } else {
      low = mid // Too cheap, increase hiring cost
    }
    
    bestHiringCost = mid
    bestDuration = result.duration
  }
  
  return { hiringCost: bestHiringCost, duration: bestDuration }
}

export function MaxHiringFeeChart() {
  const [params, setParams] = useState<MaxHiringFeeParams>({
    level: 3,
  })
  
  // Define target costs based on level
  const targetCosts = useMemo(() => {
    if (params.level === 3) return [7000, 8000, 9000, 10000]
    else if (params.level === 4) return [9000, 10000, 11000, 12000, 13000, 14000]
    else if (params.level === 5) return [14000, 16000, 18000, 20000, 22000, 24000, 26000]
    else return [7000, 8000, 9000, 10000] // Default
  }, [params.level])
  
  const chartConfig = useMemo(() => generateChartConfig(targetCosts), [targetCosts])

  const salaryData = useMemo(() => {
    // Get salary range based on level
    let salaryRange: number[] = []
    if (params.level === 3) salaryRange = Array.from({length: 21}, (_, i) => 4000 + i * 200) // 4k to 8k in 200 increments
    else if (params.level === 4) salaryRange = Array.from({length: 21}, (_, i) => 7000 + i * 200) // 7k to 11k in 200 increments
    else if (params.level === 5) salaryRange = Array.from({length: 51}, (_, i) => 10000 + i * 200) // 10k to 20k in 200 increments
    else salaryRange = Array.from({length: 41}, (_, i) => 8000 + i * 200) // 8k to 16k in 200 increments
    
    const data: SalaryHiringFeePoint[] = []
    
    for (const salary of salaryRange) {
      const dataPoint: SalaryHiringFeePoint = { salary }
      let hasValidData = false
      
      // Calculate hiring cost for each target cost
      for (const targetCost of targetCosts) {
        const result = findHiringCostForTarget(targetCost, salary, params.level)
        
        // Only include reasonable hiring fees, exclude values too close to the search bounds
        if (result.hiringCost > 1001 && result.hiringCost <= 1000000) {
          dataPoint[`cost${targetCost}`] = result.hiringCost
          dataPoint[`duration${targetCost}`] = result.duration // Store duration too
          hasValidData = true
        }
      }
      
      if (hasValidData) {
        data.push(dataPoint)
      }
    }
    
    return data
  }, [params, targetCosts])

  return (
    <div className="space-y-6">


      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Maximum Hiring Fee by Salary</CardTitle>
              <CardDescription>
                Multiple lines showing maximum hiring fees for different target amortized costs
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <div className="text-sm">
                <strong>Growth Factor g(ℓ):</strong> {(growthFactor(params.level) * 100).toFixed(2)}%
              </div>
              <select
                value={params.level}
                onChange={(e) => setParams(prev => ({...prev, level: Number(e.target.value)}))}
                className="px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value={1}>1 - Minimal</option>
                <option value={2}>2 - Basic</option>
                <option value={3}>3 - Competent</option>
                <option value={4}>4 - Advanced</option>
                <option value={5}>5 - Superior</option>
                <option value={6}>6 - Exceptional</option>
                <option value={7}>7 - World-renowned</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <LineChart
              accessibilityLayer
              data={salaryData}
              margin={{
                left: 12,
                right: 12,
                bottom: 60, // Extra space for legend
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="salary"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${(value/1000).toFixed(0)}K`}
                interval="preserveStartEnd"
                ticks={(() => {
                  // Generate reasonable tick marks based on the salary range
                  if (params.level === 3) return [4000, 5000, 6000, 7000, 8000]
                  else if (params.level === 4) return [7000, 8000, 9000, 10000, 11000]
                  else if (params.level === 5) return [10000, 12000, 14000, 16000, 18000, 20000]
                  else return [8000, 10000, 12000, 14000, 16000]
                })()}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${(value/1000).toFixed(0)}K`}
              />
              <ChartTooltip
                cursor={false}
                content={(props) => {
                  if (!props.active || !props.payload || props.payload.length === 0) return null
                  
                  // Sort payload in descending order by target cost for display
                  const sortedPayload = props.payload
                    .filter(item => item.name?.startsWith('cost'))
                    .sort((a, b) => {
                      const costA = Number(a.name?.replace('cost', '') || 0)
                      const costB = Number(b.name?.replace('cost', '') || 0)
                      return costB - costA // Descending order
                    })
                  
                  // Create new props object with sorted payload for ChartTooltipContent
                  const sortedProps = {
                    ...props,
                    payload: sortedPayload
                  }
                  
                  return <ChartTooltipContent {...sortedProps} />
                }}
                formatter={(value, name, props) => {
                  if (name.startsWith('cost')) {
                    const targetCost = name.replace('cost', '')
                    const duration = props.payload[`duration${targetCost}`]
                    const colorVar = `var(--color-cost${targetCost})`
                    return [
                      <span key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span 
                          style={{ 
                            width: '12px', 
                            height: '2px', 
                            backgroundColor: colorVar,
                            display: 'inline-block'
                          }}
                        />
                        Pay up to ${Math.round(Number(value)).toLocaleString()} and keep {duration} weeks at $${Number(targetCost).toLocaleString()}/week
                      </span>, 
                      ''
                    ]
                  }
                  return [value, name]
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    const data = payload[0]?.payload
                    return data?.salary ? `Salary: $${data.salary.toLocaleString()}` : 'Salary: --'
                  }
                  return 'Salary: --'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => {
                  if (value.startsWith('cost')) {
                    const targetCost = value.replace('cost', '')
                    return `$${Number(targetCost).toLocaleString()}/week`
                  }
                  return value
                }}
              />
              {targetCosts.map((targetCost, index) => (
                <Line
                  key={`cost${targetCost}`}
                  dataKey={`cost${targetCost}`}
                  type="monotone"
                  stroke={`var(--color-cost${targetCost})`}
                  strokeWidth={index === Math.floor(targetCosts.length / 2) ? 3 : 2} // Make middle line thicker
                  dot={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground space-y-2">
        <div>
          <strong>How to use:</strong> Each line represents a different target amortized cost. 
          Find your desired salary on the X-axis and see the maximum hiring fees for different weekly cost targets.
        </div>
        <div>
          <strong>Reading the chart:</strong> Higher lines = higher target costs = willing to pay weekly more on average and keep staff member longer.
          Use the legend below the chart to identify each line.
        </div>
      </div>
    </div>
  )
}