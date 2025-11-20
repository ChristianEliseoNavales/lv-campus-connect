import React, { useState, useEffect, useRef } from 'react';
import { MdClose, MdDownload } from 'react-icons/md';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as AreaTooltip } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import API_CONFIG from '../../config/api';
import { authFetch } from '../../utils/apiClient';
import { getPhilippineStartOfDayISO, getPhilippineEndOfDayISO } from '../../utils/philippineTimezone';

const AnalyticalReportModal = ({ isOpen, onClose, userRole, dateRange }) => {
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportRef = useRef(null);

  useEffect(() => {
    if (isOpen && userRole && dateRange) {
      fetchReportData();
    }
  }, [isOpen, userRole, dateRange]);

  const fetchReportData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const baseUrl = API_CONFIG.getAdminUrl();

      // Build query params with date range using Philippine timezone
      const params = new URLSearchParams();
      if (dateRange?.startDate) {
        // Use Philippine timezone start of day (00:00:00 PHT)
        const startISO = getPhilippineStartOfDayISO(dateRange.startDate);
        params.append('startDate', startISO);
      }
      if (dateRange?.endDate) {
        // Use Philippine timezone end of day (23:59:59.999 PHT)
        const endISO = getPhilippineEndOfDayISO(dateRange.endDate);
        params.append('endDate', endISO);
      }

      console.log('📅 AnalyticalReportModal - Date Range (Philippine Time):', {
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
        startDateISO: params.get('startDate'),
        endDateISO: params.get('endDate')
      });

      const url = `${baseUrl}/api/analytics/analytical-report/${encodeURIComponent(userRole)}?${params.toString()}`;

      console.log('🌐 Fetching analytical report:', {
        url,
        params: params.toString()
      });

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch analytical report data');
      }

      const result = await response.json();
      setReportData(result.data);
    } catch (err) {
      console.error('Error fetching analytical report:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !reportData) return;

    try {
      // Show loading state
      const downloadButton = document.querySelector('[data-download-button]');
      if (downloadButton) {
        downloadButton.textContent = 'Generating PDF...';
        downloadButton.disabled = true;
      }

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');

      // Get all page elements
      const pages = reportRef.current.querySelectorAll('[data-pdf-page]');

      // Capture and add each page
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        // Capture the page as canvas
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: pages[i].offsetWidth,
          height: pages[i].offsetHeight
        });

        // Add to PDF (full page, no margins since content already has margins)
        const imgWidth = 210; // A4 width in mm
        const imgHeight = 297; // A4 height in mm

        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          0,
          0,
          imgWidth,
          imgHeight
        );
      }

      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0];
      const roleSlug = userRole.replace(/\s+/g, '_');
      const filename = `LVCampusConnect_${roleSlug}_Analytics_Report_${date}.pdf`;

      // Save PDF
      pdf.save(filename);

      // Reset button state
      if (downloadButton) {
        downloadButton.textContent = 'Download Report';
        downloadButton.disabled = false;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');

      // Reset button state
      const downloadButton = document.querySelector('[data-download-button]');
      if (downloadButton) {
        downloadButton.textContent = 'Download Report';
        downloadButton.disabled = false;
      }
    }
  };

  if (!isOpen) return null;

  const LVCampusConnectColors = ['#1F3463', '#3930A8', '#3762D0', '#78CFFF', '#FFE251'];

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-gray-100 rounded-lg shadow-xl w-full max-w-[230mm] max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button - Circular Navy Blue with White Border (Outside Corner) */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 z-20 w-8 h-8 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            aria-label="Close"
          >
            <MdClose className="w-4 h-4" />
          </button>

          {/* Scrollable Container */}
          <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-lg">
            {/* Header - Fixed at top */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between rounded-t-lg">
              <h2 className="text-xl font-bold text-[#1F3463]">
                Analytical Report - {userRole}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadPDF}
                  data-download-button
                  disabled={isLoading || error}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#152847] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MdDownload className="w-5 h-5" />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Content - A4 Pages Container */}
            <div ref={reportRef} className="p-6 space-y-6 rounded-b-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F3463]"></div>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-red-600 text-lg">Error loading report: {error}</p>
                <button
                  onClick={fetchReportData}
                  className="mt-4 px-6 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#152847]"
                >
                  Retry
                </button>
              </div>
            ) : reportData ? (
              <>
                {/* Page 1 - A4 Size */}
                <div
                  data-pdf-page="1"
                  className="bg-white shadow-lg mx-auto relative"
                  style={{ width: '210mm', height: '297mm', padding: '0' }}
                >
                  {/* Report Header Image */}
                  <div className="w-full">
                    <img
                      src="/analytics/report-header.png"
                      alt="Report Header"
                      className="w-full h-auto"
                    />
                  </div>

                  {/* Content Area with Padding */}
                  <div style={{ padding: '0 20mm 0 20mm' }}>
                    {/* Report Title Section */}
                    <div className="text-center pb-6 mb-6">
                      <h2 className="text-xl font-semibold text-gray-700 mb-4">
                        {userRole} Analytical Report
                      </h2>
                      <p className="text-sm text-gray-600">
                        Report Period: {reportData.metadata?.reportPeriod}
                      </p>
                      <p className="text-xs text-gray-500">
                        Generated: {new Date(reportData.metadata?.generatedAt).toLocaleString()}
                      </p>
                    </div>

                  {/* Executive Summary */}
                  <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    <h3 className="text-xl font-bold text-[#1F3463] mb-4">Executive Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {userRole === 'MIS Super Admin' ? (
                        <>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-600">Total Visitors</p>
                            <p className="text-3xl font-bold text-[#1F3463]">{reportData.totalVisitors?.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-600">Average Rating</p>
                            <p className="text-3xl font-bold text-[#1F3463]">
                              {reportData.kioskRatings?.averageRating?.toFixed(2)} / 5.0
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-600">Total Ratings</p>
                            <p className="text-3xl font-bold text-[#1F3463]">{reportData.kioskRatings?.totalRatings?.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-600">Priority Visitors</p>
                            <p className="text-3xl font-bold text-[#1F3463]">{reportData.priorityVisitors?.toLocaleString()}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-600">Total Visits</p>
                            <p className="text-3xl font-bold text-[#1F3463]">{reportData.totalVisits?.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-sm text-gray-600">Avg Turnaround Time</p>
                            <p className="text-3xl font-bold text-[#1F3463]">{reportData.avgTurnaroundMinutes} mins</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                    {/* MIS Super Admin - First Page Charts */}
                    {userRole === 'MIS Super Admin' && (
                      <>
                        {/* Most Visited Office */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                          <h3 className="text-lg font-bold text-[#1F3463] mb-4">Most Visited Office</h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={reportData.mostVisitedOffice}
                                dataKey="count"
                                nameKey="department"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={(entry) => `${entry.department}: ${entry.count}`}
                              >
                                {reportData.mostVisitedOffice?.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={LVCampusConnectColors[index % LVCampusConnectColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}

                    {/* Registrar/Admissions Admin - Executive Summary Only */}
                    {(userRole === 'Registrar Admin' || userRole === 'Admissions Admin') && (
                      <>
                        {/* Monthly Summary Table - Compact */}
                        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                          <h3 className="text-base font-bold text-[#1F3463] mb-3">Monthly Summary</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Month</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Total Visits</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Avg Turnaround</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {reportData.monthlyBreakdown?.map((month, index) => (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-xs text-gray-900">{month.monthName}</td>
                                    <td className="px-3 py-2 text-xs text-right font-medium text-[#1F3463]">{month.totalVisits}</td>
                                    <td className="px-3 py-2 text-xs text-right text-gray-700">{month.avgTurnaroundMinutes} mins</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Overall Service Distribution - Larger Chart */}
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <h3 className="text-base font-bold text-[#1F3463] mb-2">Overall Service Distribution</h3>
                          <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                              <Pie
                                data={reportData.serviceDistribution?.slice(0, 5)}
                                dataKey="count"
                                nameKey="service"
                                cx="50%"
                                cy="50%"
                                outerRadius={95}
                                label={false}
                              >
                                {reportData.serviceDistribution?.slice(0, 5).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={LVCampusConnectColors[index % LVCampusConnectColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value, name) => [value, name]} />
                              <Legend
                                verticalAlign="bottom"
                                height={50}
                                wrapperStyle={{ paddingTop: '15px' }}
                                formatter={(value, entry) => `${value}: ${entry.payload.count}`}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Report Footer Image */}
                  <div className="absolute bottom-0 left-0 w-full">
                    <img
                      src="/analytics/report-footer.png"
                      alt="Report Footer"
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                {/* Page 2 - MIS Super Admin Continued */}
                {userRole === 'MIS Super Admin' && (
                  <div
                    data-pdf-page="2"
                    className="bg-white shadow-lg mx-auto relative"
                    style={{ width: '210mm', height: '297mm', padding: '0' }}
                  >
                    {/* Report Header Image */}
                    <div className="w-full">
                      <img
                        src="/analytics/report-header.png"
                        alt="Report Header"
                        className="w-full h-auto"
                      />
                    </div>

                    {/* Content Area with Padding */}
                    <div style={{ padding: '0 20mm 0 20mm' }}>
                      {/* Service Distribution Overall */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                      <h3 className="text-lg font-bold text-[#1F3463] mb-4">Service Distribution Overall</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={reportData.serviceDistribution?.slice(0, 5)}
                            dataKey="count"
                            nameKey="service"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={(entry) => `${entry.service}: ${entry.count}`}
                          >
                            {reportData.serviceDistribution?.slice(0, 5).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={LVCampusConnectColors[index % LVCampusConnectColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Kiosk Ratings Breakdown */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                      <h3 className="text-lg font-bold text-[#1F3463] mb-4">Kiosk Ratings Distribution</h3>
                      <div className="grid grid-cols-5 gap-4">
                        {[5, 4, 3, 2, 1].map((star) => (
                          <div key={star} className="text-center">
                            <p className="text-2xl font-bold text-[#1F3463]">
                              {reportData.kioskRatings?.[`rating${star}`] || 0}
                            </p>
                            <p className="text-sm text-gray-600">{star} Star{star !== 1 ? 's' : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Visitor Breakdown by Role */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                      <h3 className="text-lg font-bold text-[#1F3463] mb-4">Visitor Breakdown by Role</h3>
                      <div className="grid grid-cols-4 gap-4">
                        {reportData.visitorsByRole?.map((item, index) => (
                          <div key={index} className="text-center bg-gray-50 p-4 rounded-lg">
                            <p className="text-2xl font-bold text-[#1F3463]">{item.count}</p>
                            <p className="text-sm text-gray-600">{item.role}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Department Comparison */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-bold text-[#1F3463] mb-4">Department Comparison</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-semibold text-[#1F3463] mb-3">Registrar's Office</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Completed:</span>
                              <span className="font-bold">{reportData.departmentComparison?.registrar?.totalCompleted}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Avg Turnaround:</span>
                              <span className="font-bold">{reportData.departmentComparison?.registrar?.avgTurnaroundMinutes} mins</span>
                            </div>
                          </div>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-semibold text-[#1F3463] mb-3">Admissions Office</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Completed:</span>
                              <span className="font-bold">{reportData.departmentComparison?.admissions?.totalCompleted}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Avg Turnaround:</span>
                              <span className="font-bold">{reportData.departmentComparison?.admissions?.avgTurnaroundMinutes} mins</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Report Footer Image */}
                  <div className="absolute bottom-0 left-0 w-full">
                    <img
                      src="/analytics/report-footer.png"
                      alt="Report Footer"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
                )}

                {/* Registrar/Admissions Admin - Monthly Pages */}
                {(userRole === 'Registrar Admin' || userRole === 'Admissions Admin') &&
                  reportData.monthlyBreakdown?.map((monthData, monthIndex) => (
                    <div
                      key={monthIndex}
                      data-pdf-page={monthIndex + 2}
                      className="bg-white shadow-lg mx-auto relative"
                      style={{ width: '210mm', height: '297mm', padding: '0' }}
                    >
                      {/* Report Header Image */}
                      <div className="w-full">
                        <img
                          src="/analytics/report-header.png"
                          alt="Report Header"
                          className="w-full h-auto"
                        />
                      </div>

                      {/* Content Area with Padding */}
                      <div style={{ padding: '0 20mm 0 20mm' }}>
                        {/* Month Title - Compact */}
                        <div className="text-center mb-3">
                          <h2 className="text-xl font-bold text-[#1F3463]">{monthData.monthName}</h2>
                          <p className="text-xs text-gray-600">Monthly Report</p>
                        </div>

                        {/* Month Summary Stats - Inline */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-gray-50 p-2 rounded-lg text-center">
                            <p className="text-xs text-gray-600">Total Visits</p>
                            <p className="text-xl font-bold text-[#1F3463]">{monthData.totalVisits?.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded-lg text-center">
                            <p className="text-xs text-gray-600">Avg Turnaround Time</p>
                            <p className="text-xl font-bold text-[#1F3463]">{monthData.avgTurnaroundMinutes} mins</p>
                          </div>
                        </div>

                        {/* Service Distribution for this month - No labels on pie */}
                        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
                          <h3 className="text-sm font-bold text-[#1F3463] mb-1">Service Distribution</h3>
                          <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                              <Pie
                                data={monthData.serviceDistribution?.slice(0, 5)}
                                dataKey="count"
                                nameKey="service"
                                cx="50%"
                                cy="50%"
                                outerRadius={75}
                                label={false}
                              >
                                {monthData.serviceDistribution?.slice(0, 5).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={LVCampusConnectColors[index % LVCampusConnectColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value, name) => [value, name]} />
                              <Legend
                                verticalAlign="bottom"
                                height={40}
                                wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }}
                                formatter={(value, entry) => `${value}: ${entry.payload.count}`}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Visitor Breakdown by Role - Compact */}
                        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
                          <h3 className="text-sm font-bold text-[#1F3463] mb-2">Visitor Breakdown by Role</h3>
                          <div className="grid grid-cols-4 gap-2">
                            {monthData.visitorsByRole?.map((item, index) => (
                              <div key={index} className="text-center bg-gray-50 p-2 rounded">
                                <p className="text-lg font-bold text-[#1F3463]">{item.count}</p>
                                <p className="text-xs text-gray-600">{item.role}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Peak Hours and Peak Days - Side by Side - Limited Items */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Peak Hours - Top 3 */}
                          <div className="bg-white rounded-lg border border-gray-200 p-3">
                            <h3 className="text-sm font-bold text-[#1F3463] mb-2">Peak Hours (Top 3)</h3>
                            <div className="space-y-1.5">
                              {monthData.peakHours?.slice(0, 3).map((item, index) => (
                                <div key={index} className="flex items-center justify-between bg-gray-50 p-1.5 rounded text-xs">
                                  <span className="font-medium text-gray-700">
                                    {item.hour}:00 - {item.hour + 1}:00
                                  </span>
                                  <span className="text-[#1F3463] font-bold">{item.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Peak Days - Top 5 */}
                          <div className="bg-white rounded-lg border border-gray-200 p-3">
                            <h3 className="text-sm font-bold text-[#1F3463] mb-2">Peak Days (Top 5)</h3>
                            <div className="space-y-1.5">
                              {monthData.peakDays?.slice(0, 5).map((item, index) => (
                                <div key={index} className="flex items-center justify-between bg-gray-50 p-1.5 rounded text-xs">
                                  <span className="font-medium text-gray-700">{item.day}</span>
                                  <span className="text-[#1F3463] font-bold">{item.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Report Footer Image */}
                      <div className="absolute bottom-0 left-0 w-full">
                        <img
                          src="/analytics/report-footer.png"
                          alt="Report Footer"
                          className="w-full h-auto"
                        />
                      </div>
                    </div>
                  ))
                }
              </>
            ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticalReportModal;

