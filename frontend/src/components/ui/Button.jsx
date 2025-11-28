import React from 'react';
import { motion } from 'framer-motion';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-blue-600 active:bg-blue-700 text-white shadow-lg active:shadow-md active:scale-95 focus:ring-blue-200',
    secondary: 'bg-gray-600 active:bg-gray-700 text-white shadow-lg active:shadow-md active:scale-95 focus:ring-gray-200',
    success: 'bg-emerald-600 active:bg-emerald-700 text-white shadow-lg active:shadow-md active:scale-95 focus:ring-emerald-200',
    danger: 'bg-red-600 active:bg-red-700 text-white shadow-lg active:shadow-md active:scale-95 focus:ring-red-200',
    warning: 'bg-amber-600 active:bg-amber-700 text-white shadow-lg active:shadow-md active:scale-95 focus:ring-amber-200',
    outline: 'border-2 border-blue-600 text-blue-600 active:bg-blue-600 active:text-white shadow-md active:shadow-sm active:scale-95 focus:ring-blue-200',
    ghost: 'text-gray-600 active:bg-gray-100 active:text-gray-900 shadow-sm active:shadow-none active:scale-95 focus:ring-gray-200',
    kiosk: 'bg-white/20 border-2 border-white/30 text-white active:bg-white/30 active:border-white/50 backdrop-blur-md shadow-lg active:shadow-md active:scale-95 focus:ring-white/20'
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
    kiosk: 'px-8 py-4 text-lg lg:px-12 lg:py-6 lg:text-xl' // Optimized for kiosk touch interfaces
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
    kiosk: 'w-6 h-6 lg:w-8 lg:h-8'
  };

  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      className={classes}
      disabled={isDisabled}
      onClick={onClick}
      whileHover={!isDisabled ? { scale: 1.02, transition: { duration: 0.2, ease: "easeOut" } } : undefined}
      whileTap={!isDisabled ? { scale: 0.95, transition: { duration: 0.15, ease: "easeIn" } } : undefined}
      {...props}
    >
      {loading && (
        <svg className={`animate-spin -ml-1 mr-3 ${iconSizes[size]}`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {icon && !loading && (
        <span className={`mr-2 ${iconSizes[size]}`}>
          {icon}
        </span>
      )}
      {children}
    </motion.button>
  );
};

export default Button;
