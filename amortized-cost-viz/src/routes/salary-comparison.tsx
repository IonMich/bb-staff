// src/routes/salary-comparison.tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { SalaryComparisonChart } from '@/components/SalaryComparisonChart'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/salary-comparison')({
  component: SalaryComparison,
})

function SalaryComparison() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Salary vs Optimal Cost Analysis</h1>
            <p className="text-muted-foreground">
              Compare how starting salary affects optimal amortized cost and duration
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/max-hiring-fee">
              <Button variant="outline" size="sm">
                Max Hiring Fee
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="sm">
                Time Analysis
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <SalaryComparisonChart />
    </div>
  )
}