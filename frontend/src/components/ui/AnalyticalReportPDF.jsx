import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

// Define color constants
const COLORS = {
  navy: '#1F3463',
  purple: '#3930A8',
  blue: '#3762D0',
  lightBlue: '#78CFFF',
  yellow: '#FFE251',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray600: '#4B5563',
  gray700: '#374151',
  blue50: '#EFF6FF',
  blue100: '#DBEAFE',
  blue200: '#BFDBFE',
  blue700: '#1D4ED8',
  purple50: '#F5F3FF',
  purple100: '#EDE9FE',
  purple200: '#DDD6FE',
  green50: '#F0FDF4',
  green100: '#D1FAE5',
  green200: '#BBF7D0',
  yellow50: '#FEFCE8',
  yellow100: '#FEF9C3',
  yellow200: '#FEF08A',
  yellow700: '#A16207',
  white: '#FFFFFF',
  // Pastel colors for executive presentation
  pastelBlue: '#E8F2FF',
  pastelPurple: '#F0EBFF',
  pastelGreen: '#E8F8F0',
  pastelYellow: '#FFF9E6',
  pastelGray: '#F5F7FA',
  pastelBlueBorder: '#C5D9F0',
  pastelPurpleBorder: '#D9C5F0',
  pastelGreenBorder: '#C5F0D9',
  pastelYellowBorder: '#F0E6C5',
};

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  headerImage: {
    width: '100%',
    maxHeight: 80,
    objectFit: 'cover',
    margin: 0,
    padding: 0,
  },
  footerImage: {
    width: '100%',
    maxHeight: 70,
    objectFit: 'contain',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  contentArea: {
    padding: '5mm 20mm 30mm 20mm',
  },
  titleSection: {
    textAlign: 'center',
    paddingBottom: 8,
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.gray300 || COLORS.gray200,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.navy,
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: 'medium',
    color: COLORS.gray700,
  },
  generatedDate: {
    fontSize: 9,
    color: COLORS.gray600,
    marginTop: 2,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.navy,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitleBar: {
    width: 3,
    height: 14,
    backgroundColor: COLORS.navy,
    marginRight: 6,
    borderRadius: 1,
  },
  executiveSummary: {
    backgroundColor: COLORS.pastelGray,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  grid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  grid2ColItem: {
    width: '48%',
    marginRight: '2%',
    marginBottom: 6,
  },
  grid2ColItemLast: {
    width: '48%',
    marginRight: 0,
    marginBottom: 6,
  },
  grid4Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  grid4ColItem: {
    width: '23%',
    marginRight: '2%',
    marginBottom: 6,
  },
  grid4ColItemLast: {
    width: '23%',
    marginRight: 0,
    marginBottom: 6,
  },
  statCard: {
    backgroundColor: COLORS.white,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: 'semibold',
    color: COLORS.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.navy,
    marginTop: 2,
  },
  metricCard: {
    padding: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    flex: 1,
  },
  metricCardBlue: {
    backgroundColor: COLORS.pastelBlue,
    borderColor: COLORS.pastelBlueBorder,
    borderWidth: 1.5,
  },
  metricCardPurple: {
    backgroundColor: COLORS.pastelPurple,
    borderColor: COLORS.pastelPurpleBorder,
    borderWidth: 1.5,
  },
  metricCardGreen: {
    backgroundColor: COLORS.pastelGreen,
    borderColor: COLORS.pastelGreenBorder,
    borderWidth: 1.5,
  },
  metricCardYellow: {
    backgroundColor: COLORS.pastelYellow,
    borderColor: COLORS.pastelYellowBorder,
    borderWidth: 1.5,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metricLabelBlue: {
    color: COLORS.blue700,
  },
  metricLabelPurple: {
    color: COLORS.purple,
  },
  metricLabelGreen: {
    color: '#059669',
  },
  metricLabelYellow: {
    color: COLORS.yellow700,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.navy,
    lineHeight: 1.2,
  },
  metricSubtext: {
    fontSize: 9,
    fontWeight: 'semibold',
    color: COLORS.gray700,
    marginTop: 3,
  },
  chartContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    padding: 10,
    marginBottom: 6,
  },
  chartImage: {
    width: '100%',
    height: 'auto',
    marginTop: 8,
  },
  ratingsGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    width: '100%',
  },
  ratingCardWrapper: {
    width: '18.5%',
    marginRight: '1.875%',
    marginBottom: 8,
    flexShrink: 0,
  },
  ratingCardWrapperLast: {
    width: '18.5%',
    marginRight: 0,
    marginBottom: 8,
    flexShrink: 0,
  },
  ratingCard: {
    textAlign: 'center',
    backgroundColor: COLORS.pastelGray,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    width: '100%',
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.navy,
    lineHeight: 1.1,
  },
  ratingLabel: {
    fontSize: 8,
    fontWeight: 'semibold',
    color: COLORS.gray600,
    marginTop: 3,
    lineHeight: 1.1,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  roleCardWrapper: {
    width: '23%',
    marginRight: '2%',
    marginBottom: 4,
  },
  roleCardWrapperLast: {
    width: '23%',
    marginRight: 0,
    marginBottom: 4,
  },
  roleCard: {
    textAlign: 'center',
    backgroundColor: COLORS.pastelGray,
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  roleValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.navy,
  },
  roleLabel: {
    fontSize: 9,
    fontWeight: 'semibold',
    color: COLORS.gray600,
    marginTop: 2,
  },
  departmentCard: {
    flex: 1,
    borderRadius: 6,
    padding: 14,
    borderWidth: 1.5,
  },
  departmentCardBlue: {
    backgroundColor: COLORS.pastelBlue,
    borderColor: COLORS.pastelBlueBorder,
    borderWidth: 1.5,
  },
  departmentCardPurple: {
    backgroundColor: COLORS.pastelPurple,
    borderColor: COLORS.pastelPurpleBorder,
    borderWidth: 1.5,
  },
  departmentTitle: {
    fontWeight: 'bold',
    color: COLORS.navy,
    marginBottom: 8,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  departmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
  },
  departmentLabel: {
    fontSize: 9,
    fontWeight: 'semibold',
    color: COLORS.gray600,
  },
  departmentValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.navy,
  },
  monthTitle: {
    textAlign: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gray200,
  },
  monthName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.navy,
  },
  monthSubtitle: {
    fontSize: 9,
    fontWeight: 'medium',
    color: COLORS.gray600,
    marginTop: 2,
  },
  peakHoursList: {
    flexDirection: 'column',
  },
  peakItemWrapper: {
    marginBottom: 3,
  },
  peakHourItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.pastelBlue,
    padding: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.pastelBlueBorder,
  },
  peakDayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.pastelPurple,
    padding: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.pastelPurpleBorder,
  },
  peakText: {
    fontSize: 9,
    fontWeight: 'semibold',
    color: COLORS.gray700,
  },
  peakValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.navy,
  },
  twoColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  twoColGridItem: {
    width: '48%',
    marginRight: '2%',
    marginBottom: 8,
  },
  twoColGridItemLast: {
    width: '48%',
    marginRight: 0,
    marginBottom: 8,
  },
});

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Helper function to format hour
const formatHour = (hour) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const nextHour = hour + 1;
  const nextPeriod = nextHour >= 12 ? 'PM' : 'AM';
  const displayNextHour = nextHour === 0 ? 12 : nextHour > 12 ? nextHour - 12 : nextHour;
  return `${displayHour}:00 ${period} - ${displayNextHour}:00 ${nextPeriod}`;
};

