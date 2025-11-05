import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import API_CONFIG from '../../config/api';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const chartData = [
  { month: "Jan", desktop: 222, mobile: 150 },
  { month: "Feb", desktop: 297, mobile: 180 },
  { month: "Mar", desktop: 367, mobile: 220 },
  { month: "Apr", desktop: 242, mobile: 260 },
  { month: "May", desktop: 373, mobile: 290 },
  { month: "Jun", desktop: 301, mobile: 340 },
  { month: "Jul", desktop: 245, mobile: 180 },
  { month: "Aug", desktop: 409, mobile: 320 },
  { month: "Sep", desktop: 259, mobile: 210 },
  { month: "Oct", desktop: 261, mobile: 190 },
  { month: "Nov", desktop: 327, mobile: 350 },
  { month: "Dec", desktop: 292, mobile: 210 },
];

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
  mobile: {
    label: "Mobile",
    color: "hsl(var(--chart-2))",
  },
};

export function ChartAreaInteractive() {
  const [timeRange, setTimeRange] = React.useState("90d");

  const filteredData = React.useMemo(() => {
    if (timeRange === "7d") {
      return chartData.slice(-7);
    } else if (timeRange === "30d") {
      return chartData.slice(-4); // Last 4 months for 30d view
    }
    return chartData; // Show all 12 months for 90d view
  }, [timeRange]);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Area Chart - Interactive</CardTitle>
          <CardDescription>
            Showing total visitors by month
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Select a value"
          >
            <SelectValue placeholder="All Months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              All Months
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 4 Months
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 Months
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex-1 px-1 pt-2 sm:px-3 sm:pt-3">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-full w-full"
        >
          <AreaChart
            data={filteredData}
            margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
          >
            <defs>
              <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-desktop)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-desktop)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-mobile)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-mobile)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={0}
              interval={0}
              angle={0}
              textAnchor="middle"
              height={60}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(value) => value.toString()}
              width={50}
              tickCount={5}
              interval="preserveStartEnd"
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => value}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="mobile"
              type="natural"
              fill="url(#fillMobile)"
              stroke="var(--color-mobile)"
              stackId="a"
            />
            <Area
              dataKey="desktop"
              type="natural"
              fill="url(#fillDesktop)"
              stroke="var(--color-desktop)"
              stackId="a"
            />
            <ChartLegend
              content={<ChartLegendContent />}
              verticalAlign="bottom"
              height={30}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Role-aware area chart component for LVCampusConnect System admin dashboards
