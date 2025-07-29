
import React from 'react';

const ResetIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21.5 2v6h-6" />
    <path d="M3.5 22v-6h6" />
    <path d="M2.5 12a9.5 9.5 0 0 1 15.1 -6.9" />
    <path d="M21.5 12a9.5 9.5 0 0 1 -15.1 6.9" />
  </svg>
);

export default ResetIcon;
