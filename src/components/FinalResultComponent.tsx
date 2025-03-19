import React from 'react';
import './FinalResultComponent.css';

const FinalResultComponent: React.FC<{ finalResult: string }> = ({ finalResult }) => {
  return (
    <div className="final-result-container">
      <pre className="final-result-box">{finalResult}</pre>
    </div>
  );
};

export default FinalResultComponent;