export function RoleAwareAreaChart({ userRole, effectiveRole }) {
  const [timeRange, setTimeRange] = React.useState("3months");
  const [chartData, setChartData] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Determine which role to use for chart configuration
  // Priority: effectiveRole (URL-based) > userRole (auth-based) > fallback
  const getEffectiveRoleFromPath = () => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/admin/registrar')) {
        return 'registrar_admin';
      } else if (currentPath.startsWith('/admin/admissions')) {
        return 'admissions_admin';
      } else if (currentPath.startsWith('/admin/mis')) {
        return 'super_admin';
      }
    }
    return null;
  };

  const roleForChart = effectiveRole || getEffectiveRoleFromPath() || userRole;

  // Helper function to determine department from role
  const getDepartmentFromRole = (role) => {
    if (role?.includes('Registrar')) return 'registrar';
    if (role?.includes('Admissions')) return 'admissions';
    // For MIS Super Admin, we'll fetch both departments
    return null;
  };

  // Fetch area chart data
  React.useEffect(() => {
    const fetchAreaChartData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (roleForChart === 'super_admin') {
          // Fetch data for both departments
          const [registrarResponse, admissionsResponse] = await Promise.all([
            fetch(`${API_CONFIG.getAdminUrl()}/api/analytics/area-chart/registrar?timeRange=${timeRange}`),
            fetch(`${API_CONFIG.getAdminUrl()}/api/analytics/area-chart/admissions?timeRange=${timeRange}`)
          ]);

          if (!registrarResponse.ok || !admissionsResponse.ok) {
            throw new Error('Failed to fetch data for one or both departments');
          }

          const registrarData = await registrarResponse.json();
          const admissionsData = await admissionsResponse.json();

          // Combine data by date
          const combinedData = {};

          // Process registrar data
          if (registrarData.success && registrarData.data) {
            registrarData.data.forEach(item => {
              if (!combinedData[item.date]) {
                combinedData[item.date] = { date: item.date, month: item.month, mobile: 0, desktop: 0 };
              }
              combinedData[item.date].mobile = item.count; // Registrar = mobile
            });
          }

          // Process admissions data
          if (admissionsData.success && admissionsData.data) {
            admissionsData.data.forEach(item => {
              if (!combinedData[item.date]) {
                combinedData[item.date] = { date: item.date, month: item.month, mobile: 0, desktop: 0 };
              }
              combinedData[item.date].desktop = item.count; // Admissions = desktop
            });
          }

          // Convert to array and sort by date
          const chartArray = Object.values(combinedData).sort((a, b) => new Date(a.date) - new Date(b.date));
          setChartData(chartArray);
        } else {
          // Fetch data for single department
          const department = getDepartmentFromRole(roleForChart);
          if (!department) {
            throw new Error('Unable to determine department from role');
          }

          const response = await fetch(
            `${API_CONFIG.getAdminUrl()}/api/analytics/area-chart/${department}?timeRange=${timeRange}`
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status}`);
          }

          const result = await response.json();

          if (result.success && result.data) {
            // Format data for single department
            const formattedData = result.data.map(item => ({
              date: item.date,
              month: item.month,
              mobile: department === 'registrar' ? item.count : 0,
              desktop: department === 'admissions' ? item.count : 0
            }));

            setChartData(formattedData);
          } else {
            throw new Error('Invalid data format received');
          }
        }
      } catch (err) {
        console.error('Error fetching area chart data:', err);
        setError(err.message);
        setChartData([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (roleForChart) {
      fetchAreaChartData();
    }
  }, [roleForChart, timeRange]);

  const filteredData = React.useMemo(() => {
    return chartData; // Data is already filtered by timeRange in the API call
  }, [chartData]);

  // Role-specific chart configurations
  const getChartConfig = () => {
    switch (roleForChart) {
      case 'super_admin':
        // MIS Super Admin: dual-wave with renamed legends using LVCampusConnect colors
        return {
          count: {
            label: "Queue Count",
          },
          desktop: {
            label: "Admissions Office",
            color: "#3762D0", // Blue
          },
          mobile: {
            label: "Registrar's Office",
            color: "#1F3463", // Navy blue (primary)
          },
        };
      case 'registrar_admin':
        // Registrar Admin: single-wave, no legend labels
        return {
          count: {
            label: "Queue Count",
          },
          mobile: {
            label: "",
            color: "#1F3463", // Navy blue (primary)
          },
        };
      case 'admissions_admin':
        // Admissions Admin: single-wave, no legend labels
        return {
          count: {
            label: "Queue Count",
          },
          desktop: {
            label: "",
            color: "#1F3463", // Navy blue (primary)
          },
        };
      default:
        // Fallback to original configuration
        return {
          count: { label: "Queue Count" },
          mobile: { label: "", color: "#1F3463" }
        };
    }
  };

  const roleSpecificConfig = getChartConfig();

  // Determine which areas to render based on role
  const shouldShowMobile = roleForChart === 'super_admin' || roleForChart === 'registrar_admin';
  const shouldShowDesktop = roleForChart === 'super_admin' || roleForChart === 'admissions_admin';
  const shouldShowLegend = roleForChart === 'super_admin';

  // Helper function to get time range description
  const getTimeRangeDescription = () => {
    switch (timeRange) {
      case '1month':
        return 'This Month';
      case '3months':
        return '3 Months';
      case '6months':
        return '6 Months';
      case 'year':
      default:
        return 'A Year';
    }
  };

  // Helper function to determine if we're showing daily data
  const isDailyView = timeRange === '1month';

  // Helper function to format X-axis labels
  const formatXAxisLabel = (value) => {
    if (isDailyView) {
      // For daily view, show day numbers
      return value;
    } else {
      // For monthly view, show month shortcuts
      return value;
    }
  };

  // Custom tooltip component with proper office names
  const CustomTooltipContent = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="font-medium text-gray-900 mb-2">
          {isDailyView ? `Day ${label}` : label}
        </p>
        {payload.map((entry, index) => {
          let officeName = '';

          // Determine office name based on role and data key
          if (entry.dataKey === 'mobile') {
            if (roleForChart === 'super_admin') {
              officeName = "Registrar's Office";
            } else if (roleForChart === 'registrar_admin') {
              officeName = "Queue Count";
            } else {
              officeName = "Registrar's Office"; // Fallback
            }
          } else if (entry.dataKey === 'desktop') {
            if (roleForChart === 'super_admin') {
              officeName = "Admissions Office";
            } else if (roleForChart === 'admissions_admin') {
              officeName = "Queue Count";
            } else {
              officeName = "Admissions Office"; // Fallback
            }
          } else {
            officeName = "Queue Count"; // Default fallback
          }

          return (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-600">
                {officeName}: <span className="font-medium text-gray-900">{entry.value}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="h-40 w-full bg-gray-200 rounded-lg animate-pulse mx-auto" />
  );

  // Error component
  const ErrorDisplay = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <div className="text-red-500 mb-2">⚠️</div>
      <div className="text-sm text-gray-600">{message}</div>
      <div className="text-xs text-gray-400 mt-1">Please try refreshing the page</div>
    </div>
  );

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle style={{ color: '#1F3463' }}>Queue Activity</CardTitle>
          <CardDescription>
            {getTimeRangeDescription()} • {isDailyView ? 'Daily' : 'Monthly'} queue volume
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Select a value"
          >
            <SelectValue placeholder="3 Months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="year" className="rounded-lg">
              A Year
            </SelectItem>
            <SelectItem value="6months" className="rounded-lg">
              6 Months
            </SelectItem>
            <SelectItem value="3months" className="rounded-lg">
              3 Months
            </SelectItem>
            <SelectItem value="1month" className="rounded-lg">
              This Month
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex-1 px-1 pt-2 sm:px-3 sm:pt-3">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorDisplay message={error} />
        ) : (
        <ChartContainer
          config={roleSpecificConfig}
          className="aspect-auto h-full w-full"
        >
          <AreaChart
            data={filteredData}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: shouldShowLegend ? 40 : 20
            }}
          >
            <defs>
              {shouldShowDesktop && (
                <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-desktop)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-desktop)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              )}
              {shouldShowMobile && (
                <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-mobile)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-mobile)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={isDailyView ? 20 : 32}
              interval={isDailyView ? "preserveStartEnd" : "preserveStartEnd"}
              angle={0}
              textAnchor="middle"
              height={60}
              tick={{ fontSize: 12 }}
              tickFormatter={formatXAxisLabel}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(value) => value.toString()}
              width={50}
              tickCount={5}
              interval="preserveStartEnd"
            />
            <ChartTooltip
              cursor={false}
              content={<CustomTooltipContent />}
            />
            {shouldShowMobile && (
              <Area
                dataKey="mobile"
                type="natural"
                fill="url(#fillMobile)"
                stroke="var(--color-mobile)"
                strokeWidth={2}
              />
            )}
            {shouldShowDesktop && (
              <Area
                dataKey="desktop"
                type="natural"
                fill="url(#fillDesktop)"
                stroke="var(--color-desktop)"
                strokeWidth={2}
              />
            )}
            {shouldShowLegend && (
              <ChartLegend
                content={<ChartLegendContent />}
                verticalAlign="bottom"
                height={30}
              />
            )}
          </AreaChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
