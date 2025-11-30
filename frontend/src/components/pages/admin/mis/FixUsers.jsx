import { useState } from 'react';
import { authFetch } from '../../../../utils/apiClient';
import { ConfirmModal } from '../../../ui';

/**
 * Temporary Component: Fix User PageAccess
 *
 * This component provides a UI to fix all users with empty pageAccess.
 * Should be removed after fixing all users.
 */
const FixUsers = () => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [usersToFix, setUsersToFix] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const checkUsers = async () => {
    setChecking(true);
    setResult(null);
    setUsersToFix(null);
    try {
      const response = await authFetch('/api/fix-users/check');
      console.log('Check users response:', response);

      // Ensure response has the expected structure
      if (response && typeof response === 'object') {
        setUsersToFix({
          count: response.count || 0,
          users: response.users || []
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error checking users:', error);
      setResult({
        success: false,
        message: 'Failed to check users: ' + (error.message || 'Unknown error')
      });
      setUsersToFix(null);
    } finally {
      setChecking(false);
    }
  };

  const performFixUsers = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await authFetch('/api/fix-users/page-access', {
        method: 'POST'
      });
      setResult(response);
      // Refresh the check after fixing
      if (response.success) {
        setTimeout(() => checkUsers(), 1000);
      }
    } catch (error) {
      console.error('Error fixing users:', error);
      setResult({
        success: false,
        message: 'Failed to fix users: ' + error.message
      });
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
    }
  };

  const handleFixUsersClick = () => {
    setShowConfirmModal(true);
  };

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-5">
        <h1 className="text-xl font-bold text-[#1F3463] mb-1.5">
          Fix User PageAccess
        </h1>
        <p className="text-gray-600 mb-5 text-sm">
          This tool fixes users who have empty pageAccess arrays by automatically assigning default access based on their roles.
        </p>

        {/* Check Users Section */}
        <div className="mb-5">
          <button
            onClick={checkUsers}
            disabled={checking}
            className="bg-blue-600 text-white px-5 py-1.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400 text-sm"
          >
            {checking ? 'Checking...' : 'Check Users Needing Fix'}
          </button>
        </div>

        {/* Users to Fix */}
        {usersToFix && (
          <div className="mb-5 p-3 bg-gray-50 rounded-lg">
            <h2 className="text-base font-semibold mb-2.5">
              Users Needing Fix: {usersToFix.count || 0}
            </h2>
            {usersToFix.count === 0 ? (
              <p className="text-green-600 font-medium text-sm">
                ✅ All users already have pageAccess configured!
              </p>
            ) : (
              <div className="space-y-1.5">
                {usersToFix.users && usersToFix.users.length > 0 ? (
                  usersToFix.users.map((user, index) => (
                    <div key={index} className="bg-white p-2.5 rounded border border-gray-200">
                      <div className="font-medium text-sm">{user.name}</div>
                      <div className="text-xs text-gray-600">{user.email}</div>
                      <div className="text-xs text-gray-500">
                        Role: {user.role} | Office: {user.office}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 text-sm">No users found.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Fix Users Button */}
        {usersToFix && usersToFix.count > 0 && (
          <div className="mb-5">
            <button
              onClick={handleFixUsersClick}
              disabled={loading}
              className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400 font-medium text-sm"
            >
              {loading ? 'Fixing Users...' : `Fix ${usersToFix.count} Users`}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`p-3 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h3 className={`font-semibold mb-1.5 text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? '✅ Success!' : '❌ Error'}
            </h3>
            <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.message}
            </p>
            {result.success && result.usersFixed > 0 && (
              <div className="mt-2.5 text-xs text-green-700">
                <p>Users fixed: {result.usersFixed}</p>
                <p>Users skipped: {result.usersSkipped}</p>
              </div>
            )}
            {result.details && result.details.length > 0 && (
              <div className="mt-3">
                <h4 className="font-medium mb-1.5 text-sm">Details:</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {result.details.map((detail, index) => (
                    <div key={index} className="text-xs bg-white p-1.5 rounded">
                      <div className="font-medium">{detail.user}</div>
                      <div className={detail.status === 'updated' ? 'text-green-600' : 'text-yellow-600'}>
                        Status: {detail.status}
                      </div>
                      {detail.pageAccess && (
                        <div className="text-gray-600 text-[10px] mt-1">
                          Access: {detail.pageAccess.join(', ')}
                        </div>
                      )}
                      {detail.reason && (
                        <div className="text-gray-600 text-[10px] mt-1">
                          Reason: {detail.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-1.5 text-sm">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
            <li>Click "Check Users Needing Fix" to see which users have empty pageAccess</li>
            <li>Review the list of users that will be fixed</li>
            <li>Click "Fix Users" to automatically assign default pageAccess to all users</li>
            <li>Ask affected users to logout and login again</li>
            <li>Verify that they can now access their pages without 403 errors</li>
          </ol>
        </div>

        {/* Warning */}
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-1.5 text-sm">⚠️ Note:</h3>
          <p className="text-xs text-yellow-700">
            This is a one-time fix tool. After fixing all users, this page can be removed from the system.
            The backend code has been updated to automatically assign default pageAccess for all new users and updates.
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={performFixUsers}
        title="Fix User PageAccess"
        message="Are you sure you want to fix all users with empty pageAccess? This will automatically assign default pageAccess based on their roles."
        confirmText="Fix Users"
        type="warning"
      />
    </div>
  );
};

export default FixUsers;