const AnalyticalReportPDF = ({ reportData, userRole, chartImages = {} }) => {
  const LVCampusConnectColors = [COLORS.navy, COLORS.purple, COLORS.blue, COLORS.lightBlue, COLORS.yellow];

  // Get absolute URLs for images
  const getImageUrl = (path) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${path}`;
    }
    return path;
  };

  const headerImageUrl = getImageUrl('/analytics/report-header.png');
  const footerImageUrl = getImageUrl('/analytics/report-footer.png');

  return (
    <Document>
      {/* Page 1 */}
      <Page size="A4" style={styles.page}>
        {/* Header Image */}
        <View style={{ margin: 0, padding: 0, width: '100%' }}>
          <Image
            src={headerImageUrl}
            style={styles.headerImage}
          />
        </View>

        {/* Content Area */}
        <View style={styles.contentArea}>
          {/* Report Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{userRole} Analytical Report</Text>
            <Text style={styles.subtitle}>{reportData.metadata?.reportPeriod}</Text>
            <Text style={styles.generatedDate}>
              Generated: {formatDate(reportData.metadata?.generatedAt)}
            </Text>
          </View>

          {/* Executive Summary */}
          <View style={styles.executiveSummary}>
            <View style={styles.sectionTitle}>
              <View style={styles.sectionTitleBar} />
              <Text>Executive Summary</Text>
            </View>
            <View style={styles.grid2Col}>
              {userRole === 'MIS Super Admin' ? (
                <>
                  <View style={[styles.grid2ColItem, styles.statCard]}>
                    <Text style={styles.statLabel}>Total Visitors</Text>
                    <Text style={styles.statValue}>
                      {reportData.totalVisitors?.toLocaleString() || '0'}
                    </Text>
                  </View>
                  <View style={[styles.grid2ColItemLast, styles.statCard]}>
                    <Text style={styles.statLabel}>Average Rating</Text>
                    <Text style={styles.statValue}>
                      {reportData.kioskRatings?.averageRating?.toFixed(2) || '0.00'} / 5.0
                    </Text>
                  </View>
                  <View style={[styles.grid2ColItem, styles.statCard]}>
                    <Text style={styles.statLabel}>Total Ratings</Text>
                    <Text style={styles.statValue}>
                      {reportData.kioskRatings?.totalRatings?.toLocaleString() || '0'}
                    </Text>
                  </View>
                  <View style={[styles.grid2ColItemLast, styles.statCard]}>
                    <Text style={styles.statLabel}>Priority Visitors</Text>
                    <Text style={styles.statValue}>
                      {reportData.priorityVisitors?.toLocaleString() || '0'}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.grid2ColItem, styles.statCard]}>
                    <Text style={styles.statLabel}>Total Visits</Text>
                    <Text style={styles.statValue}>
                      {reportData.totalVisits?.toLocaleString() || '0'}
                    </Text>
                  </View>
                  <View style={[styles.grid2ColItemLast, styles.statCard]}>
                    <Text style={styles.statLabel}>Avg Turnaround Time</Text>
                    <Text style={styles.statValue}>
                      {reportData.avgTurnaroundMinutes || '0'} mins
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* MIS Super Admin - Most Visited Office Chart */}
          {userRole === 'MIS Super Admin' && (
            <View style={styles.chartContainer}>
              <View style={styles.sectionTitle}>
                <View style={styles.sectionTitleBar} />
                <Text>Most Visited Office</Text>
              </View>
              {chartImages.mostVisitedOffice ? (
                <Image src={chartImages.mostVisitedOffice} style={styles.chartImage} />
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.gray600, fontSize: 10 }}>Chart loading...</Text>
                </View>
              )}
            </View>
          )}

          {/* Registrar/Admissions Admin - Top Performing Metrics */}
          {(userRole === 'Registrar Admin' || userRole === 'Admissions Admin') && (
            <>
              <View style={styles.chartContainer}>
                <View style={styles.sectionTitle}>
                  <View style={styles.sectionTitleBar} />
                  <Text>Top Performing Metrics</Text>
                </View>
                <View style={styles.grid4Col}>
                  {/* Busiest Month */}
                  <View style={[styles.grid4ColItem, styles.metricCard, styles.metricCardBlue]}>
                    <Text style={[styles.metricLabel, styles.metricLabelBlue]}>Busiest Month</Text>
                    <Text style={styles.metricValue}>
                      {reportData.monthlyBreakdown && reportData.monthlyBreakdown.length > 0
                        ? reportData.monthlyBreakdown.reduce((max, month) =>
                            month.totalVisits > max.totalVisits ? month : max,
                            { totalVisits: 0, monthName: 'N/A' }
                          ).monthName
                        : 'N/A'}
                    </Text>
                    <Text style={styles.metricSubtext}>
                      {reportData.monthlyBreakdown && reportData.monthlyBreakdown.length > 0
                        ? reportData.monthlyBreakdown.reduce((max, month) =>
                            month.totalVisits > max.totalVisits ? month : max,
                            { totalVisits: 0, monthName: 'N/A' }
                          ).totalVisits.toLocaleString()
                        : '0'} visits
                    </Text>
                  </View>

                  {/* Peak Service */}
                  <View style={[styles.grid4ColItem, styles.metricCard, styles.metricCardPurple]}>
                    <Text style={[styles.metricLabel, styles.metricLabelPurple]}>Peak Service</Text>
                    <Text style={styles.metricValue}>
                      {reportData.serviceDistribution?.[0]?.service || 'N/A'}
                    </Text>
                    <Text style={styles.metricSubtext}>
                      {reportData.serviceDistribution?.[0]?.count?.toLocaleString() || '0'} requests
                    </Text>
                  </View>

                  {/* Best Turnaround */}
                  <View style={[styles.grid4ColItem, styles.metricCard, styles.metricCardGreen]}>
                    <Text style={[styles.metricLabel, styles.metricLabelGreen]}>Best Turnaround</Text>
                    <Text style={styles.metricValue}>
                      {reportData.monthlyBreakdown && reportData.monthlyBreakdown.length > 0
                        ? reportData.monthlyBreakdown.reduce((min, month) =>
                            month.avgTurnaroundMinutes < min.avgTurnaroundMinutes ? month : min,
                            { avgTurnaroundMinutes: Infinity, monthName: 'N/A' }
                          ).monthName
                        : 'N/A'}
                    </Text>
                    <Text style={styles.metricSubtext}>
                      {reportData.monthlyBreakdown && reportData.monthlyBreakdown.length > 0
                        ? reportData.monthlyBreakdown.reduce((min, month) =>
                            month.avgTurnaroundMinutes < min.avgTurnaroundMinutes ? month : min,
                            { avgTurnaroundMinutes: Infinity, monthName: 'N/A' }
                          ).avgTurnaroundMinutes
                        : '0'} mins avg
                    </Text>
                  </View>

                  {/* Overall Peak Hour */}
                  <View style={[styles.grid4ColItemLast, styles.metricCard, styles.metricCardYellow]}>
                    <Text style={[styles.metricLabel, styles.metricLabelYellow]}>Overall Peak Hour</Text>
                    <Text style={styles.metricValue}>
                      {(() => {
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
                    </Text>
                    <Text style={styles.metricSubtext}>
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
                    </Text>
                  </View>
                </View>
              </View>

              {/* Overall Service Distribution Chart */}
              <View style={styles.chartContainer}>
                <View style={styles.sectionTitle}>
                  <View style={styles.sectionTitleBar} />
                  <Text>Overall Service Distribution</Text>
                </View>
                {chartImages.serviceDistribution ? (
                  <Image src={chartImages.serviceDistribution} style={styles.chartImage} />
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: COLORS.gray600, fontSize: 10 }}>Chart loading...</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* Footer Image */}
        <Image
          src={footerImageUrl}
          style={styles.footerImage}
        />
      </Page>

      {/* Page 2 - MIS Super Admin Continued */}
      {userRole === 'MIS Super Admin' && (
        <Page size="A4" style={styles.page}>
          <View style={{ margin: 0, padding: 0, width: '100%' }}>
            <Image
              src={headerImageUrl}
              style={styles.headerImage}
            />
          </View>

          <View style={styles.contentArea}>
            {/* Service Distribution Overall */}
            <View style={styles.chartContainer}>
              <View style={styles.sectionTitle}>
                <View style={styles.sectionTitleBar} />
                <Text>Service Distribution Overall</Text>
              </View>
              {chartImages.serviceDistributionOverall ? (
                <Image src={chartImages.serviceDistributionOverall} style={styles.chartImage} />
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.gray600, fontSize: 10 }}>Chart loading...</Text>
                </View>
              )}
            </View>

            {/* Kiosk Ratings Breakdown */}
            <View style={styles.chartContainer}>
              <View style={styles.sectionTitle}>
                <View style={styles.sectionTitleBar} />
                <Text>Kiosk Ratings Distribution</Text>
              </View>
              <View style={styles.ratingsGrid}>
                {[5, 4, 3, 2, 1].map((star, index) => (
                  <View key={star} style={index === 4 ? styles.ratingCardWrapperLast : styles.ratingCardWrapper}>
                    <View style={styles.ratingCard}>
                      <Text style={styles.ratingValue}>
                        {reportData.kioskRatings?.[`rating${star}`] || 0}
                      </Text>
                      <Text style={styles.ratingLabel}>
                        {star} Star{star !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Visitor Breakdown by Role */}
            <View style={styles.chartContainer}>
              <View style={styles.sectionTitle}>
                <View style={styles.sectionTitleBar} />
                <Text>Visitor Breakdown by Role</Text>
              </View>
              <View style={styles.roleGrid}>
                {reportData.visitorsByRole?.map((item, index, array) => (
                  <View key={index} style={(index + 1) % 4 === 0 ? styles.roleCardWrapperLast : styles.roleCardWrapper}>
                    <View style={styles.roleCard}>
                      <Text style={styles.roleValue}>{item.count}</Text>
                      <Text style={styles.roleLabel}>{item.role}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Department Comparison */}
            <View style={styles.chartContainer}>
              <View style={styles.sectionTitle}>
                <View style={styles.sectionTitleBar} />
                <Text>Department Comparison</Text>
              </View>
              <View style={styles.twoColGrid}>
                <View style={[styles.twoColGridItem, styles.departmentCard, styles.departmentCardBlue]}>
                  <Text style={styles.departmentTitle}>Registrar's Office</Text>
                  <View>
                    <View style={styles.departmentRow}>
                      <Text style={styles.departmentLabel}>Total Completed:</Text>
                      <Text style={styles.departmentValue}>
                        {reportData.departmentComparison?.registrar?.totalCompleted || '0'}
                      </Text>
                    </View>
                    <View style={styles.departmentRow}>
                      <Text style={styles.departmentLabel}>Avg Turnaround:</Text>
                      <Text style={styles.departmentValue}>
                        {reportData.departmentComparison?.registrar?.avgTurnaroundMinutes || '0'} mins
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.twoColGridItemLast, styles.departmentCard, styles.departmentCardPurple]}>
                  <Text style={styles.departmentTitle}>Admissions Office</Text>
                  <View>
                    <View style={styles.departmentRow}>
                      <Text style={styles.departmentLabel}>Total Completed:</Text>
                      <Text style={styles.departmentValue}>
                        {reportData.departmentComparison?.admissions?.totalCompleted || '0'}
                      </Text>
                    </View>
                    <View style={styles.departmentRow}>
                      <Text style={styles.departmentLabel}>Avg Turnaround:</Text>
                      <Text style={styles.departmentValue}>
                        {reportData.departmentComparison?.admissions?.avgTurnaroundMinutes || '0'} mins
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <Image
            src={footerImageUrl}
            style={styles.footerImage}
          />
        </Page>
      )}

      {/* Monthly Pages for Registrar/Admissions Admin */}
      {(userRole === 'Registrar Admin' || userRole === 'Admissions Admin') &&
        reportData.monthlyBreakdown?.map((monthData, monthIndex) => (
          <Page key={monthIndex} size="A4" style={styles.page}>
            <View style={{ margin: 0, padding: 0, width: '100%' }}>
              <Image
                src={headerImageUrl}
                style={styles.headerImage}
              />
            </View>

            <View style={styles.contentArea}>
              {/* Month Title */}
              <View style={styles.monthTitle}>
                <Text style={styles.monthName}>{monthData.monthName}</Text>
                <Text style={styles.monthSubtitle}>Monthly Detailed Report</Text>
              </View>

              {/* Month Summary Stats */}
              <View style={styles.twoColGrid}>
                <View style={[styles.twoColGridItem, styles.metricCard, styles.metricCardBlue]}>
                  <Text style={[styles.metricLabel, styles.metricLabelBlue]}>Total Visits</Text>
                  <Text style={styles.metricValue}>
                    {monthData.totalVisits?.toLocaleString() || '0'}
                  </Text>
                </View>
                <View style={[styles.twoColGridItemLast, styles.metricCard, styles.metricCardPurple]}>
                  <Text style={[styles.metricLabel, styles.metricLabelPurple]}>Avg Turnaround Time</Text>
                  <Text style={styles.metricValue}>
                    {monthData.avgTurnaroundMinutes || '0'} mins
                  </Text>
                </View>
              </View>

              {/* Service Distribution for this month */}
              <View style={styles.chartContainer}>
                <View style={styles.sectionTitle}>
                  <View style={styles.sectionTitleBar} />
                  <Text>Service Distribution</Text>
                </View>
                {chartImages[`monthlyServiceDistribution_${monthIndex}`] ? (
                  <Image
                    src={chartImages[`monthlyServiceDistribution_${monthIndex}`]}
                    style={styles.chartImage}
                  />
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: COLORS.gray600, fontSize: 10 }}>Chart loading...</Text>
                  </View>
                )}
              </View>

              {/* Visitor Breakdown by Role */}
              <View style={styles.chartContainer}>
                <View style={styles.sectionTitle}>
                  <View style={styles.sectionTitleBar} />
                  <Text>Visitor Breakdown by Role</Text>
                </View>
                <View style={styles.roleGrid}>
                  {monthData.visitorsByRole?.map((item, index) => (
                    <View key={index} style={(index + 1) % 4 === 0 ? styles.roleCardWrapperLast : styles.roleCardWrapper}>
                      <View style={styles.roleCard}>
                        <Text style={styles.roleValue}>{item.count}</Text>
                        <Text style={styles.roleLabel}>{item.role}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Peak Hours and Peak Days */}
              <View style={styles.twoColGrid}>
                {/* Peak Hours */}
                <View style={[styles.twoColGridItem, styles.chartContainer]}>
                  <View style={styles.sectionTitle}>
                    <View style={styles.sectionTitleBar} />
                    <Text>Peak Hours (Top 5)</Text>
                  </View>
                  <View style={styles.peakHoursList}>
                    {monthData.peakHours?.slice(0, 5).map((item, index) => (
                      <View key={index} style={styles.peakItemWrapper}>
                        <View style={styles.peakHourItem}>
                          <Text style={styles.peakText}>{formatHour(item.hour)}</Text>
                          <Text style={styles.peakValue}>{item.count}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Peak Days */}
                <View style={[styles.twoColGridItemLast, styles.chartContainer]}>
                  <View style={styles.sectionTitle}>
                    <View style={styles.sectionTitleBar} />
                    <Text>Peak Days (Top 5)</Text>
                  </View>
                  <View style={styles.peakHoursList}>
                    {monthData.peakDays?.slice(0, 5).map((item, index) => (
                      <View key={index} style={styles.peakItemWrapper}>
                        <View style={styles.peakDayItem}>
                          <Text style={styles.peakText}>{item.day}</Text>
                          <Text style={styles.peakValue}>{item.count}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            <Image
              src={footerImageUrl}
              style={styles.footerImage}
            />
          </Page>
        ))}
    </Document>
  );
};

export default AnalyticalReportPDF;

