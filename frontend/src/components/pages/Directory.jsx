import React, { useState, useEffect } from 'react';
import { ResponsiveGrid } from '../ui';
import DirectoryLayout from '../layouts/DirectoryLayout';
import { KioskLayout } from '../layouts';
import { FaLocationDot } from 'react-icons/fa6';
import { io } from 'socket.io-client';
import API_CONFIG from '../../config/api';

const Directory = () => {
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [offices, setOffices] = useState([]);
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  // Fixed layout structure

  // Initialize Socket.io connection for real-time updates
  useEffect(() => {
    const newSocket = io(API_CONFIG.getKioskUrl());
    setSocket(newSocket);

    // Join kiosk room for real-time updates
    newSocket.emit('join-room', 'kiosk-directory');

    // Listen for chart updates
    newSocket.on('chart-updated', () => {
      fetchCharts();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fetch offices and charts on component mount
  useEffect(() => {
    fetchOffices();
    fetchCharts();
  }, []);

  const fetchOffices = async () => {
    try {
      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/database/office`);
      if (response.ok) {
        const data = await response.json();
        const officeList = Array.isArray(data) ? data : (data.records || []);
        setOffices(officeList);
      } else {
        console.error('Failed to fetch offices');
      }
    } catch (error) {
      console.error('Error fetching offices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharts = async () => {
    try {
      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/database/chart`);
      if (response.ok) {
        const data = await response.json();
        const chartList = Array.isArray(data) ? data : (data.records || []);
        setCharts(chartList);
      } else {
        console.error('Failed to fetch charts');
      }
    } catch (error) {
      console.error('Error fetching charts:', error);
    }
  };

  // Get chart for selected office
  const getCurrentChart = () => {
    if (!selectedDepartment) return null;
    const selectedOffice = offices.find(o => o._id === selectedDepartment);
    if (!selectedOffice) return null;
    return charts.find(c => c.officeId === selectedOffice._id);
  };

  const currentChart = getCurrentChart();

  // Legacy organizational chart data for each office (kept for reference, not currently used)
  const organizationalData = {
    admissions: {
      name: "Admissions Office",
      description: "Responsible for student recruitment, application processing, and enrollment management",
      email: "admissions@lv.edu.ph",
      head: {
        id: 1,
        name: "Dr. Patricia Williams",
        title: "Director of Admissions"
      },
      staff: [
        {
          id: 2,
          name: "Robert Wilson",
          title: "Senior Admissions Counselor",
          reports_to: 1
        },
        {
          id: 3,
          name: "Jennifer Martinez",
          title: "Admissions Counselor",
          reports_to: 1
        },
        {
          id: 4,
          name: "David Chen",
          title: "International Admissions Specialist",
          reports_to: 1
        },
        {
          id: 5,
          name: "Lisa Thompson",
          title: "Admissions Assistant",
          reports_to: 2
        }
      ]
    },
    registrar: {
      name: "Registrar's Office",
      description: "Manages student records, transcripts, enrollment verification, and academic scheduling",
      email: "registrar@lv.edu.ph",
      head: {
        id: 1,
        name: "Sarah Johnson",
        title: "University Registrar"
      },
      staff: [
        {
          id: 2,
          name: "Mark Rodriguez",
          title: "Assistant Registrar",
          reports_to: 1
        },
        {
          id: 3,
          name: "Amanda Foster",
          title: "Records Specialist",
          reports_to: 2
        },
        {
          id: 4,
          name: "Kevin Park",
          title: "Scheduling Coordinator",
          reports_to: 2
        },
        {
          id: 5,
          name: "Rachel Green",
          title: "Transcript Specialist",
          reports_to: 3
        }
      ]
    },
    academic: {
      name: "Academic Affairs",
      description: "Oversees curriculum development, faculty affairs, and academic policy implementation",
      email: "academic.affairs@lv.edu.ph",
      head: {
        id: 1,
        name: "Dr. Michael Harrison",
        title: "Vice President of Academic Affairs"
      },
      staff: [
        {
          id: 2,
          name: "Dr. Susan Lee",
          title: "Associate VP of Academic Affairs",
          reports_to: 1
        },
        {
          id: 3,
          name: "Dr. James Wright",
          title: "Dean of Liberal Arts",
          reports_to: 2
        },
        {
          id: 4,
          name: "Dr. Maria Santos",
          title: "Dean of Sciences",
          reports_to: 2
        },
        {
          id: 5,
          name: "Dr. Robert Kim",
          title: "Dean of Engineering",
          reports_to: 2
        }
      ]
    },
    student_services: {
      name: "Student Services",
      description: "Provides comprehensive support services for student success and campus life",
      email: "student.services@lv.edu.ph",
      head: {
        id: 1,
        name: "Dr. Maria Garcia",
        title: "Dean of Students"
      },
      staff: [
        {
          id: 2,
          name: "Carlos Mendez",
          title: "Director of Student Life",
          reports_to: 1
        },
        {
          id: 3,
          name: "Dr. Angela Davis",
          title: "Director of Counseling Services",
          reports_to: 1
        },
        {
          id: 4,
          name: "Thomas Brown",
          title: "Financial Aid Director",
          reports_to: 1
        },
        {
          id: 5,
          name: "Nicole White",
          title: "Student Activities Coordinator",
          reports_to: 2
        }
      ]
    },
    it_mis: {
      name: "MIS Office",
      description: "Manages university technology infrastructure, systems, and digital services",
      email: "it.support@lv.edu.ph",
      head: {
        id: 1,
        name: "Dr. Steven Taylor",
        title: "Chief Information Officer"
      },
      staff: [
        {
          id: 2,
          name: "Michael Brown",
          title: "IT Director",
          reports_to: 1
        },
        {
          id: 3,
          name: "Jessica Liu",
          title: "Network Administrator",
          reports_to: 2
        },
        {
          id: 4,
          name: "Daniel Cooper",
          title: "Systems Analyst",
          reports_to: 2
        },
        {
          id: 5,
          name: "Emily Zhang",
          title: "Help Desk Supervisor",
          reports_to: 2
        }
      ]
    },
    hr: {
      name: "Human Resource Office",
      description: "Manages employee relations, benefits, recruitment, and organizational development",
      email: "hr@lv.edu.ph",
      head: {
        id: 1,
        name: "Linda Johnson",
        title: "Director of Human Resources"
      },
      staff: [
        {
          id: 2,
          name: "Patricia Adams",
          title: "HR Business Partner",
          reports_to: 1
        },
        {
          id: 3,
          name: "Christopher Lee",
          title: "Benefits Administrator",
          reports_to: 1
        },
        {
          id: 4,
          name: "Michelle Torres",
          title: "Recruitment Specialist",
          reports_to: 2
        }
      ]
    },
    finance: {
      name: "Finance & Administration",
      description: "Oversees financial operations, budgeting, accounting, and administrative services",
      email: "finance@lv.edu.ph",
      head: {
        id: 1,
        name: "Dr. Richard Thompson",
        title: "Vice President of Finance"
      },
      staff: [
        {
          id: 2,
          name: "Catherine Miller",
          title: "Controller",
          reports_to: 1
        },
        {
          id: 3,
          name: "Andrew Wilson",
          title: "Budget Director",
          reports_to: 1
        },
        {
          id: 4,
          name: "Sandra Martinez",
          title: "Accounts Payable Manager",
          reports_to: 2
        },
        {
          id: 5,
          name: "Brian Davis",
          title: "Purchasing Manager",
          reports_to: 1
        }
      ]
    },
    communications: {
      name: "Communications Office",
      description: "Manages university communications, public relations, and marketing initiatives",
      email: "communications@lv.edu.ph",
      head: {
        id: 1,
        name: "Ms. Jennifer Adams",
        title: "Director of Communications"
      },
      staff: [
        {
          id: 2,
          name: "Mark Thompson",
          title: "Public Relations Manager",
          reports_to: 1
        },
        {
          id: 3,
          name: "Sarah Wilson",
          title: "Marketing Specialist",
          reports_to: 1
        },
        {
          id: 4,
          name: "David Martinez",
          title: "Social Media Coordinator",
          reports_to: 2
        }
      ]
    },
    data_privacy: {
      name: "Data Privacy Office",
      description: "Ensures compliance with data protection laws and manages privacy policies",
      email: "privacy@lv.edu.ph",
      head: {
        id: 1,
        name: "Ms. Elena Rodriguez",
        title: "Data Protection Officer"
      },
      staff: [
        {
          id: 2,
          name: "Carlos Mendoza",
          title: "Privacy Compliance Specialist",
          reports_to: 1
        },
        {
          id: 3,
          name: "Maria Santos",
          title: "Data Security Analyst",
          reports_to: 1
        }
      ]
    },
    basic_ed: {
      name: "Basic Ed Office",
      description: "Manages elementary and secondary education programs and student affairs",
      email: "basiced@lv.edu.ph",
      head: {
        id: 1,
        name: "Dr. Carmen Dela Cruz",
        title: "Basic Education Director"
      },
      staff: [
        {
          id: 2,
          name: "Ms. Rosa Fernandez",
          title: "Elementary Coordinator",
          reports_to: 1
        },
        {
          id: 3,
          name: "Mr. Antonio Reyes",
          title: "Secondary Coordinator",
          reports_to: 1
        },
        {
          id: 4,
          name: "Ms. Grace Villanueva",
          title: "Student Affairs Coordinator",
          reports_to: 1
        }
      ]
    },
    higher_ed: {
      name: "Higher Ed Office",
      description: "Oversees undergraduate and graduate programs and academic affairs",
      email: "highered@lv.edu.ph",
      head: {
        id: 1,
        name: "Dr. Ricardo Morales",
        title: "Higher Education Director"
      },
      staff: [
        {
          id: 2,
          name: "Dr. Ana Gutierrez",
          title: "Undergraduate Programs Coordinator",
          reports_to: 1
        },
        {
          id: 3,
          name: "Dr. Miguel Torres",
          title: "Graduate Programs Coordinator",
          reports_to: 1
        },
        {
          id: 4,
          name: "Ms. Lucia Herrera",
          title: "Academic Affairs Assistant",
          reports_to: 1
        }
      ]
    }
  };

  // Component to render individual staff member in triangular org chart
  const StaffMember = ({ person, isHead = false }) => (
    <div className="flex flex-col items-center justify-center space-y-3 w-40">
      {/* Avatar Icon - Perfectly Centered with Enhanced Styling */}
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
        isHead ? 'text-white' : 'text-white'
      }`} style={{ backgroundColor: 'transparent', border: '2px solid #1F3463' }}>
        <svg className="w-8 h-8" viewBox="0 0 24 24" style={{ color: '#1F3463' }}>
          {/* Person figure - solid fill with same color as text */}
          <g fill="currentColor">
            {/* Head */}
            <circle cx="12" cy="8.5" r="2.5" />
            {/* Body */}
            <path d="M12 13c-3.5 0-6 2.5-6 5.5v1h12v-1c0-3-2.5-5.5-6-5.5z" />
          </g>
        </svg>
      </div>

      {/* Name and Title - Center Aligned with Consistent Navy Blue Color */}
      <div className="text-center w-full">
        <h3 className="text-xl font-semibold text-center leading-tight whitespace-nowrap" style={{ color: '#1F3463' }}>
          {person.name}
        </h3>
        <p className="text-lg text-center mt-1 whitespace-nowrap" style={{ color: '#1F3463' }}>
          {person.title}
        </p>
      </div>
    </div>
  );

  // Function to organize staff into triangular pyramid structure
  const organizeStaffInPyramid = (office) => {
    const allStaff = [office.head, ...office.staff];
    const rows = [];
    let currentIndex = 0;
    let rowSize = 1;

    // Create proper triangular distribution: 1, 2, 3, 4, etc.
    while (currentIndex < allStaff.length) {
      const remainingStaff = allStaff.length - currentIndex;
      const currentRowSize = Math.min(rowSize, remainingStaff);
      const row = allStaff.slice(currentIndex, currentIndex + currentRowSize);
      rows.push(row);
      currentIndex += currentRowSize;
      rowSize++;
    }

    return rows;
  };

  // Office Selection: Use KioskLayout with navigation
  if (!selectedDepartment) {
    return (
      <KioskLayout>
        <div className="h-full flex flex-col">
          {/* Office Selection Grid */}
          <div className="flex-grow flex items-center justify-center h-full">
            {/* Centered Header-Grid Unit with Flexible Positioning */}
            <div className="flex flex-col items-center justify-center w-full px-20 h-full">
              {/* Header - Positioned above grid with proper spacing */}
              <div className="mb-8">
                <h2 className="text-5xl font-semibold text-center drop-shadow-lg whitespace-nowrap" style={{ color: '#1F3463' }}>
                  SELECT OFFICE
                </h2>
              </div>

              {/* Responsive Grid Container - Natural flow positioning */}
              <div className="flex-shrink-0">
                {loading ? (
                  <div className="text-center text-gray-500">Loading offices...</div>
                ) : (
                  <ResponsiveGrid
                    items={offices}
                    onItemClick={(office) => setSelectedDepartment(office._id)}
                    renderItem={(office) => (
                      <div className="text-center">
                        <h3 className="text-2xl font-semibold text-white">
                          {office.officeName}
                        </h3>
                      </div>
                    )}
                    showPagination={offices.length > 6}
                    isDirectoryPage={true}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </KioskLayout>
    );
  }

  // Office Details View: Use DirectoryLayout as root component
  return (
        /* Office Details View - Use DirectoryLayout */
        <DirectoryLayout>
          <div className="h-full flex flex-col">
            {/* Main Content Area - Display office-specific directory images */}
            <div className="flex-grow flex items-center justify-center">
              <div className="w-full max-w-4xl mx-auto">
                {/* Office Email Display - Positioned above office content */}
                {(() => {
                  const selectedOffice = offices.find(o => o._id === selectedDepartment);
                  return selectedOffice?.officeEmail && (
                    <div className="mb-6 text-center">
                      <div className="bg-white bg-opacity-95 rounded-lg shadow-lg drop-shadow-md px-6 py-4 inline-block">
                        <div className="flex items-center justify-center space-x-3">
                          <svg
                            className="w-6 h-6"
                            style={{ color: '#1F3463' }}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                          <span
                            className="text-2xl font-semibold"
                            style={{ color: '#1F3463' }}
                          >
                            {selectedOffice.officeEmail}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Display Chart Image or Placeholder */}
                {currentChart ? (
                  <img
                    src={currentChart.image?.secure_url || currentChart.image?.url}
                    alt={`${currentChart.officeName} Directory`}
                    className="w-full h-auto object-contain rounded-lg shadow-lg"
                    onError={(e) => {
                      console.error('Failed to load chart image');
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  /* Placeholder for offices without charts */
                  <div className="bg-white bg-opacity-90 rounded-lg shadow-xl drop-shadow-lg p-12 text-center">
                    <h2 className="text-5xl font-bold mb-6" style={{ color: '#1F3463' }}>
                      {offices.find(o => o._id === selectedDepartment)?.officeName}
                    </h2>
                    <p className="text-2xl text-gray-600 mb-8">
                      Directory chart coming soon
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Buttons - Positioned at bottom-left corner */}
            <div className="fixed bottom-6 left-6 flex flex-col space-y-4 z-50">
              {/* Location Button */}
              <button
                className="w-20 h-20 bg-[#FFE251] text-[#1A2E56] border-2 border-white rounded-full shadow-lg active:shadow-md drop-shadow-md active:drop-shadow-sm active:bg-[#1A2E56] active:scale-95 transition-all duration-150 flex flex-col items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-200"
                aria-label="Find office location"
              >
                <FaLocationDot className="w-6 h-6 mb-1" />
                <span className="text-lg font-semibold">Location</span>
              </button>

              {/* Back Button */}
              <button
                onClick={() => setSelectedDepartment(null)}
                className="w-20 h-20 bg-[#FFE251] text-[#1A2E56] border-2 border-white rounded-full shadow-lg active:shadow-md drop-shadow-md active:drop-shadow-sm active:bg-[#1A2E56] active:scale-95 transition-all duration-150 flex flex-col items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-200"
                aria-label="Go back to directory listing"
              >
                <span className="text-lg font-semibold">BACK</span>
              </button>
            </div>
          </div>
    </DirectoryLayout>
  );
};

export default Directory;
