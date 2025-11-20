import React, { useState, useRef, useEffect } from 'react';

/**
 * Reusable Pagination Component with editable page number input
 * 
 * @param {number} currentPage - Current active page (1-indexed)
 * @param {number} totalPages - Total number of pages
 * @param {function} onPageChange - Callback function when page changes
 * @param {string} className - Additional CSS classes for container
 * @param {string} size - Size variant: 'sm' | 'md' | 'lg' (default: 'md')
 */
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  size = 'md'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(currentPage.toString());
  const inputRef = useRef(null);

  // Update input value when currentPage changes externally
  useEffect(() => {
    if (!isEditing) {
      setInputValue(currentPage.toString());
    }
  }, [currentPage, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    // Allow only numbers
    if (/^\d*$/.test(value)) {
      setInputValue(value);
    }
  };

  const handleInputBlur = () => {
    submitPageChange();
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      submitPageChange();
    } else if (e.key === 'Escape') {
      setInputValue(currentPage.toString());
      setIsEditing(false);
    }
  };

  const submitPageChange = () => {
    const pageNum = parseInt(inputValue, 10);
    
    if (isNaN(pageNum) || pageNum < 1) {
      // Invalid input - reset to current page
      setInputValue(currentPage.toString());
    } else if (pageNum > totalPages) {
      // Exceeds total pages - go to last page
      onPageChange(totalPages);
      setInputValue(totalPages.toString());
    } else if (pageNum !== currentPage) {
      // Valid page change
      onPageChange(pageNum);
    }
    
    setIsEditing(false);
  };

  const handlePageClick = () => {
    setIsEditing(true);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Size-based styling
  const sizeClasses = {
    sm: {
      button: 'px-2 py-1 text-xs',
      input: 'w-12 px-2 py-1 text-xs'
    },
    md: {
      button: 'px-2.5 py-1.5 text-sm',
      input: 'w-14 px-2.5 py-1.5 text-sm'
    },
    lg: {
      button: 'px-3 py-2 text-base',
      input: 'w-16 px-3 py-2 text-base'
    }
  };

  const styles = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`flex items-center space-x-1.5 ${className}`}>
      {/* Previous Button */}
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className={`${styles.button} font-semibold text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      >
        Previous
      </button>

      {/* Current Page Number - Editable */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className={`${styles.input} font-semibold text-center text-white bg-[#1F3463] border border-[#1F3463] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400`}
          placeholder={currentPage.toString()}
        />
      ) : (
        <button
          onClick={handlePageClick}
          className={`${styles.input} font-semibold text-white bg-[#1F3463] border border-[#1F3463] rounded-md hover:bg-[#2d4a7a] transition-colors cursor-pointer`}
          title="Click to enter page number"
        >
          {currentPage}
        </button>
      )}

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className={`${styles.button} font-semibold text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;

