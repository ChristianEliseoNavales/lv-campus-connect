import React, { useState, useEffect, useRef } from 'react';
import { MdClose, MdDownload, MdCheckCircle } from 'react-icons/md';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as AreaTooltip } from 'recharts';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import { pdf } from '@react-pdf/renderer';
import AnalyticalReportPDF from './AnalyticalReportPDF';
import API_CONFIG from '../../config/api';
import { authFetch } from '../../utils/apiClient';
import { getPhilippineStartOfDayISO, getPhilippineEndOfDayISO } from '../../utils/philippineTimezone';

const AnalyticalReportModal = ({ isOpen, onClose, userRole, dateRange }) => {
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const reportRef = useRef(null);
  const chartContainerRef = useRef(null);

  useEffect(() => {
    if (isOpen && userRole && dateRange) {
      fetchReportData();
    } else if (!isOpen) {
      // Clean up when modal closes
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
      setReportData(null);
      setIsLoading(true);
      setIsComplete(false);
      setProgress(0);
    }
  }, [isOpen, userRole, dateRange]);

  const fetchReportData = async () => {
    try {
      setIsLoading(true);
      setIsComplete(false);
      setError(null);
      setProgress(0);
      // Clear old PDF preview URL to prevent showing stale preview
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
      
      // Starting report generation with intermediate steps
      setProgress(10);
      await new Promise(resolve => setTimeout(resolve, 200));
      setProgress(15);
      await new Promise(resolve => setTimeout(resolve, 150));

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
      const data = result.data;
      setReportData(data);
      
      // Report data fetched from API with intermediate steps
      setProgress(25);
      await new Promise(resolve => setTimeout(resolve, 150));
      setProgress(30);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Wait for React to render the chart container with data
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Generate PDF preview as part of data loading
      // Pass data directly since state update is async
      // This ensures single loading state covers entire process
      await generatePDFPreview(data);
    } catch (err) {
      console.error('Error fetching analytical report:', err);
      setError(err.message);
      setIsLoading(false);
      setIsComplete(false);
      setProgress(0);
    }
  };

  // Generate PDF for preview
  const generatePDFPreview = async (data = null) => {
    // Use passed data or fallback to reportData state
    const dataToUse = data || reportData;
    if (!dataToUse) {
      console.warn('No report data available for PDF generation');
      return;
    }

    try {
      // Charts container rendered with intermediate steps
      setProgress(45);
      await new Promise(resolve => setTimeout(resolve, 150));
      setProgress(50);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Wait for chart container to be in DOM and charts to have dimensions
      let attempts = 0;
      const maxAttempts = 15; // Increased attempts for slower rendering
      let chartsReady = false;
      
      while (attempts < maxAttempts && !chartsReady) {
        if (chartContainerRef.current) {
          const chartElements = chartContainerRef.current.querySelectorAll('[data-chart]');
          if (chartElements.length > 0) {
            // Check if charts have dimensions (indicating they're rendered)
            let allChartsHaveDimensions = true;
            chartElements.forEach((chart) => {
              if (chart.offsetWidth === 0 || chart.offsetHeight === 0) {
                allChartsHaveDimensions = false;
              }
            });
            
            if (allChartsHaveDimensions) {
              chartsReady = true;
              // Charts ready and validated with intermediate steps
              setProgress(65);
              await new Promise(resolve => setTimeout(resolve, 150));
              setProgress(70);
              // Wait a bit more for Recharts to fully render SVG elements
              await new Promise(resolve => setTimeout(resolve, 1000));
              break;
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }

      if (!chartsReady) {
        console.warn('Charts may not be fully ready, proceeding anyway...');
        // Charts ready and validated (even if not perfect) with intermediate steps
        setProgress(65);
        await new Promise(resolve => setTimeout(resolve, 150));
        setProgress(70);
        // Still wait a bit before proceeding
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Collect chart images from hidden chart container
      setProgress(75);
      await new Promise(resolve => setTimeout(resolve, 200));
      const chartImages = await collectChartImages(dataToUse);
      setProgress(80);
      await new Promise(resolve => setTimeout(resolve, 150));
      setProgress(85);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('Chart images collected:', Object.keys(chartImages));

      // Generate PDF using @react-pdf/renderer
      setProgress(90);
      await new Promise(resolve => setTimeout(resolve, 200));
      const blob = await pdf(
        <AnalyticalReportPDF
          reportData={dataToUse}
          userRole={userRole}
          chartImages={chartImages}
        />
      ).toBlob();

      // Create object URL for preview
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      
      // Set progress to 100% and show completion state
      setProgress(95);
      await new Promise(resolve => setTimeout(resolve, 150));
      setProgress(100);
      
      // Show completion state for 1.5-2 seconds before showing preview
      setIsComplete(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Transition to preview
      setIsComplete(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      throw error; // Re-throw to be handled by fetchReportData
    }
  };

  // Note: PDF generation is now integrated into fetchReportData
  // No separate useEffect needed

  // Cleanup: revoke object URL when component unmounts
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  // Convert chart to image using html2canvas
  const convertChartToImage = async (chartElement, chartId) => {
    if (!chartElement) {
      console.warn(`Chart element not found for ${chartId}`);
      return null;
    }

    try {
      // Wait a bit to ensure the chart is fully rendered
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check if element has dimensions
      if (chartElement.offsetWidth === 0 || chartElement.offsetHeight === 0) {
        console.warn(`Chart ${chartId} has zero dimensions:`, {
          width: chartElement.offsetWidth,
          height: chartElement.offsetHeight
        });
      }

      const canvas = await html2canvas(chartElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: chartElement.offsetWidth || 800,
        height: chartElement.offsetHeight || 600,
        allowTaint: true,
      });

      const dataUrl = canvas.toDataURL('image/png');
      console.log(`Chart ${chartId} converted successfully, size:`, canvas.width, 'x', canvas.height);
      return dataUrl;
    } catch (error) {
      console.error(`Error converting chart ${chartId} to image:`, error);
      return null;
    }
  };

  // Collect all chart images
  const collectChartImages = async (data = null) => {
    const chartImages = {};
    
    // Use chartContainerRef if available, otherwise fallback to reportRef
    const container = chartContainerRef.current || reportRef.current;
    if (!container) {
      console.warn('Chart container not found');
      return chartImages;
    }

    // Use passed data or fallback to reportData state
    const dataToUse = data || reportData;

    console.log('Collecting charts from container:', container);

    // MIS Super Admin charts
    if (userRole === 'MIS Super Admin') {
      const mostVisitedOfficeChart = container.querySelector('[data-chart="mostVisitedOffice"]');
      if (mostVisitedOfficeChart) {
        console.log('Found mostVisitedOffice chart, dimensions:', mostVisitedOfficeChart.offsetWidth, 'x', mostVisitedOfficeChart.offsetHeight);
        chartImages.mostVisitedOffice = await convertChartToImage(mostVisitedOfficeChart, 'mostVisitedOffice');
      } else {
        console.warn('mostVisitedOffice chart not found');
      }

      const serviceDistributionOverallChart = container.querySelector('[data-chart="serviceDistributionOverall"]');
      if (serviceDistributionOverallChart) {
        console.log('Found serviceDistributionOverall chart, dimensions:', serviceDistributionOverallChart.offsetWidth, 'x', serviceDistributionOverallChart.offsetHeight);
        chartImages.serviceDistributionOverall = await convertChartToImage(serviceDistributionOverallChart, 'serviceDistributionOverall');
      } else {
        console.warn('serviceDistributionOverall chart not found');
      }
    }

    // Registrar/Admissions Admin charts
    if (userRole === 'Registrar Admin' || userRole === 'Admissions Admin') {
      const serviceDistributionChart = container.querySelector('[data-chart="serviceDistribution"]');
      if (serviceDistributionChart) {
        console.log('Found serviceDistribution chart, dimensions:', serviceDistributionChart.offsetWidth, 'x', serviceDistributionChart.offsetHeight);
        chartImages.serviceDistribution = await convertChartToImage(serviceDistributionChart, 'serviceDistribution');
      } else {
        console.warn('serviceDistribution chart not found');
      }

      // Monthly service distribution charts
      if (dataToUse?.monthlyBreakdown) {
        for (let i = 0; i < dataToUse.monthlyBreakdown.length; i++) {
          const monthlyChart = container.querySelector(`[data-chart="monthlyServiceDistribution_${i}"]`);
          if (monthlyChart) {
            console.log(`Found monthlyServiceDistribution_${i} chart, dimensions:`, monthlyChart.offsetWidth, 'x', monthlyChart.offsetHeight);
            chartImages[`monthlyServiceDistribution_${i}`] = await convertChartToImage(monthlyChart, `monthlyServiceDistribution_${i}`);
          } else {
            console.warn(`monthlyServiceDistribution_${i} chart not found`);
          }
        }
      }
    }

    return chartImages;
  };

  const handleDownloadPDF = async () => {
    if (!reportData) return;

    try {
      // Show loading state
      const downloadButton = document.querySelector('[data-download-button]');
      if (downloadButton) {
        downloadButton.textContent = 'Generating PDF...';
        downloadButton.disabled = true;
      }

      // Wait a bit for charts to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Collect chart images
      const chartImages = await collectChartImages();

      // Generate PDF using @react-pdf/renderer
      const blob = await pdf(
        <AnalyticalReportPDF
          reportData={reportData}
          userRole={userRole}
          chartImages={chartImages}
        />
      ).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0];
      const roleSlug = userRole.replace(/\s+/g, '_');
      link.download = `LVCampusConnect_${roleSlug}_Analytics_Report_${date}.pdf`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      // Reset button state
      if (downloadButton) {
        downloadButton.textContent = 'Download PDF';
        downloadButton.disabled = false;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');

      // Reset button state
      const downloadButton = document.querySelector('[data-download-button]');
      if (downloadButton) {
        downloadButton.textContent = 'Download PDF';
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
            className="absolute -top-1.5 -right-1.5 z-20 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            aria-label="Close"
          >
            <MdClose className="w-3 h-3" />
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

            {/* Content - PDF Preview */}
            <div className="p-6 rounded-b-lg">
            {isLoading && !isComplete ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-full max-w-md">
                  {/* Percentage Counter */}
                  <div className="text-center mb-4">
                    <p className="text-3xl font-bold text-[#1F3463]">
                      {progress}%
                    </p>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
                    <div
                      className="bg-[#1F3463] h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  
                  {/* Status Text */}
                  <p className="text-[#1F3463] font-medium text-center">
                    Generating Report...
                  </p>
                </div>
              </div>
            ) : isComplete ? (
              <div className="flex items-center justify-center py-20">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-full max-w-md"
                >
                  {/* Percentage Counter */}
                  <div className="text-center mb-4">
                    <p className="text-3xl font-bold text-[#1F3463]">
                      {progress}%
                    </p>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
                    <motion.div
                      initial={{ width: `${progress < 100 ? progress : 95}%` }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="bg-[#1F3463] h-full rounded-full"
                    />
                  </div>
                  
                  {/* Success Icon and Text */}
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                        delay: 0.2
                      }}
                      className="inline-block mb-4"
                    >
                      <MdCheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                      className="text-2xl font-bold text-[#1F3463] mb-2"
                    >
                      Report Generated Successfully!
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.5 }}
                      className="text-gray-600 font-medium"
                    >
                      Preparing preview...
                    </motion.p>
                  </div>
                </motion.div>
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
            ) : pdfPreviewUrl && !isLoading ? (
              <div className="w-full h-[calc(90vh-120px)]">
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-full border-0 rounded-lg"
                  title="PDF Preview"
                />
              </div>
            ) : null}

            {/* Hidden chart container for PDF generation - positioned off-screen but visible for Recharts to render */}
            {reportData && (
              <div 
                ref={chartContainerRef} 
                className="fixed pointer-events-none" 
                style={{ 
                  left: '-9999px', 
                  top: '0px', 
                  width: '210mm', 
                  minHeight: '297mm',
                  zIndex: -1,
                  opacity: 0.01, // Very low opacity but not 0, so browser still renders it
                  visibility: 'visible' // Must be visible for Recharts to render
                }}
              >
                <div ref={reportRef}>
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
                      className="w-full"
                      style={{ display: 'block', height: 'auto', maxHeight: '30mm', objectFit: 'contain' }}
                    />
                  </div>

                  {/* Content Area with Padding */}
                  <div style={{ padding: '0 20mm 30mm 20mm' }}>
                    {/* Report Title Section */}
                    <div className="text-center pb-3 mb-3 border-b-2 border-gray-200">
                      <h2 className="text-2xl font-bold text-[#1F3463] mb-2 tracking-tight">
                        {userRole} Analytical Report
                      </h2>
                      <p className="text-sm font-medium text-gray-700">
                        {reportData.metadata?.reportPeriod}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Generated: {new Date(reportData.metadata?.generatedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                  {/* Executive Summary */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-3 shadow-sm border border-gray-200">
                    <h3 className="text-base font-bold text-[#1F3463] mb-3 flex items-center">
                      <span className="w-1 h-5 bg-[#1F3463] mr-2 rounded"></span>
                      Executive Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {userRole === 'MIS Super Admin' ? (
                        <>
                          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Visitors</p>
                            <p className="text-2xl font-bold text-[#1F3463] mt-1">{reportData.totalVisitors?.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Average Rating</p>
                            <p className="text-2xl font-bold text-[#1F3463] mt-1">
                              {reportData.kioskRatings?.averageRating?.toFixed(2)} / 5.0
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Ratings</p>
                            <p className="text-2xl font-bold text-[#1F3463] mt-1">{reportData.kioskRatings?.totalRatings?.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Priority Visitors</p>
                            <p className="text-2xl font-bold text-[#1F3463] mt-1">{reportData.priorityVisitors?.toLocaleString()}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Visits</p>
                            <p className="text-2xl font-bold text-[#1F3463] mt-1">{reportData.totalVisits?.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Avg Turnaround Time</p>
                            <p className="text-2xl font-bold text-[#1F3463] mt-1">{reportData.avgTurnaroundMinutes} mins</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                    {/* MIS Super Admin - First Page Charts */}
                    {userRole === 'MIS Super Admin' && (
                      <>
                        {/* Most Visited Office */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                          <h3 className="text-base font-bold text-[#1F3463] mb-3 flex items-center">
                            <span className="w-1 h-5 bg-[#1F3463] mr-2 rounded"></span>
                            Most Visited Office
                          </h3>
                          <div data-chart="mostVisitedOffice">
                            <ResponsiveContainer width="100%" height={280}>
                              <PieChart>
                                <Pie
                                  data={reportData.mostVisitedOffice?.filter(item => item && item.count > 0)}
                                  dataKey="count"
                                  nameKey="department"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={85}
                                  startAngle={90}
                                  endAngle={-270}
                                  isAnimationActive={false}
                                  label={({ department, count }) => `${department}: ${count}`}
                                  labelLine={true}
                                >
                                  {reportData.mostVisitedOffice?.filter(item => item && item.count > 0).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={LVCampusConnectColors[index % LVCampusConnectColors.length]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                                <Legend
                                  verticalAlign="bottom"
                                  height={40}
                                  wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Registrar/Admissions Admin - Executive Summary Only */}
                    {(userRole === 'Registrar Admin' || userRole === 'Admissions Admin') && (
                      <>
                        {/* Top Performing Metrics - Fixed Size Summary */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm">
                          <h3 className="text-base font-bold text-[#1F3463] mb-3 flex items-center">
                            <span className="w-1 h-5 bg-[#1F3463] mr-2 rounded"></span>
                            Top Performing Metrics
                          </h3>
                          <div className="grid grid-cols-4 gap-3">
                            {/* Busiest Month */}
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-xl border-2 border-blue-200 shadow-sm">
                              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1.5">Busiest Month</p>
                              <p className="text-lg font-bold text-[#1F3463] leading-tight">
                                {reportData.monthlyBreakdown?.reduce((max, month) =>
                                  month.totalVisits > max.totalVisits ? month : max
                                )?.monthName || 'N/A'}
                              </p>
                              <p className="text-xs font-semibold text-gray-700 mt-1.5">
                                {reportData.monthlyBreakdown?.reduce((max, month) =>
                                  month.totalVisits > max.totalVisits ? month : max
                                )?.totalVisits?.toLocaleString() || '0'} visits
                              </p>
                            </div>

                            {/* Peak Service */}
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-xl border-2 border-purple-200 shadow-sm">
                              <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1.5">Peak Service</p>
                              <p className="text-lg font-bold text-[#1F3463] leading-tight">
                                {reportData.serviceDistribution?.[0]?.service || 'N/A'}
                              </p>
                              <p className="text-xs font-semibold text-gray-700 mt-1.5">
                                {reportData.serviceDistribution?.[0]?.count?.toLocaleString() || '0'} requests
                              </p>
                            </div>

                            {/* Best Turnaround */}
                            <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-xl border-2 border-green-200 shadow-sm">
                              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1.5">Best Turnaround</p>
                              <p className="text-lg font-bold text-[#1F3463] leading-tight">
                                {reportData.monthlyBreakdown?.reduce((min, month) =>
                                  month.avgTurnaroundMinutes < min.avgTurnaroundMinutes ? month : min
                                )?.monthName || 'N/A'}
                              </p>
                              <p className="text-xs font-semibold text-gray-700 mt-1.5">
                                {reportData.monthlyBreakdown?.reduce((min, month) =>
                                  month.avgTurnaroundMinutes < min.avgTurnaroundMinutes ? month : min
                                )?.avgTurnaroundMinutes || '0'} mins avg
                              </p>
                            </div>

                            {/* Overall Peak Hour */}
                            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-3 rounded-xl border-2 border-yellow-200 shadow-sm">
                              <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-1.5">Overall Peak Hour</p>
                              <p className="text-lg font-bold text-[#1F3463] leading-tight">
                                {(() => {
                                  // Aggregate peak hours from all months
                                  const hourTotals = {};
                                  reportData.monthlyBreakdown?.forEach(month => {
                                    month.peakHours?.forEach(hourData => {
                                      hourTotals[hourData.hour] = (hourTotals[hourData.hour] || 0) + hourData.count;
                                    });
                                  });

                                  const peakHourEntry = Object.entries(hourTotals).sort((a, b) => b[1] - a[1])[0];
                                  if (!peakHourEntry) return 'N/A';

                                  const hour = parseInt(peakHourEntry[0]);
                                  const period = hour >= 12 ? 'PM' : 'AM';
                                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

                                  return `${displayHour}:00 ${period}`;
                                })()}
                              </p>
                              <p className="text-xs font-semibold text-gray-700 mt-1.5">
                                {(() => {
                                  const hourTotals = {};
                                  reportData.monthlyBreakdown?.forEach(month => {
                                    month.peakHours?.forEach(hourData => {
                                      hourTotals[hourData.hour] = (hourTotals[hourData.hour] || 0) + hourData.count;
                                    });
                                  });
                                  const peakHourEntry = Object.entries(hourTotals).sort((a, b) => b[1] - a[1])[0];
                                  return peakHourEntry ? `${peakHourEntry[1].toLocaleString()} visits` : '0 visits';
                                })()}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Overall Service Distribution - With Labels */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                          <h3 className="text-base font-bold text-[#1F3463] mb-2 flex items-center">
                            <span className="w-1 h-5 bg-[#1F3463] mr-2 rounded"></span>
                            Overall Service Distribution
                          </h3>
                          <div data-chart="serviceDistribution">
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={reportData.serviceDistribution?.filter(item => item && item.count > 0).slice(0, 5)}
                                  dataKey="count"
                                  nameKey="service"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={85}
                                  startAngle={90}
                                  endAngle={-270}
                                  isAnimationActive={false}
                                  label={({ service, count }) => `${service}: ${count}`}
                                  labelLine={true}
                                >
                                  {reportData.serviceDistribution?.filter(item => item && item.count > 0).slice(0, 5).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={LVCampusConnectColors[index % LVCampusConnectColors.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [value, name]} />
                                <Legend
                                  verticalAlign="bottom"
                                  height={40}
                                  wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Report Footer Image */}
                  <div className="absolute bottom-0 left-0 w-full">
                    <img
                      src="/analytics/report-footer.png"
                      alt="Report Footer"
                      className="w-full"
                      style={{ display: 'block', height: 'auto', maxHeight: '25mm', objectFit: 'contain' }}
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
                        className="w-full"
                        style={{ display: 'block', height: 'auto', maxHeight: '30mm', objectFit: 'contain' }}
                      />
                    </div>

                    {/* Content Area with Padding */}
                    <div style={{ padding: '0 20mm 30mm 20mm' }}>
                      {/* Service Distribution Overall */}
                      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm">
                      <h3 className="text-base font-bold text-[#1F3463] mb-3 flex items-center">
                        <span className="w-1 h-5 bg-[#1F3463] mr-2 rounded"></span>
                        Service Distribution Overall
                      </h3>
                      <div data-chart="serviceDistributionOverall">
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={reportData.serviceDistribution?.slice(0, 5)}
                              dataKey="count"
                              nameKey="service"
                              cx="50%"
                              cy="50%"
                              outerRadius={75}
                              startAngle={0}
                              endAngle={360}
                              label={({ service, count }) => `${service}: ${count}`}
                              labelLine={true}
                            >
                              {reportData.serviceDistribution?.slice(0, 5).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={LVCampusConnectColors[index % LVCampusConnectColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend
                              verticalAlign="bottom"
                              height={35}
                              wrapperStyle={{ paddingTop: '8px', fontSize: '10px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Kiosk Ratings Breakdown */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm">
                      <h3 className="text-base font-bold text-[#1F3463] mb-3 flex items-center">
                        <span className="w-1 h-5 bg-[#1F3463] mr-2 rounded"></span>
                        Kiosk Ratings Distribution
                      </h3>
                      <div className="flex gap-1.5" style={{ width: '100%' }}>
                        {[5, 4, 3, 2, 1].map((star) => (
                          <div key={star} className="flex-1 text-center bg-gradient-to-br from-gray-50 to-gray-100 p-2 rounded-lg border border-gray-200" style={{ minWidth: 0, flexBasis: 0 }}>
                            <p className="text-base font-bold text-[#1F3463] leading-tight">
                              {reportData.kioskRatings?.[`rating${star}`] || 0}
                            </p>
                            <p className="text-[9px] font-semibold text-gray-600 mt-0.5 leading-tight">{star} Star{star !== 1 ? 's' : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Visitor Breakdown by Role */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm">
                      <h3 className="text-base font-bold text-[#1F3463] mb-3 flex items-center">
                        <span className="w-1 h-5 bg-[#1F3463] mr-2 rounded"></span>
                        Visitor Breakdown by Role
                      </h3>
                      <div className="grid grid-cols-4 gap-3">
                        {reportData.visitorsByRole?.map((item, index) => (
                          <div key={index} className="text-center bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                            <p className="text-2xl font-bold text-[#1F3463]">{item.count}</p>
                            <p className="text-xs font-semibold text-gray-600 mt-1">{item.role}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Department Comparison */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                      <h3 className="text-base font-bold text-[#1F3463] mb-3 flex items-center">
                        <span className="w-1 h-5 bg-[#1F3463] mr-2 rounded"></span>
                        Department Comparison
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 shadow-sm">
                          <h4 className="font-bold text-[#1F3463] mb-3 text-sm uppercase tracking-wide">Registrar's Office</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center bg-white/70 p-2 rounded">
                              <span className="text-xs font-semibold text-gray-600">Total Completed:</span>
                              <span className="text-lg font-bold text-[#1F3463]">{reportData.departmentComparison?.registrar?.totalCompleted}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/70 p-2 rounded">
                              <span className="text-xs font-semibold text-gray-600">Avg Turnaround:</span>
                              <span className="text-lg font-bold text-[#1F3463]">{reportData.departmentComparison?.registrar?.avgTurnaroundMinutes} mins</span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-4 shadow-sm">
                          <h4 className="font-bold text-[#1F3463] mb-3 text-sm uppercase tracking-wide">Admissions Office</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center bg-white/70 p-2 rounded">
                              <span className="text-xs font-semibold text-gray-600">Total Completed:</span>
                              <span className="text-lg font-bold text-[#1F3463]">{reportData.departmentComparison?.admissions?.totalCompleted}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/70 p-2 rounded">
                              <span className="text-xs font-semibold text-gray-600">Avg Turnaround:</span>
                              <span className="text-lg font-bold text-[#1F3463]">{reportData.departmentComparison?.admissions?.avgTurnaroundMinutes} mins</span>
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
                      className="w-full"
                      style={{ display: 'block', height: 'auto', maxHeight: '25mm', objectFit: 'contain' }}
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
                          className="w-full"
                          style={{ display: 'block', height: 'auto', maxHeight: '30mm', objectFit: 'contain' }}
                        />
                      </div>

                      {/* Content Area with Padding */}
                      <div style={{ padding: '0 20mm 30mm 20mm' }}>
                        {/* Month Title - Compact */}
                        <div className="text-center mb-3 pb-2 border-b-2 border-gray-200">
                          <h2 className="text-2xl font-bold text-[#1F3463]">{monthData.monthName}</h2>
                          <p className="text-xs font-medium text-gray-600 mt-1">Monthly Detailed Report</p>
                        </div>

                        {/* Month Summary Stats - Inline */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-xl text-center border-2 border-blue-200 shadow-sm">
                            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Total Visits</p>
                            <p className="text-2xl font-bold text-[#1F3463] mt-1">{monthData.totalVisits?.toLocaleString()}</p>
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-xl text-center border-2 border-purple-200 shadow-sm">
                            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Avg Turnaround Time</p>
                            <p className="text-2xl font-bold text-[#1F3463] mt-1">{monthData.avgTurnaroundMinutes} mins</p>
                          </div>
                        </div>

                        {/* Service Distribution for this month - With labels */}
                        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 shadow-sm">
                          <h3 className="text-sm font-bold text-[#1F3463] mb-2 flex items-center">
                            <span className="w-1 h-4 bg-[#1F3463] mr-2 rounded"></span>
                            Service Distribution
                          </h3>
                          <div data-chart={`monthlyServiceDistribution_${monthIndex}`}>
                            <ResponsiveContainer width="100%" height={220}>
                              <PieChart>
                                <Pie
                                  data={monthData.serviceDistribution?.slice(0, 5)}
                                  dataKey="count"
                                  nameKey="service"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={65}
                                  startAngle={0}
                                  endAngle={360}
                                  label={({ service, count }) => `${service}: ${count}`}
                                  labelLine={true}
                                >
                                  {monthData.serviceDistribution?.slice(0, 5).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={LVCampusConnectColors[index % LVCampusConnectColors.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [value, name]} />
                                <Legend
                                  verticalAlign="bottom"
                                  height={35}
                                  wrapperStyle={{ paddingTop: '6px', fontSize: '10px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Visitor Breakdown by Role - Compact */}
                        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 shadow-sm">
                          <h3 className="text-sm font-bold text-[#1F3463] mb-2 flex items-center">
                            <span className="w-1 h-4 bg-[#1F3463] mr-2 rounded"></span>
                            Visitor Breakdown by Role
                          </h3>
                          <div className="grid grid-cols-4 gap-2">
                            {monthData.visitorsByRole?.map((item, index) => (
                              <div key={index} className="text-center bg-gradient-to-br from-gray-50 to-gray-100 p-2 rounded-lg border border-gray-200">
                                <p className="text-xl font-bold text-[#1F3463]">{item.count}</p>
                                <p className="text-xs font-semibold text-gray-600 mt-1">{item.role}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Peak Hours and Peak Days - Side by Side - Top 5 Each */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Peak Hours - Top 5 with AM/PM */}
                          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                            <h3 className="text-sm font-bold text-[#1F3463] mb-2 flex items-center">
                              <span className="w-1 h-4 bg-[#1F3463] mr-2 rounded"></span>
                              Peak Hours (Top 5)
                            </h3>
                            <div className="space-y-1.5">
                              {monthData.peakHours?.slice(0, 5).map((item, index) => {
                                const hour = item.hour;
                                const period = hour >= 12 ? 'PM' : 'AM';
                                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                const nextHour = hour + 1;
                                const nextPeriod = nextHour >= 12 ? 'PM' : 'AM';
                                const displayNextHour = nextHour === 0 ? 12 : nextHour > 12 ? nextHour - 12 : nextHour;

                                return (
                                  <div key={index} className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 p-2 rounded-lg border border-blue-200 text-xs">
                                    <span className="font-semibold text-gray-700">
                                      {displayHour}:00 {period} - {displayNextHour}:00 {nextPeriod}
                                    </span>
                                    <span className="text-[#1F3463] font-bold text-sm">{item.count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Peak Days - Top 5 */}
                          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                            <h3 className="text-sm font-bold text-[#1F3463] mb-2 flex items-center">
                              <span className="w-1 h-4 bg-[#1F3463] mr-2 rounded"></span>
                              Peak Days (Top 5)
                            </h3>
                            <div className="space-y-1.5">
                              {monthData.peakDays?.slice(0, 5).map((item, index) => (
                                <div key={index} className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100 p-2 rounded-lg border border-purple-200 text-xs">
                                  <span className="font-semibold text-gray-700">{item.day}</span>
                                  <span className="text-[#1F3463] font-bold text-sm">{item.count}</span>
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
                          className="w-full"
                          style={{ display: 'block', height: 'auto', maxHeight: '25mm', objectFit: 'contain' }}
                        />
                      </div>
                    </div>
                  ))
                }
                  </>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticalReportModal;

