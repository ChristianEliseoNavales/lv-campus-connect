import React, { useState, useEffect, useRef } from 'react';
import { FaChevronDown, FaArrowUp } from 'react-icons/fa';

// TEMPORARY TESTING FEATURE: Physical keyboard input enabled alongside virtual keyboard
// TODO: Remove physical keyboard input before production deployment - for development/testing only

// Holographic Overlay Keyboard Component - Optimized for Kiosk Touchscreen
const HolographicKeyboard = ({
  onKeyPress,
  onBackspace,
  onSpace,
  onEnter,
  onHide,
  isVisible,
  activeInputValue = '',
  activeInputLabel = '',
  activeInputPlaceholder = '',
  // New props for visitation form multi-field display
  showAllFields = false,
  allFieldsData = null,
  activeFieldName = '',
  onFieldFocus = null,
  // Navigation button props for form steps
  showNavigationButtons = false,
  navigationButtons = null,
  // Validation error props
  formErrors = {},
  activeInputError = ''
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const keyboardRef = useRef(null);
  const overlayRef = useRef(null);

  // Helper function to calculate cursor position based on text content
  const calculateCursorPosition = (text, fontSize = '20px', fontFamily = 'SF Pro Rounded, ui-rounded, system-ui, sans-serif') => {
    // Create a temporary canvas element to measure text width
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontSize} ${fontFamily}`;

    // Measure the width of the text
    const textWidth = context.measureText(text || '').width;

    // Add padding (16px = px-4 in Tailwind) and return position
    return textWidth + 16; // 16px for left padding
  };

  // Handle shift key toggle
  const handleShiftToggle = () => {
    setIsShiftActive(!isShiftActive);
  };

  // Handle key press with shift consideration
  const handleKeyPress = (keyData) => {
    const value = isShiftActive ? keyData.shift : keyData.normal;
    onKeyPress(value);
    // Auto-release shift after key press (standard keyboard behavior)
    if (isShiftActive) {
      setIsShiftActive(false);
    }
  };

  // Standard QWERTY keyboard layout with shift functionality
  const numberRowKeys = [
    { normal: '1', shift: '!' },
    { normal: '2', shift: '@' },
    { normal: '3', shift: '#' },
    { normal: '4', shift: '$' },
    { normal: '5', shift: '%' },
    { normal: '6', shift: '^' },
    { normal: '7', shift: '&' },
    { normal: '8', shift: '*' },
    { normal: '9', shift: '(' },
    { normal: '0', shift: ')' }
  ];

  const keyboardRows = [
    // First row with standard punctuation
    [
      { normal: 'q', shift: 'Q' },
      { normal: 'w', shift: 'W' },
      { normal: 'e', shift: 'E' },
      { normal: 'r', shift: 'R' },
      { normal: 't', shift: 'T' },
      { normal: 'y', shift: 'Y' },
      { normal: 'u', shift: 'U' },
      { normal: 'i', shift: 'I' },
      { normal: 'o', shift: 'O' },
      { normal: 'p', shift: 'P' },
      { normal: '[', shift: '{' },
      { normal: ']', shift: '}' }
    ],
    // Second row
    [
      { normal: 'a', shift: 'A' },
      { normal: 's', shift: 'S' },
      { normal: 'd', shift: 'D' },
      { normal: 'f', shift: 'F' },
      { normal: 'g', shift: 'G' },
      { normal: 'h', shift: 'H' },
      { normal: 'j', shift: 'J' },
      { normal: 'k', shift: 'K' },
      { normal: 'l', shift: 'L' },
      { normal: ';', shift: ':' },
      { normal: "'", shift: '"' }
    ],
    // Third row
    [
      { normal: 'z', shift: 'Z' },
      { normal: 'x', shift: 'X' },
      { normal: 'c', shift: 'C' },
      { normal: 'v', shift: 'V' },
      { normal: 'b', shift: 'B' },
      { normal: 'n', shift: 'N' },
      { normal: 'm', shift: 'M' },
      { normal: ',', shift: '<' },
      { normal: '.', shift: '>' },
      { normal: '/', shift: '?' }
    ]
  ];

  // Additional commonly needed characters for forms
  const additionalChars = [
    { normal: '-', shift: '_' },
    { normal: '=', shift: '+' }
  ];

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling

      if (overlayRef.current && keyboardRef.current) {
        overlayRef.current.classList.remove('kiosk-overlay-exit');
        overlayRef.current.classList.add('kiosk-overlay-enter');
        keyboardRef.current.classList.remove('kiosk-keyboard-exit');
        keyboardRef.current.classList.add('kiosk-keyboard-enter');
      }
    } else {
      document.body.style.overflow = 'auto'; // Restore scrolling

      if (overlayRef.current && keyboardRef.current) {
        overlayRef.current.classList.remove('kiosk-overlay-enter');
        overlayRef.current.classList.add('kiosk-overlay-exit');
        keyboardRef.current.classList.remove('kiosk-keyboard-enter');
        keyboardRef.current.classList.add('kiosk-keyboard-exit');
        setTimeout(() => setIsAnimating(false), 300);
      }
    }

    // Cleanup function to restore scrolling
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isVisible]);

  // TEMPORARY TESTING FEATURE: Physical keyboard event handling
  // TODO: Remove before production deployment - for development/testing only
  useEffect(() => {
    if (!isVisible) return;

    const handlePhysicalKeyDown = (event) => {
      // Prevent default behavior for handled keys
      const key = event.key;

      // Handle special keys
      if (key === 'Backspace') {
        event.preventDefault();
        onBackspace();
        return;
      }

      if (key === ' ' || key === 'Spacebar') {
        event.preventDefault();
        onSpace();
        return;
      }

      if (key === 'Enter') {
        event.preventDefault();
        // Handle Enter key if onEnter prop is provided (for ID verification step)
        if (typeof onEnter === 'function') {
          onEnter();
        }
        return;
      }

      if (key === 'Escape') {
        event.preventDefault();
        onHide();
        return;
      }

      // Handle regular character input
      if (key.length === 1) {
        event.preventDefault();

        // Check if it's a printable character (letters, numbers, symbols)
        const isLetter = /^[a-zA-Z]$/.test(key);
        const isNumber = /^[0-9]$/.test(key);
        const isSymbol = /^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]$/.test(key);

        if (isLetter || isNumber || isSymbol) {
          // Handle shift state for letters (physical keyboard shift is already applied)
          onKeyPress(key);
        }
      }
    };

    // Add physical keyboard event listener
    document.addEventListener('keydown', handlePhysicalKeyDown);

    return () => {
      document.removeEventListener('keydown', handlePhysicalKeyDown);
    };
  }, [isVisible, onKeyPress, onBackspace, onSpace, onHide, onEnter]);

  if (!isVisible && !isAnimating) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black bg-opacity-75 flex flex-col items-center justify-center font-kiosk-public"
      style={{ backdropFilter: 'blur(2px)' }}
    >
      {/* Input Field Display - Single or Multiple Fields */}
      <div className="mb-6 w-full max-w-4xl px-6 relative">
        {/* Form Container */}
        <div className="bg-white bg-opacity-90 backdrop-blur-sm rounded-xl p-5 shadow-2xl drop-shadow-2xl border border-white border-opacity-30">
          {showAllFields && allFieldsData ? (
            /* Multi-Field Display for Visitation Form */
            <div className="space-y-3">
              {allFieldsData.map((field) => (
                <div key={field.name}>
                  <label className="block text-base font-semibold text-gray-700 mb-1.5">
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={field.value}
                      placeholder={field.placeholder}
                      // TEMPORARY: readOnly removed for testing - restore for production
                      onClick={() => onFieldFocus && onFieldFocus(field.name)}
                      className={`w-full px-3 py-3 border-2 rounded-lg text-lg bg-white focus:outline-none shadow-inner cursor-pointer transition-all duration-150 ${
                        activeFieldName === field.name
                          ? 'border-[#1F3463] bg-blue-50'
                          : formErrors[field.name]
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 active:border-[#1F3463]'
                      }`}
                    />
                    {activeFieldName === field.name && (
                      <div
                        className="absolute top-1/2 transform -translate-y-1/2"
                        style={{ left: `${calculateCursorPosition(field.value, '18px')}px` }}
                      >
                        <div className="w-1 h-5 bg-[#1F3463] animate-pulse"></div>
                      </div>
                    )}
                  </div>
                  {/* Validation Error Message - Always visible when error exists */}
                  {formErrors[field.name] && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center">
                      <svg className="w-3 h-3 mr-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {formErrors[field.name]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Single Field Display for Other Forms */
            <div>
              {activeInputLabel && (
                <label className="block text-base font-semibold text-gray-700 mb-1.5">
                  {activeInputLabel}
                </label>
              )}
              <div className="relative">
                <input
                  type="text"
                  value={activeInputValue}
                  placeholder={activeInputPlaceholder}
                  // TEMPORARY: readOnly removed for testing - restore for production
                  className={`w-full px-3 py-3 border-2 rounded-lg text-lg bg-white focus:outline-none shadow-inner ${
                    activeInputError
                      ? 'border-red-500 bg-red-50'
                      : 'border-[#1F3463]'
                  }`}
                />
                <div
                  className="absolute top-1/2 transform -translate-y-1/2"
                  style={{ left: `${calculateCursorPosition(activeInputValue, '18px')}px` }}
                >
                  <div className="w-1 h-5 bg-[#1F3463] animate-pulse"></div>
                </div>
              </div>
              {/* Validation Error Message - Always visible when error exists */}
              {activeInputError && (
                <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center">
                  <svg className="w-3 h-3 mr-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {activeInputError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation Buttons - Positioned outside the form container */}
        {showNavigationButtons && navigationButtons && (
          <div className="absolute left-[calc(100%+0.8rem)] top-1/2 transform -translate-y-1/2 flex flex-col space-y-3">
            {navigationButtons.map((button, index) => (
              <button
                key={index}
                onClick={button.onClick}
                disabled={button.disabled}
                className={`w-20 h-20 rounded-full border-2 border-white font-bold text-xs transition-all duration-150 shadow-lg ${
                  button.disabled
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : button.variant === 'next'
                    ? 'bg-[#FFE251] text-[#1F3463] active:bg-[#FFD700] active:shadow-md active:scale-95'
                    : 'bg-[#1F3463] text-white active:bg-[#1A2E56] active:shadow-md active:scale-95'
                }`}
              >
                {button.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Holographic Keyboard */}
      <div
        ref={keyboardRef}
        className="bg-transparent rounded-xl p-5 max-w-5xl mx-auto"
      >
        {/* Number Row with Dynamic Shift Character Display */}
        <div className="flex justify-center gap-2.5 mb-3">
          {numberRowKeys.map((keyData, index) => (
            <button
              key={index}
              onClick={() => handleKeyPress(keyData)}
              className="w-16 h-12 bg-transparent border-2 border-white border-opacity-50 rounded-lg text-base font-bold text-white active:bg-white active:bg-opacity-20 active:border-opacity-80 active:scale-95 shadow-lg active:shadow-md transition-all duration-150 select-none flex flex-col items-center justify-center"
            >
              {/* Dynamic character display based on Shift state */}
              {isShiftActive ? (
                <>
                  {/* Shift active: Special character prominent, number secondary */}
                  <span className="text-[10px] opacity-60 transition-all duration-150">{keyData.normal}</span>
                  <span className="text-xl transition-all duration-150">{keyData.shift}</span>
                </>
              ) : (
                <>
                  {/* Shift inactive: Number prominent, special character secondary */}
                  <span className="text-[10px] opacity-75 transition-all duration-150">{keyData.shift}</span>
                  <span className="text-xl transition-all duration-150">{keyData.normal}</span>
                </>
              )}
            </button>
          ))}
          {/* Additional characters with dynamic display */}
          {additionalChars.map((keyData, index) => (
            <button
              key={`additional-${index}`}
              onClick={() => handleKeyPress(keyData)}
              className="w-16 h-12 bg-transparent border-2 border-white border-opacity-50 rounded-lg text-base font-bold text-white active:bg-white active:bg-opacity-20 active:border-opacity-80 active:scale-95 shadow-lg active:shadow-md transition-all duration-150 select-none flex flex-col items-center justify-center"
            >
              {/* Dynamic character display based on Shift state */}
              {isShiftActive ? (
                <>
                  {/* Shift active: Special character prominent, normal character secondary */}
                  <span className="text-[10px] opacity-60 transition-all duration-150">{keyData.normal}</span>
                  <span className="text-xl transition-all duration-150">{keyData.shift}</span>
                </>
              ) : (
                <>
                  {/* Shift inactive: Normal character prominent, special character secondary */}
                  <span className="text-[10px] opacity-75 transition-all duration-150">{keyData.shift}</span>
                  <span className="text-xl transition-all duration-150">{keyData.normal}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Letter Rows */}
        {keyboardRows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-2.5 mb-3">
            {/* Add Shift key to the third row (before letters) */}
            {rowIndex === 2 && (
              <button
                onClick={handleShiftToggle}
                className={`w-20 h-12 bg-transparent border-2 border-white border-opacity-50 rounded-lg text-xs font-bold text-white active:scale-95 shadow-lg transition-all duration-150 select-none flex items-center justify-center gap-0.5 ${
                  isShiftActive
                    ? 'bg-[#1F3463] bg-opacity-80 border-opacity-100'
                    : 'active:bg-white active:bg-opacity-20 active:border-opacity-80'
                }`}
              >
                <FaArrowUp className="w-2.5 h-2.5" />
                SHIFT
              </button>
            )}

            {row.map((keyData, keyIndex) => (
              <button
                key={keyIndex}
                onClick={() => handleKeyPress(keyData)}
                className="w-16 h-12 bg-transparent border-2 border-white border-opacity-50 rounded-lg text-xl font-bold text-white active:bg-white active:bg-opacity-20 active:border-opacity-80 active:scale-95 shadow-lg active:shadow-md transition-all duration-150 select-none"
              >
                {isShiftActive ? keyData.shift : keyData.normal}
              </button>
            ))}

            {/* Add backspace button to the third row (after letters) */}
            {rowIndex === 2 && (
              <button
                onClick={onBackspace}
                className="w-20 h-12 bg-transparent border-2 border-white border-opacity-50 rounded-lg text-xs font-bold text-white active:bg-white active:bg-opacity-20 active:border-opacity-80 active:scale-95 shadow-lg active:shadow-md transition-all duration-150 select-none"
              >
                ⌫ BACK
              </button>
            )}
          </div>
        ))}

        {/* Bottom Row with Spacebar */}
        <div className="flex justify-center gap-2.5 mb-3">
          {/* Spacebar */}
          <button
            onClick={onSpace}
            className="w-64 h-12 bg-transparent border-2 border-white border-opacity-50 rounded-lg text-base font-bold text-white active:bg-white active:bg-opacity-20 active:border-opacity-80 active:scale-95 shadow-lg active:shadow-md transition-all duration-150 select-none"
          >
            SPACE
          </button>
        </div>

        {/* Hide Button */}
        <div className="flex justify-center mt-5">
          <button
            onClick={onHide}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-transparent border-2 border-white border-opacity-50 rounded-lg text-white font-semibold active:bg-white active:bg-opacity-20 active:border-opacity-80 active:scale-95 shadow-lg active:shadow-md transition-all duration-150"
          >
            <FaChevronDown className="w-3 h-3" />
            Click to hide keyboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default HolographicKeyboard;
