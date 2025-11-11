import React, { useState, useEffect, useRef } from 'react';
import { MdClose, MdDownload } from 'react-icons/md';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as AreaTooltip } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import API_CONFIG from '../../config/api';
import { authFetch } from '../../utils/apiClient';

const AnalyticalReportModal = ({ isOpen, onClose, userRole }) => {
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportRef = useRef(null);

  useEffect(() => {
    if (isOpen && userRole) {
      fetchReportData();
    }
  }, [isOpen, userRole]);

  const fetchReportData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const baseUrl = API_CONFIG.getAdminUrl();
      const response = await authFetch(`${baseUrl}/api/analytics/analytical-report/${encodeURIComponent(userRole)}`);
      
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
          className="relative bg-gray-100 rounded-lg shadow-xl w-full max-w-[230mm] max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scrollable Container */}
          <div className="max-h-[90vh] overflow-y-auto">
            {/* Header - Fixed at top */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
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
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <MdClose className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content - A4 Pages Container */}
            <div ref={reportRef} className="p-6 space-y-6">
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
                  className="bg-white shadow-lg mx-auto"
                  style={{ width: '210mm', height: '297mm', padding: '20mm' }}
                >
                  {/* Report Header */}
                  <div className="text-center border-b-2 border-[#1F3463] pb-6 mb-6">
                    <h1 className="text-3xl font-bold text-[#1F3463] mb-2">
                      LVCampusConnect System
                    </h1>
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
                </div>

                {/* Page 2 - MIS Super Admin Continued */}
                {userRole === 'MIS Super Admin' && (
                  <div
                    data-pdf-page="2"
                    className="bg-white shadow-lg mx-auto"
                    style={{ width: '210mm', height: '297mm', padding: '20mm' }}
                  >
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
                )}

                {/* Registrar/Admissions Admin Specific Content - Page 1 */}
                {(userRole === 'Registrar Admin' || userRole === 'Admissions Admin') && (
                  <>
                    {/* Service Distribution */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                      <h3 className="text-lg font-bold text-[#1F3463] mb-4">Service Distribution</h3>
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

                    {/* Visitor Breakdown by Role */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                  </>
                )}

                {/* Registrar/Admissions Admin - Page 2 */}
                {(userRole === 'Registrar Admin' || userRole === 'Admissions Admin') && (
                  <div
                    data-pdf-page="2"
                    className="bg-white shadow-lg mx-auto"
                    style={{ width: '210mm', height: '297mm', padding: '20mm' }}
                  >
                    {/* Peak Hours Analysis */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                      <h3 className="text-lg font-bold text-[#1F3463] mb-4">Peak Hours</h3>
                      <div className="space-y-2">
                        {reportData.peakHours?.map((item, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                            <span className="font-medium text-gray-700">
                              {item.hour}:00 - {item.hour + 1}:00
                            </span>
                            <span className="text-[#1F3463] font-bold">{item.count} visitors</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Peak Days Analysis */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                      <h3 className="text-lg font-bold text-[#1F3463] mb-4">Peak Days</h3>
                      <div className="grid grid-cols-7 gap-2">
                        {reportData.peakDays?.map((item, index) => (
                          <div key={index} className="text-center bg-gray-50 p-3 rounded">
                            <p className="text-lg font-bold text-[#1F3463]">{item.count}</p>
                            <p className="text-xs text-gray-600">{item.day}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Window Performance */}
                    {reportData.windowPerformance && reportData.windowPerformance.length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-[#1F3463] mb-4">Window Performance</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Window</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Served</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Avg Turnaround</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {reportData.windowPerformance.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-900">{item.window}</td>
                                  <td className="px-4 py-3 text-sm text-right font-medium text-[#1F3463]">{item.totalServed}</td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-700">{item.avgTurnaroundMinutes} mins</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

