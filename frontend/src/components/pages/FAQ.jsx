import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import API_CONFIG from '../../config/api';

const FAQ = () => {
  const [openFAQ, setOpenFAQ] = useState(null);
  const [faqData, setFaqData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Initialize Socket.io connection
  useEffect(() => {
    const newSocket = io(API_CONFIG.getKioskUrl());
    setSocket(newSocket);

    // Join kiosk room for real-time updates
    newSocket.emit('join-room', 'kiosk');

    // Listen for FAQ updates
    newSocket.on('faq-updated', (data) => {
      console.log('📡 FAQ update received in kiosk:', data);
      fetchFAQs();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fetch FAQs on component mount
  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/faq`);
      if (response.ok) {
        const result = await response.json();
        // Transform API data to match component structure
        const transformedData = (result.data || []).map((faq, index) => ({
          id: faq._id || index + 1,
          category: faq.category,
          question: faq.question,
          answer: faq.answer
        }));
        setFaqData(transformedData);
      } else {
        console.error('Failed to fetch FAQs');
      }
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFAQ = (id) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Main Content Area */}
      <div className="flex-grow flex items-center justify-center p-8">
        {/* White Background Container with Fixed Height and Scrollable Content */}
        <div className="bg-white rounded-xl shadow-xl drop-shadow-lg w-full max-w-3xl h-[60vh] flex flex-col overflow-hidden">
          {/* Header inside white container */}
          <div className="pt-8 pb-6 px-8 flex-shrink-0">
            <h1 className="text-5xl font-semibold text-center drop-shadow-lg" style={{ color: '#161F55' }}>
              FREQUENTLY ASKED QUESTIONS
            </h1>
          </div>

          {/* Scrollable FAQ Content */}
          <div className="flex-grow overflow-y-auto px-8 pb-8">
            <div className="space-y-3 max-w-4xl mx-auto">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F3463] mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">Loading FAQs...</p>
                  </div>
                </div>
              ) : faqData.length === 0 ? (
                <div className="flex justify-center items-center py-12">
                  <p className="text-gray-600 text-lg">No FAQs available at the moment.</p>
                </div>
              ) : (
                faqData.map((faq) => (
                <div
                  key={faq.id}
                  className="bg-gray-50 rounded-lg shadow-lg drop-shadow-sm border border-gray-200 overflow-hidden"
                >
                  <button
                    onClick={() => toggleFAQ(faq.id)}
                    className="w-full px-6 py-4 text-left active:bg-gray-100 focus:outline-none focus:bg-gray-100 active:scale-95 transition-all duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-gray-800 pr-4">
                        {faq.question}
                      </h3>
                      <div className="flex-shrink-0">
                        {openFAQ === faq.id ? (
                          <svg
                            className="w-6 h-6 transition-transform duration-200"
                            style={{ color: '#1F3463' }}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg
                            className="w-6 h-6 transition-transform duration-200"
                            style={{ color: '#1F3463' }}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>

                  {openFAQ === faq.id && (
                    <div className="px-6 pb-4 border-t border-gray-100 animate-fadeIn bg-white">
                      <p className="text-lg text-gray-700 leading-relaxed pt-4">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
