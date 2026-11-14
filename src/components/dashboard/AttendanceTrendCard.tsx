import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { AttendanceTrendPoint } from '../../engine';
import { useShell } from '../../context/ShellContext';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui';

interface AttendanceTrendCardProps {
  points: AttendanceTrendPoint[];
  thresholdPercent: number;
}

export function AttendanceTrendCard({
  points,
  thresholdPercent,
}: AttendanceTrendCardProps) {
  const { resolvedTheme } = useShell();
  const isDark = resolvedTheme === 'dark';

  const gridStroke = isDark ? '#3F3430' : '#E5DFD9';
  const tickFill = isDark ? '#AFA49F' : '#786B66';
  const tooltipBg = isDark ? '#2E2320' : '#FDFCFB';
  const tooltipBorder = isDark ? '#3F3430' : '#E5DFD9';
  const textColor = isDark ? '#F7F5F2' : '#2E2320';
  const primaryColor = isDark ? '#B67EB7' : '#6D3B6E';
  const warningColor = isDark ? '#F3BF6E' : '#7D4F00';

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Attendance Trend</CardTitle>
          <CardDescription>
            Cumulative historical attendance progression vs. {thresholdPercent}% requirement
          </CardDescription>
        </div>
        <Badge variant="neutral">
          <TrendingUp className="h-3 w-3 text-[var(--primary)]" />
          {points.length} point{points.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1">
        {points.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-6 text-center text-xs text-[var(--text-secondary)]">
            No conducted classes recorded yet. Log attendance in My Attendance to plot your trend.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={points}
                margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="bunkwiseTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.35} />
                    <stop offset="70%" stopColor={primaryColor} stopOpacity={0.08} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickFill, fontSize: 11 }}
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
                  formatter={(value, _name, item) => {
                    const payload = item?.payload as AttendanceTrendPoint | undefined;
                    const pct = typeof value === 'number' ? `${value.toFixed(1)}%` : `${value ?? ''}%`;
                    if (!payload) return [pct, 'Attendance'];
                    return [
                      `${pct} (${payload.attendedCumulative}/${payload.conductedCumulative})`,
                      'Overall',
                    ];
                  }}
                  labelFormatter={(label, items) => {
                    const p = items?.[0]?.payload as AttendanceTrendPoint | undefined;
                    return p ? `${label} (${p.date})` : String(label);
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
                <Area
                  type="monotone"
                  dataKey="overallPercentage"
                  stroke={primaryColor}
                  strokeWidth={2.5}
                  fill="url(#bunkwiseTrendFill)"
                  activeDot={{ r: 5, fill: primaryColor, stroke: tooltipBg, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
