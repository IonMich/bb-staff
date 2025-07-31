// src/routes/max-hiring-fee.tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { MaxHiringFeeChart } from '@/components/MaxHiringFeeChart'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/max-hiring-fee')({
  component: MaxHiringFee,
})

function MaxHiringFee() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Maximum Hiring Fee Calculator</h1>
            <p className="text-muted-foreground">
              For a target amortized cost, find the maximum you should pay to hire at different salary levels
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/salary-comparison">
              <Button variant="outline" size="sm">
                Salary Compare
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
      <MaxHiringFeeChart />
    </div>
  )
}