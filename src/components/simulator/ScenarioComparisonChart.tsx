import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ScenarioOutcome } from '../../engine';
import { useShell } from '../../context/ShellContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui';

interface ScenarioComparisonChartProps {
  currentPercentage: number | null;
  scenarios: {
    A: ScenarioOutcome;
    B: ScenarioOutcome;
    C: ScenarioOutcome;
  };
  thresholdPercent: number;
  scopeLabel: string;
}

export function ScenarioComparisonChart({
  currentPercentage,
  scenarios,
  thresholdPercent,
  scopeLabel,
}: ScenarioComparisonChartProps) {
  const { resolvedTheme } = useShell();
  const isDark = resolvedTheme === 'dark';

  const gridStroke = isDark ? '#3F3430' : '#E5DFD9';
  const tickFill = isDark ? '#AFA49F' : '#786B66';
  const tooltipBg = isDark ? '#2E2320' : '#FDFCFB';
  const tooltipBorder = isDark ? '#3F3430' : '#E5DFD9';
  const textColor = isDark ? '#F7F5F2' : '#2E2320';
  const warningColor = isDark ? '#F3BF6E' : '#7D4F00';

  const currentFill = isDark ? '#AFA49F' : '#786B66';
  const scenarioAFill = isDark ? '#75C99E' : '#1A5A38';
  const scenarioBFill = isDark ? '#B67EB7' : '#6D3B6E';
  const scenarioCFill = isDark ? '#F3BF6E' : '#7D4F00';

  const data = [
    {
      name: 'Current',
      pct:
        currentPercentage !== null ? Number(currentPercentage.toFixed(1)) : 0,
      hasData: currentPercentage !== null,
      fill: currentFill,
    },
    {
      name: 'Scenario A',
      pct:
        scenarios.A.simulatedPercentage !== null
          ? Number(scenarios.A.simulatedPercentage.toFixed(1))
          : 0,
      hasData: scenarios.A.simulatedPercentage !== null,
      fill: scenarioAFill,
    },
    {
      name: 'Scenario B',
      pct:
        scenarios.B.simulatedPercentage !== null
          ? Number(scenarios.B.simulatedPercentage.toFixed(1))
          : 0,
      hasData: scenarios.B.simulatedPercentage !== null,
      fill: scenarioBFill,
    },
    {
      name: 'Scenario C',
      pct:
        scenarios.C.simulatedPercentage !== null
          ? Number(scenarios.C.simulatedPercentage.toFixed(1))
          : 0,
      hasData: scenarios.C.simulatedPercentage !== null,
      fill: scenarioCFill,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Scenario Comparison ({scopeLabel})</CardTitle>
          <CardDescription>
            Projected attendance across Scenarios A, B, and C vs. {thresholdPercent}% threshold
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
            >
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: tickFill, fontSize: 12 }}
                axisLine={{ stroke: gridStroke }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: tickFill, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(109, 59, 110, 0.08)' }}
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderRadius: '12px',
                  border: `1px solid ${tooltipBorder}`,
                  color: textColor,
                  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.15)',
                  fontSize: '12px',
                }}
                itemStyle={{ color: textColor }}
                labelStyle={{ color: tickFill, marginBottom: '4px' }}
                formatter={(val, _name, item) => {
                  const row = item?.payload as { hasData?: boolean } | undefined;
                  if (row && !row.hasData) return ['N/A', 'Attendance'];
                  return [`${val ?? 0}%`, 'Attendance'];
                }}
              />
              <ReferenceLine
                y={thresholdPercent}
                stroke={warningColor}
                strokeDasharray="4 4"
                label={{
                  value: `Min ${thresholdPercent}%`,
                  position: 'insideTopRight',
                  fill: warningColor,
                  fontSize: 11,
                }}
              />
              <Bar
                dataKey="pct"
                radius={[8, 8, 0, 0]}
                maxBarSize={56}
                animationDuration={350}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
