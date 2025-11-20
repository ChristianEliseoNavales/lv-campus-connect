import React, { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const ResponsiveGrid = ({
  items = [],
  renderItem,
  maxItemsPerPage = 6,
  className = '',
  containerClassName = '',
  buttonClassName = '',
  showPagination = true,
  onItemClick,
  isDirectoryPage = false, // New prop to identify Directory page
  ...props
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  // Calculate pagination
  const totalPages = Math.ceil(items.length / maxItemsPerPage);
  const startIndex = currentPage * maxItemsPerPage;
  const endIndex = Math.min(startIndex + maxItemsPerPage, items.length);
  const currentItems = items.slice(startIndex, endIndex);
  const itemCount = currentItems.length;

  // Navigation handlers
  const goToNextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  // Grid layout logic based on number of items
  const getGridLayout = (count) => {
    switch (count) {
      case 1:
        return {
          containerClass: 'grid grid-cols-1 gap-6 max-w-md mx-auto',
          itemClass: 'w-full'
        };
      case 2:
        return {
          containerClass: 'grid grid-cols-2 gap-x-26 gap-y-6 max-w-4xl mx-auto',
          itemClass: 'w-64'
        };
      case 3:
        return {
          containerClass: 'grid grid-cols-3 gap-6 max-w-5xl mx-auto',
          itemClass: 'w-58'
        };
      case 4:
        return {
          containerClass: 'grid grid-cols-2 gap-x-20 gap-y-6 max-w-4xl mx-auto',
          itemClass: 'w-64'
        };
      case 5:
        return {
          containerClass: 'grid gap-6 max-w-5xl mx-auto',
          itemClass: 'w-58',
          customLayout: true
        };
      case 6:
        return {
          containerClass: 'grid grid-cols-3 gap-6 max-w-6xl mx-auto',
          itemClass: 'w-58'
        };
      default:
        return {
          containerClass: 'grid grid-cols-3 gap-6 max-w-6xl mx-auto',
          itemClass: 'w-58'
        };
    }
  };

  const layout = getGridLayout(itemCount);

  // Default button styling for kiosk interface with touch press animations
  const defaultButtonClass = `
    text-white rounded-3xl shadow-lg drop-shadow-md p-5
    active:scale-95 active:shadow-md transition-all duration-150
    border-2 border-transparent focus:outline-none focus:ring-3 focus:ring-blue-200
    ${layout.itemClass}
  `;

  const buttonStyle = {
    backgroundColor: '#1F3463'
  };

  // Touch press handlers for kiosk interface
  const handleTouchStart = (e) => {
    e.target.style.backgroundColor = '#1A2E56';
    e.target.style.transform = 'scale(0.95)';
  };

  const handleTouchEnd = (e) => {
    e.target.style.backgroundColor = '#1F3463';
    e.target.style.transform = 'scale(1)';
  };

  // Fallback mouse handlers for non-touch devices
  const handleMouseEnter = (e) => {
    e.target.style.backgroundColor = '#2A4A7A';
    e.target.style.transform = 'scale(1.02)';
  };

  const handleMouseDown = (e) => {
    e.target.style.backgroundColor = '#1A2E56';
    e.target.style.transform = 'scale(0.95)';
  };

  const handleMouseUp = (e) => {
    e.target.style.backgroundColor = '#1F3463';
    e.target.style.transform = 'scale(1)';
  };

  const handleMouseLeave = (e) => {
    e.target.style.backgroundColor = '#1F3463';
    e.target.style.transform = 'scale(1)';
  };

  const handleItemClick = (item, index) => {
    if (onItemClick) {
      onItemClick(item, startIndex + index);
    }
  };

  // Render 5-item special layout
  const renderFiveItemLayout = () => (
    <div className="grid gap-6 max-w-5xl mx-auto">
      {/* First Row - 3 items */}
      <div className="grid grid-cols-3 gap-6">
        {currentItems.slice(0, 3).map((item, index) => (
          <button
            key={index}
            onClick={() => handleItemClick(item, index)}
            className={`${defaultButtonClass} ${buttonClassName}`}
            style={buttonStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            {...props}
          >
            {renderItem ? renderItem(item, startIndex + index) : (
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">
                  {item.name || item.title || item}
                </h3>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Second Row - 2 items centered */}
      <div className="grid grid-cols-2 gap-6 max-w-xl mx-auto">
        {currentItems.slice(3, 5).map((item, index) => (
          <button
            key={index + 3}
            onClick={() => handleItemClick(item, index + 3)}
            className={`${defaultButtonClass} ${buttonClassName}`}
            style={buttonStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            {...props}
          >
            {renderItem ? renderItem(item, startIndex + index + 3) : (
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">
                  {item.name || item.title || item}
                </h3>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  // Render regular grid layout
  const renderRegularLayout = () => (
    <div className={layout.containerClass}>
      {currentItems.map((item, index) => (
        <button
          key={index}
          onClick={() => handleItemClick(item, index)}
          className={`${defaultButtonClass} ${buttonClassName}`}
          style={buttonStyle}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          {...props}
        >
          {renderItem ? renderItem(item, startIndex + index) : (
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">
                {item.name || item.title || item}
              </h3>
            </div>
          )}
        </button>
      ))}
    </div>
  );

  // Check if we should show navigation buttons (always show for Directory page when pagination is enabled)
  const showPrevButton = showPagination && totalPages > 1 && (!isDirectoryPage ? currentPage > 0 : true);
  const showNextButton = showPagination && totalPages > 1 && (!isDirectoryPage ? currentPage < totalPages - 1 : true);

  // Check disabled states for Directory page navigation buttons
  const isPrevDisabled = currentPage === 0;
  const isNextDisabled = currentPage >= totalPages - 1;

  // Define navigation button styles based on page type and disabled state
  const getNavButtonStyles = (disabled = false) => {
    if (isDirectoryPage) {
      // Inverted colors for Directory page with disabled state support (touch press animations)
      return {
        className: `flex items-center justify-center w-12 h-12 rounded-full focus:outline-none transition-all duration-150 ${
          disabled
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-md'
            : 'bg-white text-[#1F3463] shadow-lg active:scale-95 active:shadow-md focus:ring-3 focus:ring-blue-200 cursor-pointer'
        }`,
        style: {}
      };
    } else {
      // Standard colors for other pages with disabled state support (touch press animations)
      return {
        className: `flex items-center justify-center w-12 h-12 rounded-full text-white transition-all duration-150 focus:outline-none ${
          disabled
            ? 'cursor-not-allowed shadow-md opacity-50'
            : 'shadow-lg active:scale-95 active:shadow-md focus:ring-3 focus:ring-blue-200 cursor-pointer'
        }`,
        style: { backgroundColor: disabled ? '#9CA3AF' : '#1F3463' }
      };
    }
  };

  // Get base navigation button styles (will be customized per button with disabled state)
  const getButtonStyles = (disabled) => getNavButtonStyles(disabled);

  return (
    <div className={`flex flex-col ${containerClassName}`}>
      {/* Grid Container with Side Navigation */}
      <div className="flex items-start justify-center relative">
        {/* Previous Button - Left Side (only for non-Directory pages) */}
        {showPrevButton && !isDirectoryPage && (
          <button
            onClick={isPrevDisabled ? undefined : goToPrevPage}
            disabled={isPrevDisabled}
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 z-10 ${getButtonStyles(isPrevDisabled).className}`}
            style={getButtonStyles(isPrevDisabled).style}
            onTouchStart={!isPrevDisabled ? handleTouchStart : undefined}
            onTouchEnd={!isPrevDisabled ? handleTouchEnd : undefined}
            onMouseDown={!isPrevDisabled ? handleMouseDown : undefined}
            onMouseUp={!isPrevDisabled ? handleMouseUp : undefined}
            onMouseLeave={!isPrevDisabled ? handleMouseLeave : undefined}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
        )}

        {/* Grid Content */}
        <div className="flex items-start justify-center w-full">
          {layout.customLayout && itemCount === 5 ? renderFiveItemLayout() : renderRegularLayout()}
        </div>

        {/* Next Button - Right Side (only for non-Directory pages) */}
        {showNextButton && !isDirectoryPage && (
          <button
            onClick={isNextDisabled ? undefined : goToNextPage}
            disabled={isNextDisabled}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 z-10 ${getButtonStyles(isNextDisabled).className}`}
            style={getButtonStyles(isNextDisabled).style}
            onTouchStart={!isNextDisabled ? handleTouchStart : undefined}
            onTouchEnd={!isNextDisabled ? handleTouchEnd : undefined}
            onMouseDown={!isNextDisabled ? handleMouseDown : undefined}
            onMouseUp={!isNextDisabled ? handleMouseUp : undefined}
            onMouseLeave={!isNextDisabled ? handleMouseLeave : undefined}
            aria-label="Next page"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Page Indicators with Navigation Buttons */}
      {showPagination && totalPages > 1 && (
        <div className={`flex justify-center items-center ${isDirectoryPage ? 'mt-6 mb-3' : 'mt-10 mb-6'}`}>
          {/* Previous Button for Directory Page - Always visible with disabled state */}
          {isDirectoryPage && (
            <button
              onClick={isPrevDisabled ? undefined : goToPrevPage}
              disabled={isPrevDisabled}
              className={`mr-6 ${getButtonStyles(isPrevDisabled).className}`}
              style={getButtonStyles(isPrevDisabled).style}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </button>
          )}

          {/* Page Indicator Dots - Show for all pages */}
          <div className={`flex items-center space-x-2.5 ${isDirectoryPage ? 'mx-6' : 'mx-3'}`}>
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === currentPage
                    ? 'bg-blue-600'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                style={index === currentPage ? { backgroundColor: '#1F3463' } : {}}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>

          {/* Next Button for Directory Page - Always visible with disabled state */}
          {isDirectoryPage && (
            <button
              onClick={isNextDisabled ? undefined : goToNextPage}
              disabled={isNextDisabled}
              className={`ml-6 ${getButtonStyles(isNextDisabled).className}`}
              style={getButtonStyles(isNextDisabled).style}
              aria-label="Next page"
            >
              <ChevronRightIcon className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ResponsiveGrid;
