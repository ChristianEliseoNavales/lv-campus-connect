import { useState } from 'react';
import { authFetch } from '../../../../utils/apiClient';

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

  const checkUsers = async () => {
    setChecking(true);
    setResult(null);
    try {
      const response = await authFetch('/api/fix-users/check');
      setUsersToFix(response);
    } catch (error) {
      console.error('Error checking users:', error);
      setResult({
        success: false,
        message: 'Failed to check users: ' + error.message
      });
    } finally {
      setChecking(false);
    }
  };

  const fixUsers = async () => {
    if (!confirm('Are you sure you want to fix all users with empty pageAccess? This will automatically assign default pageAccess based on their roles.')) {
      return;
    }

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
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-[#1F3463] mb-2">
          Fix User PageAccess
        </h1>
        <p className="text-gray-600 mb-6">
          This tool fixes users who have empty pageAccess arrays by automatically assigning default access based on their roles.
        </p>

        {/* Check Users Section */}
        <div className="mb-6">
          <button
            onClick={checkUsers}
            disabled={checking}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {checking ? 'Checking...' : 'Check Users Needing Fix'}
          </button>
        </div>

        {/* Users to Fix */}
        {usersToFix && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">
              Users Needing Fix: {usersToFix.count}
            </h2>
            {usersToFix.count === 0 ? (
              <p className="text-green-600 font-medium">
                ✅ All users already have pageAccess configured!
              </p>
            ) : (
              <div className="space-y-2">
                {usersToFix.users.map((user, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-gray-200">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                    <div className="text-sm text-gray-500">
                      Role: {user.role} | Office: {user.office}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fix Users Button */}
        {usersToFix && usersToFix.count > 0 && (
          <div className="mb-6">
            <button
              onClick={fixUsers}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Fixing Users...' : `Fix ${usersToFix.count} Users`}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h3 className={`font-semibold mb-2 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? '✅ Success!' : '❌ Error'}
            </h3>
            <p className={result.success ? 'text-green-700' : 'text-red-700'}>
              {result.message}
            </p>
            {result.success && result.usersFixed > 0 && (
              <div className="mt-3 text-sm text-green-700">
                <p>Users fixed: {result.usersFixed}</p>
                <p>Users skipped: {result.usersSkipped}</p>
              </div>
            )}
            {result.details && result.details.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Details:</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.details.map((detail, index) => (
                    <div key={index} className="text-sm bg-white p-2 rounded">
                      <div className="font-medium">{detail.user}</div>
                      <div className={detail.status === 'updated' ? 'text-green-600' : 'text-yellow-600'}>
                        Status: {detail.status}
                      </div>
                      {detail.pageAccess && (
                        <div className="text-gray-600 text-xs mt-1">
                          Access: {detail.pageAccess.join(', ')}
                        </div>
                      )}
                      {detail.reason && (
                        <div className="text-gray-600 text-xs mt-1">
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
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
            <li>Click "Check Users Needing Fix" to see which users have empty pageAccess</li>
            <li>Review the list of users that will be fixed</li>
            <li>Click "Fix Users" to automatically assign default pageAccess to all users</li>
            <li>Ask affected users to logout and login again</li>
            <li>Verify that they can now access their pages without 403 errors</li>
          </ol>
        </div>

        {/* Warning */}
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Note:</h3>
          <p className="text-sm text-yellow-700">
            This is a one-time fix tool. After fixing all users, this page can be removed from the system.
            The backend code has been updated to automatically assign default pageAccess for all new users and updates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FixUsers;

