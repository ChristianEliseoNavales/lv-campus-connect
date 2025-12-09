import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { IoMdRefresh } from 'react-icons/io';
import { MdClose } from 'react-icons/md';
import { useAuth } from '../../../../contexts/AuthContext';
import { useSocket } from '../../../../contexts/SocketContext';
import { ToastContainer } from '../../../ui/Toast';
import { useNotification } from '../../../../hooks/useNotification';
import textToSpeechService from '../../../../utils/textToSpeech';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';

const Queue = () => {
  const { windowId } = useParams();
  const { user } = useAuth();
  const { socket, isConnected, joinRoom, leaveRoom, subscribe } = useSocket();
  const { toasts, removeToast, showSuccess, showError, showInfo, showWarning } = useNotification();
  const [windowData, setWindowData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Real queue data from backend
  const [currentServing, setCurrentServing] = useState(0);
  const [queueData, setQueueData] = useState([]);
  const [skippedQueue, setSkippedQueue] = useState([]);
  const [currentServingPerson, setCurrentServingPerson] = useState(null);

  // Transfer modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [availableWindows, setAvailableWindows] = useState([]);
  const [selectedWindow, setSelectedWindow] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);

  // Window serving status
  const [isWindowServing, setIsWindowServing] = useState(true);
  const [actionLoading, setActionLoading] = useState({
    stop: false,
    next: false,
    recall: false,
    previous: false,
    transfer: false,
    skip: false,
    requeueAll: false
  });

  // Manual refresh state
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected skipped queue numbers for selective requeue
  const [selectedSkippedQueues, setSelectedSkippedQueues] = useState([]);

  // Queue enabled status from Settings
  const [isQueueingEnabled, setIsQueueingEnabled] = useState(true);

  // Debug: Log currentServingPerson changes
  useEffect(() => {
    if (windowData?.name === 'Priority') {
      // console.log('🔍 [RENDER] Priority Window - currentServingPerson state:', currentServingPerson);
      // console.log('🔍 [RENDER] Has idNumber?', currentServingPerson?.idNumber);
      // console.log('🔍 [RENDER] Condition check:', {
      //   isWindowPriority: windowData?.name === 'Priority',
      //   hasIdNumber: !!currentServingPerson?.idNumber,
      //   shouldDisplay: windowData?.name === 'Priority' && currentServingPerson?.idNumber
      // });
    }
  }, [currentServingPerson, windowData]);

  // Fetch queue enabled status
  const fetchQueueEnabledStatus = async () => {
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/settings/queue/registrar`);
      if (response.ok) {
        const data = await response.json();
        setIsQueueingEnabled(data.isEnabled);
      }
    } catch (error) {
      console.error('Error fetching queue enabled status:', error);
    }
  };

  // Fetch window data
  useEffect(() => {
    const fetchWindowData = async () => {
      try {
        const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/windows/registrar`);
        const windows = await response.json();
        const window = windows.find(w => w.id === windowId);
        setWindowData(window);
      } catch (error) {
        console.error('Error fetching window data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (windowId) {
      fetchWindowData();
      fetchQueueEnabledStatus();
    } else {
      setLoading(false);
    }
  }, [windowId]);

  // Fetch queue data filtered by window ID (ensures each window only sees its own queues)
  const fetchQueueData = async () => {
    try {
      // Build URL with windowId filtering to ensure window-specific queue data
      let url = `${API_CONFIG.getAdminUrl()}/api/public/queue-data/registrar`;

      if (windowData?.id) {
        // Filter by windowId to ensure each window only sees queues assigned to it
        url += `?windowId=${encodeURIComponent(windowData.id)}`;
        // console.log('🔍 Fetching queues filtered by windowId:', windowData.id);
        // console.log('🪟 Window name:', windowData.name);
      }

      const response = await authFetch(url);
      const result = await response.json();

      // DEBUG: Log the RAW response
      // console.log('🔍 [RAW RESPONSE] Full result object:', result);
      // console.log('🔍 [RAW RESPONSE] result.data:', result.data);
      // console.log('🔍 [RAW RESPONSE] result.data.currentlyServing:', result.data.currentlyServing);
      // console.log('🔍 [RAW RESPONSE] Has idNumber in response?', 'idNumber' in (result.data.currentlyServing || {}));

      if (result.success) {
        // console.log('📊 Queue data received:', {
        //   waitingCount: result.data.waitingQueue.length,
        //   currentlyServing: result.data.currentlyServing?.number || 'None',
        //   filters: result.data.filters
        // });

        // Data is already filtered by the backend, so use it directly
        setQueueData(result.data.waitingQueue);
        setSkippedQueue(result.data.skippedQueue);
        setCurrentServingPerson(result.data.currentlyServing);

        // Clear selected skipped queues if they no longer exist in the skipped queue
        setSelectedSkippedQueues(prev =>
          prev.filter(num => result.data.skippedQueue.includes(num))
        );

        // Debug logging for Priority window ID Number
        // if (windowData?.name === 'Priority' && result.data.currentlyServing) {
        //   console.log('🔍 [PRIORITY WINDOW] Current Serving Person:', result.data.currentlyServing);
        //   console.log('🔍 [PRIORITY WINDOW] Has idNumber?', !!result.data.currentlyServing.idNumber);
        //   console.log('🔍 [PRIORITY WINDOW] idNumber value:', result.data.currentlyServing.idNumber);
        //   console.log('🔍 [PRIORITY WINDOW] Window name:', windowData.name);
        // }

        // Debug logging for all windows
        // console.log('📊 [FETCH QUEUE DATA] Window:', windowData?.name);
        // console.log('📊 [FETCH QUEUE DATA] Currently Serving:', result.data.currentlyServing);

        if (result.data.currentlyServing) {
          setCurrentServing(result.data.currentlyServing.number);
        } else {
          setCurrentServing(0);
        }

        // Update refresh timestamp
        setLastRefreshTime(new Date());
      }
    } catch (error) {
      console.error('Error fetching queue data:', error);
    }
  };

  // Manual refresh function for incoming queue
  const handleManualRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchQueueData();
      showSuccess('Refreshed', 'Queue data updated successfully');
    } catch (error) {
      console.error('Manual refresh error:', error);
      showError('Refresh Failed', 'Unable to update queue data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format timestamp for display
  const formatRefreshTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Join Socket.io room and listen for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 Registrar Queue: Joining admin-registrar room');
    joinRoom('admin-registrar');

    // Subscribe to queue updates
    const unsubscribeQueue = subscribe('queue-updated', (data) => {
      if (data.department === 'registrar') {
        // console.log('📡 Real-time queue update received:', data);

        // Handle specific queue update types
        switch (data.type) {
          case 'next-called':
            if (data.windowId === windowData?.id) {
              setCurrentServing(data.data.queueNumber);
              setCurrentServingPerson({
                name: data.data.customerName,
                role: data.data.role || 'Customer',
                purpose: windowData?.serviceName || 'General Service',
                idNumber: data.data.idNumber || ''
              });
            }
            break;

          case 'queue-transferred':
            if (data.data.fromWindowId === windowData?.id) {
              // Queue was transferred away from this window
              setCurrentServing(0);
              setCurrentServingPerson(null);
            } else if (data.data.toWindowId === windowData?.id) {
              // Queue was transferred to this window
              setCurrentServing(data.data.queueNumber);
              setCurrentServingPerson({
                name: data.data.customerName,
                role: data.data.role || 'Customer',
                purpose: windowData?.serviceName || 'General Service',
                idNumber: data.data.idNumber || ''
              });
            }
            break;

          case 'queue-skipped':
            if (data.windowId === windowData?.id) {
              if (data.data.nextQueue) {
                setCurrentServing(data.data.nextQueue.queueNumber);
                setCurrentServingPerson({
                  name: data.data.nextQueue.customerName,
                  role: data.data.nextQueue.role || 'Customer',
                  purpose: windowData?.serviceName || 'General Service',
                  idNumber: data.data.nextQueue.idNumber || ''
                });
              } else {
                setCurrentServing(0);
                setCurrentServingPerson(null);
              }
            }
            break;

          case 'previous-recalled':
            if (data.windowId === windowData?.id) {
              setCurrentServing(data.data.queueNumber);
              setCurrentServingPerson({
                name: data.data.customerName,
                role: data.data.role || 'Customer',
                purpose: windowData?.serviceName || 'General Service',
                idNumber: data.data.idNumber || ''
              });
            }
            break;

          case 'queue-requeued-all':
            if (data.windowId === windowData?.id) {
              // Show success toast for re-queue operation
              showSuccess(
                'Queues Re-queued',
                `${data.data.requeuedCount} queue${data.data.requeuedCount > 1 ? 's' : ''} re-queued successfully`
              );
            }
            break;
        }

        // Always refresh queue data for any queue update
        fetchQueueData();
      }
    });

    // Subscribe to window status updates
    const unsubscribeWindow = subscribe('window-status-updated', (data) => {
      if (data.department === 'registrar' && data.windowId === windowData?.id) {
        // console.log('📡 Window status update received:', data);
        setIsWindowServing(data.data.isServing);
      }
    });

    // Subscribe to settings updates for queue toggle
    const unsubscribeSettings = subscribe('settings-updated', (data) => {
      if (data.department === 'registrar' && data.type === 'queue-toggle') {
        setIsQueueingEnabled(data.data.isEnabled);
      }
    });

    // Fetch initial queue data only if window data is available
    if (windowData) {
      fetchQueueData();
    }

    return () => {
      unsubscribeQueue();
      unsubscribeWindow();
      unsubscribeSettings();
      leaveRoom('admin-registrar');
    };
  }, [socket, isConnected, windowData]); // Add windowData as dependency

  // Refresh queue data every 30 seconds (only when window data is available)
  useEffect(() => {
    if (windowData) {
      const interval = setInterval(fetchQueueData, 30000);
      return () => clearInterval(interval);
    }
  }, [windowData]);

  // Queue control handlers
  const handleStop = async () => {
    if (!windowData) {
      showError('Error', 'Window data not available');
      return;
    }

    if (!isQueueingEnabled) {
      showWarning('Queue Management Disabled', 'Queue management is currently off. Please enable queueing in Settings to manage queues.');
      return;
    }

    setActionLoading(prev => ({ ...prev, stop: true }));

    try {
      const action = isWindowServing ? 'pause' : 'resume';
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/public/queue/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          windowId: windowData.id,
          action
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsWindowServing(!isWindowServing);
        showSuccess(
          'Window Status Updated',
          `${windowData.name} has been ${action === 'pause' ? 'paused' : 'resumed'}`
        );
        // console.log(`✅ Window ${action}d:`, windowData.name);
      } else {
        throw new Error(result.error || 'Failed to update window status');
      }
    } catch (error) {
      console.error('❌ Stop/Resume error:', error);
      showError('Error', error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, stop: false }));
    }
  };

  const handleNext = async () => {
    if (!windowData) {
      showError('Error', 'Window data not available');
      return;
    }

    if (!isQueueingEnabled) {
      showWarning('Queue Management Disabled', 'Queue management is currently off. Please enable queueing in Settings to manage queues.');
      return;
    }

    // Allow Next button to work even when no incoming queues if there's a current serving queue
    // This will complete the current queue and show "no more queues" message
    if (queueData.length === 0 && currentServing === 0) {
      showWarning('No Queue', 'No queues waiting for this service');
      return;
    }

    if (!isWindowServing) {
      showWarning('Window Paused', 'Please resume the window before calling next queue');
      return;
    }

    setActionLoading(prev => ({ ...prev, next: true }));

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/public/queue/next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          windowId: windowData.id,
          adminId: user?.id || '507f1f77bcf86cd799439011' // Valid ObjectId for development
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Check if there are no more queues
        if (result.data.noMoreQueues) {
          // Clear current serving
          setCurrentServing(0);
          setCurrentServingPerson(null);

          // Refresh queue data
          fetchQueueData();

          showInfo(
            'No More Queues',
            'All queues have been served. Window is ready for new queues.'
          );

          // console.log('✅ No more queues waiting');
        } else {
          // Fetch updated queue data to get complete information including idNumber
          await fetchQueueData();

          // Trigger text-to-speech announcement
          if (textToSpeechService.isReady()) {
            await textToSpeechService.announceQueueNumber(
              result.data.queueNumber,
              result.data.windowName
            );
          }

          // Refresh queue data
          fetchQueueData();

          showSuccess(
            'Queue Called',
            `Queue ${String(result.data.queueNumber).padStart(2, '0')} called to ${result.data.windowName}`
          );

          // console.log('✅ Next queue called:', result.data);
        }
      } else {
        throw new Error(result.error || 'Failed to call next queue');
      }
    } catch (error) {
      console.error('❌ Next queue error:', error);
      showError('Error', error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, next: false }));
    }
  };

  const handleRecall = async () => {
    if (!windowData) {
      showError('Error', 'Window data not available');
      return;
    }

    if (!isQueueingEnabled) {
      showWarning('Queue Management Disabled', 'Queue management is currently off. Please enable queueing in Settings to manage queues.');
      return;
    }

    if (currentServing === 0) {
      showWarning('No Queue', 'No queue currently being served');
      return;
    }

    setActionLoading(prev => ({ ...prev, recall: true }));

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/public/queue/recall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          windowId: windowData.id
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Trigger text-to-speech announcement
        if (textToSpeechService.isReady()) {
          await textToSpeechService.announceQueueNumber(
            result.data.queueNumber,
            result.data.windowName
          );
        }

        showInfo(
          'Queue Recalled',
          `Queue ${String(result.data.queueNumber).padStart(2, '0')} recalled to ${result.data.windowName}`
        );

        // console.log('✅ Queue recalled:', result.data);
      } else {
        throw new Error(result.error || 'Failed to recall queue');
      }
    } catch (error) {
      console.error('❌ Recall queue error:', error);
      showError('Error', error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, recall: false }));
    }
  };

  const handlePrevious = async () => {
    if (!windowData) {
      showError('Error', 'Window data not available');
      return;
    }

    if (!isQueueingEnabled) {
      showWarning('Queue Management Disabled', 'Queue management is currently off. Please enable queueing in Settings to manage queues.');
      return;
    }

    setActionLoading(prev => ({ ...prev, previous: true }));

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/public/queue/previous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          windowId: windowData.id,
          adminId: user?.id || '507f1f77bcf86cd799439011' // Valid ObjectId for development
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update local state
        setCurrentServing(result.data.queueNumber);
        setCurrentServingPerson({
          name: result.data.customerName,
          role: 'Customer',
          purpose: windowData.serviceName || 'General Service'
        });

        // Trigger text-to-speech announcement
        if (textToSpeechService.isReady()) {
          await textToSpeechService.announceQueueNumber(
            result.data.queueNumber,
            result.data.windowName
          );
        }

        // Refresh queue data
        fetchQueueData();

        showSuccess(
          'Previous Queue Recalled',
          `Queue ${String(result.data.queueNumber).padStart(2, '0')} recalled to ${result.data.windowName}`
        );

        // console.log('✅ Previous queue recalled:', result.data);
      } else {
        throw new Error(result.error || 'Failed to recall previous queue');
      }
    } catch (error) {
      console.error('❌ Previous queue error:', error);
      // Check if it's specifically about no previous queues (not an actual error)
      if (error.message && error.message.includes('No previously served queue')) {
        showWarning('No Previous Queue', 'There are no previously served queues to recall.');
      } else {
        showError('Error', error.message);
      }
    } finally {
      setActionLoading(prev => ({ ...prev, previous: false }));
    }
  };

  const handleTransfer = async () => {
    if (!windowData) {
      showError('Error', 'Window data not available');
      return;
    }

    if (!isQueueingEnabled) {
      showWarning('Queue Management Disabled', 'Queue management is currently off. Please enable queueing in Settings to manage queues.');
      return;
    }

    if (currentServing === 0) {
      showWarning('No Queue', 'No queue currently being served');
      return;
    }

    // Fetch available windows for transfer
    try {
      setTransferLoading(true);
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/public/queue/windows/${windowData.office}`);
      const result = await response.json();

      if (response.ok && result.success) {
        // Filter out current window
        const otherWindows = result.data.filter(window => window.id !== windowData.id);

        if (otherWindows.length === 0) {
          showWarning('No Windows', 'No other windows available for transfer');
          return;
        }

        setAvailableWindows(otherWindows);
        setSelectedWindow(null); // Reset selected window
        setShowTransferModal(true);
      } else {
        throw new Error(result.error || 'Failed to fetch available windows');
      }
    } catch (error) {
      console.error('❌ Transfer fetch error:', error);
      showError('Error', error.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleTransferConfirm = async () => {
    if (!windowData || !selectedWindow) return;

    setActionLoading(prev => ({ ...prev, transfer: true }));

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/public/queue/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fromWindowId: windowData.id,
          toWindowId: selectedWindow.id,
          adminId: user?.id || '507f1f77bcf86cd799439011' // Valid ObjectId for development
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Clear current serving since queue was transferred
        setCurrentServing(0);
        setCurrentServingPerson(null);

        // Refresh queue data
        fetchQueueData();

        setShowTransferModal(false);
        setSelectedWindow(null);
        showSuccess(
          'Queue Transferred',
          `Queue ${String(result.data.queueNumber).padStart(2, '0')} transferred to ${result.data.toWindowName} and placed in waiting queue`
        );

        // console.log('✅ Queue transferred:', result.data);
      } else {
        throw new Error(result.error || 'Failed to transfer queue');
      }
    } catch (error) {
      console.error('❌ Transfer queue error:', error);
      showError('Error', error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, transfer: false }));
    }
  };

  const handleSkip = async () => {
    if (!windowData) {
      showError('Error', 'Window data not available');
      return;
    }

    if (!isQueueingEnabled) {
      showWarning('Queue Management Disabled', 'Queue management is currently off. Please enable queueing in Settings to manage queues.');
      return;
    }

    if (currentServing === 0) {
      showWarning('No Queue', 'No queue currently being served');
      return;
    }

    setActionLoading(prev => ({ ...prev, skip: true }));

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/public/queue/skip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          windowId: windowData.id,
          adminId: user?.id || '507f1f77bcf86cd799439011' // Valid ObjectId for development
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update local state
        if (result.data.nextQueue) {
          setCurrentServing(result.data.nextQueue.queueNumber);
          setCurrentServingPerson({
            name: result.data.nextQueue.customerName,
            role: 'Customer',
            purpose: windowData.serviceName || 'General Service'
          });

          // Trigger text-to-speech announcement for next queue
          if (textToSpeechService.isReady()) {
            await textToSpeechService.announceQueueNumber(
              result.data.nextQueue.queueNumber,
              result.data.windowName
            );
          }
        } else {
          // No next queue available
          setCurrentServing(0);
          setCurrentServingPerson(null);
        }

        // Refresh queue data to update skipped queue list
        fetchQueueData();

        showInfo(
          'Queue Skipped',
          `Queue ${String(result.data.skippedQueue.queueNumber).padStart(2, '0')} has been skipped${
            result.data.nextQueue ? `, calling queue ${String(result.data.nextQueue.queueNumber).padStart(2, '0')}` : ''
          }`
        );

        // console.log('✅ Queue skipped:', result.data);
      } else {
        throw new Error(result.error || 'Failed to skip queue');
      }
    } catch (error) {
      console.error('❌ Skip queue error:', error);
      showError('Error', error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, skip: false }));
    }
  };

  // Toggle selection of a skipped queue number
  const handleToggleSkippedQueue = (queueNumber) => {
    setSelectedSkippedQueues(prev => {
      if (prev.includes(queueNumber)) {
        // Deselect if already selected
        return prev.filter(num => num !== queueNumber);
      } else {
        // Select if not already selected
        return [...prev, queueNumber];
      }
    });
  };

  // Handle requeue - either all or selected based on selection state
  const handleRequeue = async () => {
    if (!windowData) {
      showError('Error', 'Window data not available');
      return;
    }

    if (skippedQueue.length === 0) {
      showWarning('No Skipped Queues', 'No skipped queues to re-queue');
      return;
    }

    // Determine if we're requeuing all or selected
    const isRequeueSelected = selectedSkippedQueues.length > 0;
    const endpoint = isRequeueSelected ? '/api/public/queue/requeue-selected' : '/api/public/queue/requeue-all';
    const requestBody = {
      windowId: windowData.id,
      adminId: user?.id || '507f1f77bcf86cd799439011'
    };

    // Add queueNumbers if requeuing selected
    if (isRequeueSelected) {
      requestBody.queueNumbers = selectedSkippedQueues;
    }

    setActionLoading(prev => ({ ...prev, requeueAll: true }));

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Clear selection after successful requeue
        setSelectedSkippedQueues([]);

        // Refresh queue data to update waiting and skipped queue lists
        fetchQueueData();

        showSuccess(
          'Queues Re-queued',
          `${result.data.requeuedCount} queue${result.data.requeuedCount > 1 ? 's' : ''} re-queued successfully`
        );

        // console.log('✅ Queues re-queued:', result.data);
      } else {
        throw new Error(result.error || 'Failed to re-queue queues');
      }
    } catch (error) {
      console.error('❌ Re-queue error:', error);
      showError('Error', error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, requeueAll: false }));
    }
  };

  // Legacy function for backward compatibility (now calls handleRequeue)
  const handleRequeueAll = handleRequeue;

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <div className="flex items-center justify-center h-40 sm:h-48 md:h-52">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-[#1F3463] mx-auto mb-2 sm:mb-3"></div>
            <p className="text-sm sm:text-base text-gray-600">Loading window data...</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Window ID: {windowId}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!windowData) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <div className="flex items-center justify-center h-40 sm:h-48 md:h-52">
          <div className="text-center px-3">
            <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🪟</div>
            <p className="text-sm sm:text-base text-red-600 mb-1 sm:mb-1.5">Window not found</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3">The requested window does not exist or may have been removed.</p>
            <p className="text-[9px] sm:text-[10px] text-gray-400 mb-3 sm:mb-4 md:mb-5">Window ID: {windowId}</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-3 justify-center">
              <button
                onClick={() => window.location.href = '/admin/registrar/queue'}
                className="px-3 py-1.5 text-xs sm:text-sm bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors"
              >
                Back to Queue
              </button>
              <button
                onClick={() => window.location.href = '/admin/registrar/settings'}
                className="px-3 py-1.5 text-xs sm:text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Manage Windows
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-3 sm:space-y-4 md:space-y-5" data-testid="queue-management">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2 sm:gap-2.5 md:gap-3">
        {/* Left side: Manage Queueing and Window name stacked */}
        <div className="flex flex-col">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1F3463] tracking-tight">Manage Queueing</h1>
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-[#1F3463] tracking-wide">
            {windowData.name.toUpperCase()} QUEUE
          </h1>
        </div>
        {/* Right side: Warning banner when queue is disabled */}
        <div className="flex justify-start lg:justify-end w-full lg:w-auto">
          {!isQueueingEnabled && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-2.5 flex items-center space-x-1 sm:space-x-1.5 max-w-md">
              <div className="flex-shrink-0">
                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-[9px] sm:text-[10px] font-medium text-yellow-800">Queue Management Disabled</h3>
                <p className="text-[9px] sm:text-[10px] text-yellow-700">
                  Queue management is currently off. Please enable queueing in Settings to manage queues.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Control Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5 min-h-[20rem] lg:h-[29rem]">
        {/* Current Serving */}
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-5">
          <div className="h-full flex flex-col justify-center space-y-2 sm:space-y-2.5 md:space-y-3">
            <div className="text-center">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#1F3463] tracking-wide">CURRENT SERVING</h2>
            </div>
            <div className="text-center space-y-1 sm:space-y-1.5 md:space-y-2">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Queue Number</p>
              <div className="flex justify-center">
                <div className="bg-[#1F3463] text-white rounded-2xl sm:rounded-3xl px-12 sm:px-16 md:px-[72px] py-6 sm:py-8 md:py-[32px] shadow-md">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-wider">
                    {String(currentServing).padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
            {currentServingPerson ? (
              <>
                <div className="text-center">
                  <p className="text-base sm:text-lg font-extrabold text-[#1F3463] tracking-wide">{currentServingPerson.role}</p>
                </div>
                <div className="text-center space-y-0">
                  <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase tracking-widest">Name</p>
                  <p className="text-base sm:text-lg font-bold text-[#1F3463]">{currentServingPerson.name}</p>
                </div>
                <div className="text-center space-y-0">
                  <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase tracking-widest">Purpose</p>
                  <p className="text-base sm:text-lg font-semibold text-gray-800">{currentServingPerson.purpose}</p>
                </div>
                {/* Display Transaction No. for all windows */}
                {currentServingPerson.transactionNo && (
                  <div className="text-center space-y-0">
                    <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase tracking-widest">Transaction No.</p>
                    <p className="text-base sm:text-lg font-bold text-[#1F3463] tracking-wide">{currentServingPerson.transactionNo}</p>
                  </div>
                )}
                {/* Display ID Number for Priority windows */}
                {windowData?.name === 'Priority' && currentServingPerson.idNumber && (
                  <div className="text-center space-y-0">
                    <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase tracking-widest">ID Number</p>
                    <p className="text-base sm:text-lg font-bold text-[#1F3463] tracking-wide">{currentServingPerson.idNumber}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center">
                <p className="text-xs sm:text-sm text-gray-400 italic">No one currently being served</p>
              </div>
            )}
          </div>
        </div>

        {/* Incoming Queue */}
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-5">
          <div className="h-full flex flex-col">
            <div className="grid grid-cols-2 gap-1 sm:gap-1.5 mb-2 sm:mb-3">
              {/* Row 1: Incoming heading spanning full width */}
              <div className="col-span-2 text-center">
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-[#1F3463] tracking-wide">INCOMING</h3>
              </div>

              {/* Row 2: Empty left column and timestamp/refresh button on right */}
              <div></div>
              <div className="flex items-center justify-end">
                <div className="flex items-center space-x-0.5 sm:space-x-1">
                  <p className="text-[7px] sm:text-[8px] text-gray-500 uppercase tracking-wide">
                    As of {formatRefreshTime(lastRefreshTime)}
                  </p>
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="p-0.5 transition-colors duration-200 hover:bg-gray-300 rounded"
                    title="Refresh queue data"
                  >
                    <IoMdRefresh
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2 sm:space-y-2.5 max-h-[18rem] sm:max-h-[20rem] lg:max-h-[22rem]">
                {queueData.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex gap-2 sm:gap-2.5 p-2 sm:p-2.5 bg-gray-50 rounded-lg shadow-sm">
                    <div className="flex-shrink-0">
                      <div className="bg-[#1F3463] text-white rounded-lg px-2 sm:px-3 py-1.5 sm:py-2.5 text-center min-w-[40px] sm:min-w-[48px]">
                        <span className="text-base sm:text-lg font-bold tracking-wide">
                          {String(item.number).padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center space-y-0.5 sm:space-y-1">
                      <div>
                        <p className="text-sm sm:text-base md:text-lg font-bold text-[#1F3463] truncate">
                          {item.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-600">
                          {item.role}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {queueData.length === 0 && (
                  <div className="text-center text-gray-400 italic py-4 sm:py-6 text-xs sm:text-sm">
                    No incoming queue entries
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-2 sm:gap-2.5 md:gap-3">
          <motion.button
            onClick={handleStop}
            disabled={actionLoading.stop}
            className={`flex-1 rounded-full border-2 font-bold text-sm sm:text-base md:text-lg tracking-wide transition-colors duration-200 min-h-[36px] sm:min-h-[40px] flex items-center justify-center ${
              isWindowServing
                ? 'border-[#1F3463] text-[#1F3463] hover:bg-[#1F3463] hover:text-white'
                : 'border-green-500 text-green-500 hover:bg-green-500 hover:text-white'
            } ${actionLoading.stop ? 'bg-gray-400 text-gray-600 border-gray-400 cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:text-gray-600 disabled:hover:border-gray-400' : ''}`}
            data-testid="stop-button"
            whileHover={!actionLoading.stop ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
            whileTap={!actionLoading.stop ? { scale: 0.92, transition: { duration: 0.15 } } : undefined}
          >
            {actionLoading.stop ? 'Loading...' : (isWindowServing ? 'STOP' : 'RESUME')}
          </motion.button>
          <motion.button
            onClick={handleNext}
            disabled={actionLoading.next || !isQueueingEnabled}
            className={`flex-1 rounded-full bg-[#1F3463] text-white font-bold text-sm sm:text-base md:text-lg tracking-wide hover:bg-[#1A2E56] transition-colors duration-200 min-h-[36px] sm:min-h-[40px] flex items-center justify-center ${
              (actionLoading.next || !isQueueingEnabled) ? 'bg-gray-400 text-gray-600 cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:text-gray-600' : ''
            }`}
            data-testid="call-next-button"
            whileHover={!(actionLoading.next || !isQueueingEnabled) ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
            whileTap={!(actionLoading.next || !isQueueingEnabled) ? { scale: 0.92, transition: { duration: 0.15 } } : undefined}
          >
            {actionLoading.next ? 'Calling...' : 'NEXT'}
          </motion.button>
          <motion.button
            onClick={handleRecall}
            disabled={actionLoading.recall || !isQueueingEnabled}
            className={`flex-1 rounded-full bg-[#1F3463] text-white font-bold text-sm sm:text-base md:text-lg tracking-wide hover:bg-[#1A2E56] transition-colors duration-200 min-h-[36px] sm:min-h-[40px] flex items-center justify-center ${
              (actionLoading.recall || !isQueueingEnabled) ? 'bg-gray-400 text-gray-600 cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:text-gray-600' : ''
            }`}
            whileHover={!(actionLoading.recall || !isQueueingEnabled) ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
            whileTap={!(actionLoading.recall || !isQueueingEnabled) ? { scale: 0.92, transition: { duration: 0.15 } } : undefined}
          >
            {actionLoading.recall ? 'Recalling...' : 'RECALL'}
          </motion.button>
          <motion.button
            onClick={handlePrevious}
            disabled={actionLoading.previous || !isQueueingEnabled}
            className={`flex-1 rounded-full bg-[#1F3463] text-white font-bold text-sm sm:text-base md:text-lg tracking-wide hover:bg-[#1A2E56] transition-colors duration-200 min-h-[36px] sm:min-h-[40px] flex items-center justify-center ${
              (actionLoading.previous || !isQueueingEnabled) ? 'bg-gray-400 text-gray-600 cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:text-gray-600' : ''
            }`}
            whileHover={!(actionLoading.previous || !isQueueingEnabled) ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
            whileTap={!(actionLoading.previous || !isQueueingEnabled) ? { scale: 0.92, transition: { duration: 0.15 } } : undefined}
          >
            {actionLoading.previous ? 'Loading...' : 'PREVIOUS'}
          </motion.button>
          <motion.button
            onClick={handleTransfer}
            disabled={actionLoading.transfer || transferLoading || !isQueueingEnabled}
            className={`flex-1 rounded-full bg-[#1F3463] text-white font-bold text-sm sm:text-base md:text-lg tracking-wide hover:bg-[#1A2E56] transition-colors duration-200 min-h-[36px] sm:min-h-[40px] flex items-center justify-center ${
              (actionLoading.transfer || transferLoading || !isQueueingEnabled) ? 'bg-gray-400 text-gray-600 cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:text-gray-600' : ''
            }`}
            whileHover={!(actionLoading.transfer || transferLoading || !isQueueingEnabled) ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
            whileTap={!(actionLoading.transfer || transferLoading || !isQueueingEnabled) ? { scale: 0.92, transition: { duration: 0.15 } } : undefined}
          >
            {(actionLoading.transfer || transferLoading) ? 'Loading...' : 'TRANSFER'}
          </motion.button>
          <motion.button
            onClick={handleSkip}
            disabled={actionLoading.skip || !isQueueingEnabled}
            className={`flex-1 rounded-full bg-[#1F3463] text-white font-bold text-sm sm:text-base md:text-lg tracking-wide hover:bg-[#1A2E56] transition-colors duration-200 min-h-[36px] sm:min-h-[40px] flex items-center justify-center ${
              (actionLoading.skip || !isQueueingEnabled) ? 'bg-gray-400 text-gray-600 cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:text-gray-600' : ''
            }`}
            data-testid="skip-button"
            whileHover={!(actionLoading.skip || !isQueueingEnabled) ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
            whileTap={!(actionLoading.skip || !isQueueingEnabled) ? { scale: 0.92, transition: { duration: 0.15 } } : undefined}
          >
            {actionLoading.skip ? 'Skipping...' : 'SKIP'}
          </motion.button>
        </div>
      </div>

      {/* Skipped Queue Section */}
      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-5 w-full sm:w-auto">
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-700 tracking-wide">SKIPPED</h3>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-2.5 w-full sm:w-auto">
              {skippedQueue.map((number, index) => {
                const isSelected = selectedSkippedQueues.includes(number);
                return (
                  <button
                    key={index}
                    onClick={() => handleToggleSkippedQueue(number)}
                    className={`rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 shadow-md transition-all duration-200 ${
                      isSelected
                        ? 'bg-[#FFE251] text-[#1F3463] ring-2 ring-[#1F3463] ring-offset-2'
                        : 'bg-[#1F3463] text-white hover:bg-[#1A2E56]'
                    }`}
                  >
                    <span className="text-sm sm:text-base md:text-lg font-bold tracking-wide">
                      {String(number).padStart(2, '0')}
                    </span>
                  </button>
                );
              })}
              {skippedQueue.length === 0 && (
                <div className="text-gray-400 italic text-xs sm:text-sm">No skipped queue numbers</div>
              )}
            </div>
          </div>

          {/* RE-QUEUE Button - Dynamic text based on selection */}
          {skippedQueue.length > 0 && (
            <button
              onClick={handleRequeue}
              disabled={actionLoading.requeueAll}
              className={`w-full sm:w-auto rounded-full bg-[#1F3463] text-white font-bold text-xs sm:text-sm tracking-wide px-4 sm:px-6 py-2 sm:py-2.5 hover:bg-[#1A2E56] transition-colors duration-200 flex items-center justify-center min-w-[120px] sm:min-w-[140px] ${
                actionLoading.requeueAll ? 'bg-gray-400 text-gray-600 cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:text-gray-600' : ''
              }`}
            >
              {actionLoading.requeueAll
                ? 'Re-queuing...'
                : selectedSkippedQueues.length > 0
                  ? `RE-QUEUE (${selectedSkippedQueues.length})`
                  : 'RE-QUEUE ALL'}
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Transfer Modal */}
    {showTransferModal && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
          onClick={() => {
            setShowTransferModal(false);
            setSelectedWindow(null);
          }}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
          <div
            className="relative bg-white rounded-xl shadow-2xl p-4 sm:p-5 md:p-6 max-w-md w-full transform transition-all duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Close Button */}
          <button
            onClick={() => {
              setShowTransferModal(false);
              setSelectedWindow(null);
            }}
            className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
          >
            <MdClose className="w-3 h-3" />
          </button>

          <h3 className="text-lg sm:text-xl font-bold text-[#1F3463] mb-1 sm:mb-1.5 tracking-wide">
            Transfer Queue {String(currentServing).padStart(2, '0')}
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4 md:mb-5">
            Select the window to transfer this queue to:
          </p>

          <div className="space-y-2 sm:space-y-2.5 mb-3 sm:mb-4 md:mb-5">
            {availableWindows.map((window) => (
              <button
                key={window.id}
                onClick={() => setSelectedWindow(window)}
                disabled={actionLoading.transfer}
                className={`w-full p-2.5 sm:p-3 text-left border-2 rounded-lg transition-colors duration-200 disabled:bg-gray-400 disabled:text-gray-600 disabled:border-gray-400 disabled:cursor-not-allowed ${
                  selectedWindow?.id === window.id
                    ? 'border-[#1F3463] bg-[#1F3463]/10'
                    : 'border-gray-300 hover:bg-gray-50 hover:border-[#1F3463]'
                }`}
              >
                <div className="font-bold text-sm sm:text-base text-gray-900">{window.name}</div>
                <div className="text-xs sm:text-sm text-gray-500">{window.serviceName}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2.5">
            <button
              onClick={() => {
                setShowTransferModal(false);
                setSelectedWindow(null);
              }}
              disabled={actionLoading.transfer}
              className="w-full sm:flex-1 px-4 sm:px-5 py-2 sm:py-2.5 border-2 border-gray-300 text-gray-700 font-semibold text-xs sm:text-sm rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:bg-gray-400 disabled:text-gray-600 disabled:border-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:text-gray-600 disabled:hover:border-gray-400 order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={handleTransferConfirm}
              disabled={actionLoading.transfer || !selectedWindow}
              className="w-full sm:flex-1 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#3930A8] text-white font-semibold text-xs sm:text-sm rounded-lg hover:bg-[#2F2580] transition-colors duration-200 disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:text-gray-600 order-1 sm:order-2"
            >
              {actionLoading.transfer ? 'Transferring...' : 'Transfer'}
            </button>
          </div>
          </div>
        </div>
      </div>
    )}

    {/* Toast Container for Queue page notifications */}
    <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </>
  );
};

export default Queue;

