import { useState, useEffect } from 'react';

const useGoogleAuth = () => {
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load Google Identity Services script
    const loadGoogleScript = () => {
      if (window.google) {
        setIsGoogleLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsGoogleLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load Google Identity Services');
      };
      document.head.appendChild(script);
    };

    loadGoogleScript();
  }, []);

  const signInWithGoogle = () => {
    return new Promise((resolve, reject) => {
      if (!window.google || !isGoogleLoaded) {
        reject(new Error('Google Identity Services not loaded. Please refresh the page and try again.'));
        return;
      }

      setIsLoading(true);

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (!clientId || clientId === 'your_google_client_id_here') {
        reject(new Error('Google Client ID not configured. Please contact the administrator.'));
        setIsLoading(false);
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            setIsLoading(false);

            if (response.credential) {
              resolve(response.credential);
            } else if (response.error) {
              reject(new Error(`Google sign-in failed: ${response.error}`));
            } else {
              reject(new Error('No credential received from Google. Please try again.'));
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: false
        });

        // Prompt the user to sign in
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Try alternative sign-in method with button
            const buttonElement = document.getElementById('google-signin-button');
            if (buttonElement) {
              window.google.accounts.id.renderButton(buttonElement, {
                theme: 'outline',
                size: 'large',
                width: 300,
                text: 'signin_with'
              });
            } else {
              setIsLoading(false);
              reject(new Error('Google sign-in button not found. Please refresh the page.'));
            }
          }
        });
      } catch (error) {
        setIsLoading(false);
        console.error('Google initialization error:', error);
        reject(new Error(`Failed to initialize Google sign-in: ${error.message}`));
      }
    });
  };

  const signOut = () => {
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  return {
    isGoogleLoaded,
    isLoading,
    signInWithGoogle,
    signOut
  };
};

export default useGoogleAuth;
