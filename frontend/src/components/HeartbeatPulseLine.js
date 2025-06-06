// src/components/HeartbeatPulseLine.js
import React from "react";

export default function HeartbeatLine({ numFollowers = 38, className = "", style }) {
    return (
      <div className={`pulse-container ${className}`} style={style}>
        <div className="pulse" />
        {Array.from({ length: numFollowers }).map((_, i) => (
          <div
            key={i}
            className="pulse-follow"
            style={{ animationDelay: `${i * 0.045}s` }}
          />
        ))}
      </div>
    );
  }
