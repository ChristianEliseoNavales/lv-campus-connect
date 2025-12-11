import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import ForceLogoutModal from '../ui/ForceLogoutModal';

/**
 * SessionManager component that listens for force-logout events
 * and manages the logout modal. Must be placed inside both AuthProvider
 * and SocketProvider.
 */
const SessionManager = () => {
  const { subscribe } = useSocket();
  const { signOut } = useAuth();
  const [forceLogoutReason, setForceLogoutReason] = React.useState(null);
  const [showForceLogoutModal, setShowForceLogoutModal] = React.useState(false);

  // Listen for force-logout events
  useEffect(() => {
    if (!subscribe) return;

    const unsubscribe = subscribe('force-logout', (data) => {
      const reason = data.reason || 'Your session has been invalidated. Please log in again.';
      setForceLogoutReason(reason);
      setShowForceLogoutModal(true);
    });

    return unsubscribe;
  }, [subscribe]);

  // Handle force logout
  const handleForceLogout = async () => {
    await signOut();
    setShowForceLogoutModal(false);
    setForceLogoutReason(null);
  };

  return (
    <ForceLogoutModal
      isOpen={showForceLogoutModal}
      reason={forceLogoutReason}
      onLogout={handleForceLogout}
    />
  );
};

export default SessionManager;

