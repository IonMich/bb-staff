// Extract tooltip data to CSV for any level
// This script replicates the logic from MaxHiringFeeChart.tsx
// Usage: node extract-tooltip-data.js [level] [spacing]
// Example: node extract-tooltip-data.js 4 500

// Configuration from command line arguments
const LEVEL = parseInt(process.argv[2]) || 4; // Default to level 4
const SPACING = parseInt(process.argv[3]) || 500; // Default to $500 spacing

// Growth factor function
function growthFactor(level) {
  return 0.01 + (level - 1) * 0.0025; // 1% + (level-1) * 0.25%
}


// Calculate optimal amortized cost
function calculateOptimalAmortizedCost(hiringCostInput, salary, level) {
  const g = growthFactor(level);
  let minCost = Infinity;
  let optimalDuration = 1;
  
  for (let T = 1; T <= 150; T++) {
    const growthTerm = (Math.pow(1 + g, T + 1) - 1) / g;
    const amortizedCost = (hiringCostInput + salary * growthTerm) / T;
    
    if (amortizedCost < minCost) {
      minCost = amortizedCost;
      optimalDuration = T;
    }
  }
  
  return { cost: minCost, duration: optimalDuration };
}

// Binary search to find hiring cost for target
function findHiringCostForTarget(targetCost, salary, level) {
  let low = 1000;
  let high = 1000000;
  let bestHiringCost = 1000;
  let bestDuration = 1;
  
  for (let iter = 0; iter < 50; iter++) {
    const mid = (low + high) / 2;
    const result = calculateOptimalAmortizedCost(mid, salary, level);
    
    if (Math.abs(result.cost - targetCost) < 1) {
      bestHiringCost = mid;
      bestDuration = result.duration;
      break;
    }
    
    if (result.cost > targetCost) {
      high = mid;
    } else {
      low = mid;
    }
    
    bestHiringCost = mid;
    bestDuration = result.duration;
  }
  
  return { hiringCost: bestHiringCost, duration: bestDuration };
}

// Get configuration for the specified level
function getLevelConfig(level, spacing) {
  const baseConfigs = {
    3: {
      targetCosts: [7000, 8000, 9000, 10000],
      salaryMin: 4000,
      salaryMax: 8000
    },
    4: {
      targetCosts: [9000, 10000, 11000, 12000, 13000, 14000],
      salaryMin: 7000,
      salaryMax: 11000
    },
    5: {
      targetCosts: [14000, 16000, 18000, 20000, 22000, 24000, 26000],
      salaryMin: 10000,
      salaryMax: 20000
    }
  };
  
  const baseConfig = baseConfigs[level] || baseConfigs[3]; // Default to level 3
  
  // Generate salary range with custom spacing
  const numSteps = Math.floor((baseConfig.salaryMax - baseConfig.salaryMin) / spacing) + 1;
  const salaryRange = Array.from({length: numSteps}, (_, i) => baseConfig.salaryMin + i * spacing);
  
  return {
    targetCosts: baseConfig.targetCosts,
    salaryRange: salaryRange
  };
}

// Generate data for the specified level
const config = getLevelConfig(LEVEL, SPACING);
const { targetCosts, salaryRange } = config;

console.log(`Level ${LEVEL} Data Generation`);
console.log('='.repeat(30));
console.log(`Growth Factor: ${(growthFactor(LEVEL) * 100).toFixed(2)}%`);
console.log(`Salary Range: $${salaryRange[0].toLocaleString()} - $${salaryRange[salaryRange.length-1].toLocaleString()} (spacing: $${SPACING})`);
console.log(`Target Costs: ${targetCosts.map(c => `$${c.toLocaleString()}/week`).join(', ')}`);

// Generate CSV data
const fs = require('fs');

// Generate hiring fee table
console.log('\n=== HIRING FEES CSV ===');
const hiringFeesHeader = 'Salary,' + targetCosts.map(cost => `$${cost}/week`).join(',');
console.log(hiringFeesHeader);

const hiringFeesRows = [hiringFeesHeader];
for (const salary of salaryRange) {
  const row = [salary];
  
  for (const targetCost of targetCosts) {
    const result = findHiringCostForTarget(targetCost, salary, LEVEL);
    if (result.hiringCost > 1001 && result.hiringCost <= 1000000) {
      row.push(Math.round(result.hiringCost));
    } else {
      row.push(''); // Empty cell for invalid data
    }
  }
  
  const rowString = row.join(',');
  console.log(rowString);
  hiringFeesRows.push(rowString);
}

// Generate duration table
console.log('\n=== OPTIMAL DURATION CSV ===');
const durationHeader = 'Salary,' + targetCosts.map(cost => `$${cost}/week`).join(',');
console.log(durationHeader);

const durationRows = [durationHeader];
for (const salary of salaryRange) {
  const row = [salary];
  
  for (const targetCost of targetCosts) {
    const result = findHiringCostForTarget(targetCost, salary, LEVEL);
    if (result.hiringCost > 1001 && result.hiringCost <= 1000000) {
      row.push(result.duration);
    } else {
      row.push(''); // Empty cell for invalid data
    }
  }
  
  const rowString = row.join(',');
  console.log(rowString);
  durationRows.push(rowString);
}

// Write CSV files to output folder
const outputDir = 'output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const hiringFeesFilename = `${outputDir}/level${LEVEL}-hiring-fees.csv`;
const durationFilename = `${outputDir}/level${LEVEL}-optimal-duration.csv`;

fs.writeFileSync(hiringFeesFilename, hiringFeesRows.join('\n'));
fs.writeFileSync(durationFilename, durationRows.join('\n'));

console.log(`\n=== FILES GENERATED ===`);
console.log(`Created: ${hiringFeesFilename}`);
console.log(`Created: ${durationFilename}`);