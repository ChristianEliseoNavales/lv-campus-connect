import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const DepartmentDonutChart = ({ data = [] }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  // Format data for the chart
  const chartData = data.map((item) => ({
    name: item.department,
    value: item.count,
    departmentKey: item.departmentKey
  }));

  // Colors for departments
  const COLORS = {
    registrar: '#150F5A', // Dark navy/purple
    admissions: '#3762D0'  // Medium blue
  };

  // Get color based on department key
  const getColor = (departmentKey) => {
    return COLORS[departmentKey] || '#1F3463';
  };

  // Handle mouse enter for active sector
  const handleMouseEnter = (index) => {
    setActiveIndex(index);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-gray-400 text-center">
          <p className="text-sm">No queue data available</p>
        </div>
      </div>
    );
  }

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={65}
            paddingAngle={2}
            dataKey="value"
            onMouseEnter={(_, index) => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColor(entry.departmentKey)}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
                style={{
                  filter: activeIndex === index ? 'drop-shadow(0 0 8px rgba(0,0,0,0.3))' : 'none',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 w-full space-y-2">
        {chartData.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between text-sm"
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getColor(item.departmentKey) }}
              />
              <span className="font-medium text-gray-800">{item.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">{item.value}</span>
              <span className="text-gray-500">({((item.value / total) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DepartmentDonutChart;

