import * as React from "react";
import { useState, useEffect } from "react";
import { Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
} from "@/components/ui/chart";

// LVCampusConnect System colors for pie chart
const serviceColors = [
  "#1F3463", // Navy blue (primary)
  "#3930A8", // Purple
  "#3762D0", // Blue
  "#78CFFF", // Light blue
];

// Helper function to determine department from user role or URL path
const getDepartmentFromContext = (userRole) => {
  // Check URL path first
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/admin/registrar')) {
      return 'registrar';
    } else if (currentPath.startsWith('/admin/admissions')) {
      return 'admissions';
    }
  }

  // Fallback to user role
  if (userRole === 'registrar_admin') {
    return 'registrar';
  } else if (userRole === 'admissions_admin') {
    return 'admissions';
  }

  // Default for super admin - could be either, we'll use registrar as default
  return 'registrar';
};

// Helper function to format date range description
const getDateRangeDescription = (timeRange) => {
  const now = new Date();
  const currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  switch (timeRange) {
    case '1month':
      return `${currentMonth}`;
    case '3months':
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return `${threeMonthsAgo.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    case '6months':
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      return `${sixMonthsAgo.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    case 'all':
    default:
      return 'All Time';
  }
};

// Custom Legend Component for vertical layout with percentages
const CustomLegend = ({ data, total }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col space-y-2 mt-4">
        <div className="text-sm text-gray-500 text-center">No data available</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2 mt-4">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: serviceColors[index] || '#ccc' }}
            />
            <span className="text-sm font-medium">{item.service}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">{item.count}</span>
            <span className="text-sm text-gray-500">({item.percentage}%)</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="flex flex-col h-full">
    <div className="mx-auto aspect-square h-[200px] w-full flex-shrink-0 bg-gray-200 rounded-full animate-pulse" />
    <div className="flex flex-col space-y-2 mt-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-sm bg-gray-200 animate-pulse" />
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

// Error component
const ErrorDisplay = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-4">
    <div className="text-red-500 mb-2">⚠️</div>
    <div className="text-sm text-gray-600">{message}</div>
    <div className="text-xs text-gray-400 mt-1">Please try refreshing the page</div>
  </div>
);

export function ChartPieLegend({ userRole, timeRange = '3months' }) {
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [department, setDepartment] = useState('registrar');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Determine department and super admin status based on user role or URL
  useEffect(() => {
    const isSuper = userRole === 'super_admin' || window.location.pathname.startsWith('/admin/mis');
    setIsSuperAdmin(isSuper);

    if (!isSuper) {
      const dept = getDepartmentFromContext(userRole);
      setDepartment(dept);
    }
  }, [userRole]);

  // Fetch pie chart data
  useEffect(() => {
    const fetchPieChartData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use combined endpoint for super admin, department-specific for others
        const endpoint = isSuperAdmin
          ? `http://localhost:5000/api/analytics/pie-chart/combined?timeRange=${timeRange}`
          : `http://localhost:5000/api/analytics/pie-chart/${department}?timeRange=${timeRange}`;

        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          // Format data for the chart
          const formattedData = result.data.map((item, index) => ({
            ...item,
            fill: serviceColors[index] || '#ccc'
          }));

          setChartData(formattedData);
          setTotal(result.total || 0);
        } else {
          throw new Error('Invalid data format received');
        }
      } catch (err) {
        console.error('Error fetching pie chart data:', err);
        setError(err.message);
        setChartData([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    if (isSuperAdmin || department) {
      fetchPieChartData();
    }
  }, [isSuperAdmin, department, timeRange]);

  // Generate chart config dynamically
  const chartConfig = {
    count: {
      label: "Queue Count",
    },
    ...chartData.reduce((config, item, index) => {
      config[`service-${index}`] = {
        label: item.service,
        color: serviceColors[index] || '#ccc'
      };
      return config;
    }, {})
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle style={{ color: '#1F3463' }}>Service Distribution</CardTitle>
          <CardDescription>
            {getDateRangeDescription(timeRange)} • {department === 'registrar' ? "Registrar's Office" : 'Admissions Office'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorDisplay message={error} />
        ) : (
          <div className="flex flex-col h-full">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square h-[200px] w-full flex-shrink-0"
            >
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="service"
                />
              </PieChart>
            </ChartContainer>
            <CustomLegend data={chartData} total={total} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
