// src/routes/index.tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { AmortizedCostChart } from '@/components/AmortizedCostChart'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Amortized Asset Cost Calculator</h1>
            <p className="text-muted-foreground">
              Explore how asset maintenance costs grow over time and their amortized impact
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/max-hiring-fee">
              <Button variant="outline">
                Max Hiring Fee
              </Button>
            </Link>
            <Link to="/salary-comparison">
              <Button variant="outline">
                Compare Salaries
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <AmortizedCostChart />
    </div>
  )
}